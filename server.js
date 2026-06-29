require("dotenv").config({ quiet: true });
const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const PORT = Number(process.env.PORT || 8787);
const CONFIG_PATH = path.join(__dirname, "config.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const SQLITE_PATH = path.join(DATA_DIR, "phottix.sqlite");
const DEFAULT_CONFIG = { import_folder: "./imports/" };
const IV_LENGTH = 16;
const SHARED_STORAGE_KEYS = [
  "phottix_customers",
  "phottix_products",
  "phottix_followup_logs",
  "phottix_email_templates",
  "phottix_settings",
  "phottix_auto_backups",
  "phottix_analysis_history",
  "phottix_error_logs"
];

ensureImportFolder();

app.use(express.json({ limit: "50mb" }));
app.use(express.static(PUBLIC_DIR, {
  etag: false,
  maxAge: 0,
  setHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  }
}));

let sqliteDb = null;

function getSqliteDb() {
  if (sqliteDb) return sqliteDb;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  sqliteDb = new DatabaseSync(SQLITE_PATH);
  sqliteDb.exec("PRAGMA journal_mode = WAL");
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS app_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS senders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      appPassword TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  seedDefaultSender(sqliteDb);
  return sqliteDb;
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function getEncryptionKey() {
  const rawKey = String(process.env.ENCRYPTION_KEY || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(rawKey)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string.");
  }
  return Buffer.from(rawKey, "hex");
}

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(text || ""), "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(text) {
  const parts = String(text || "").split(":");
  if (parts.length < 2) throw new Error("Invalid encrypted sender password.");
  const iv = Buffer.from(parts.shift(), "hex");
  const encryptedText = Buffer.from(parts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString("utf8");
}

function publicSender(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function seedDefaultSender(db) {
  try {
    const email = normalizeEmail(process.env.SMTP_USER);
    const appPassword = String(process.env.SMTP_PASS || "").trim();
    if (!email || !appPassword || email === "your-email@gmail.com" || appPassword === "your-app-password") return;
    const existing = db.prepare("SELECT id FROM senders WHERE email = ?").get(email);
    if (existing) return;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO senders (id, name, email, appPassword, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(uid("sender"), email.split("@")[0] || email, email, encrypt(appPassword), now, now);
  } catch (error) {
    console.warn(`Default sender was not created: ${error.message}`);
  }
}

function isSharedStorageKey(key) {
  return SHARED_STORAGE_KEYS.includes(String(key || ""));
}

function readSharedStore() {
  const db = getSqliteDb();
  const rows = db.prepare("SELECT key, value, updated_at FROM app_store").all();
  const data = {};
  const updatedAt = {};
  rows.forEach((row) => {
    try {
      data[row.key] = JSON.parse(row.value);
      updatedAt[row.key] = row.updated_at;
    } catch (error) {
      data[row.key] = null;
      updatedAt[row.key] = row.updated_at;
    }
  });
  return { data, updatedAt };
}

function writeSharedKey(key, value) {
  if (!isSharedStorageKey(key)) throw new Error(`Unsupported shared storage key: ${key}`);
  const db = getSqliteDb();
  db.prepare(`
    INSERT INTO app_store (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value ?? null), new Date().toISOString());
}

function writeSharedSnapshot(data) {
  if (!data || typeof data !== "object") throw new Error("Invalid shared data snapshot.");
  const db = getSqliteDb();
  const stmt = db.prepare(`
    INSERT INTO app_store (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    SHARED_STORAGE_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        stmt.run(key, JSON.stringify(data[key] ?? null), now);
      }
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function isHostImportRequest(req) {
  const host = String(req.headers.host || "").toLowerCase();
  return host.startsWith("127.0.0.1") || host.startsWith("localhost") || host.startsWith("[::1]");
}

function rejectRemoteImport(req, res) {
  if (isHostImportRequest(req)) return false;
  res.status(403).json({
    success: false,
    hostOnly: true,
    error: "Excel import is available only on the host computer. Open http://127.0.0.1:8787/ on the host machine to import files."
  });
  return true;
}

function rejectRemoteAdmin(req, res) {
  if (isHostImportRequest(req)) return false;
  res.status(403).json({
    success: false,
    hostOnly: true,
    error: "Sender management is available only on the host computer."
  });
  return true;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanWebsiteExtractText(value) {
  let text = String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
  if (!text) return "";
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<%[\s\S]*?%>/g, " ")
    .replace(/\{\s*%[\s\S]*?%\s*\}/g, " ")
    .replace(/\{\{[\s\S]{0,120}?\}\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/([a-z0-9._%+-]+@[a-z0-9.-]+)\s+(com|net|org|co|us|ca|de|fr|hk|cn|jp|au|uk)\b/gi, "$1.$2")
    .replace(/\b(account_circle|sentiment_very_satisfied|settings|person|person_add|shopping_cart|search|close)\b/gi, " ")
    .replace(/\b(isLogged|firstname|totalItem)\b/gi, " ")
    .replace(/\b(welcome back|view account details|sign in|register|can we help find anything)\b/gi, " ")
    .replace(/\bHome\b/gi, " ")
    .replace(/\s*(---|===)\s*(View)?\s*/gi, "\n")
    .replace(/\s*[|•·]\s*/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/\s*\b(Get in touch|Business Hours|Newsletter|Contact|Services|Galleries|Order Prints|Photo Products|Event Photos|Studio Rental|Classes|About|Shop)\b\s*/gi, "\n$1 ");

  const menuOnly = /^(home|view|sign in|register|view account details|welcome back|can we help find anything|newsletter email|thank you for subscribing|oops, there was an error|please try again later)$/i;
  const noisy = /cookie|privacy policy|terms of use|javascript|subscribe for promotions|special offers/i;
  const seen = new Set();
  const clean = [];
  text.split(/\n|(?<=\.)\s+(?=[A-Z0-9(])|(?<=!)\s+|(?<=\?)\s+/)
    .map((line) => String(line || "").replace(/\s+/g, " ").replace(/\bView\b$/i, "").trim())
    .filter(Boolean)
    .forEach((line) => {
      line = line.replace(/\bHi\b$/i, "").replace(/\s+[,;:]+$/g, "").trim();
      if (menuOnly.test(line) || noisy.test(line)) return;
      if (line.length < 8 && !/@|\d{3}|\b[A-Z]{2}\b/.test(line)) return;
      const key = line.toLowerCase().replace(/[^\w@]+/g, " ").trim();
      if (seen.has(key)) return;
      seen.add(key);
      clean.push(line);
    });
  return clean.join("\n").slice(0, 8000).trim();
}

function summarizeContent(text) {
  const meaningfulShortLine = /@|\d{3}|studio rental|photo products|order prints|event photos|services|galleries|classes|showroom|retail store|business hours/i;
  const lines = cleanWebsiteExtractText(text)
    .split(/[。！？.!?\n]/)
    .map((line) => line.trim())
    .filter((line) => (line.length >= 20 || meaningfulShortLine.test(line)) && !/cookie|privacy policy|terms of use|javascript/i.test(line));
  const seen = new Set();
  const clean = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(line);
    if (clean.join("\n").length > 5000) break;
  }
  return clean.join("\n").slice(0, 8000);
}

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function normalizeDomain(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return text.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  }
}

function getRowValue(row, keys) {
  const normalized = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[key.toLowerCase().trim().replace(/[\s_-]+/g, "")] = value;
    normalized[key.toLowerCase().trim()] = value;
  });
  for (const key of keys) {
    const value = normalized[key.toLowerCase().replace(/[\s_-]+/g, "")] ?? normalized[key.toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function attachNormalizedDomains(rows) {
  return rows.map((row) => {
    const website = getRowValue(row, [
      "Website",
      "website",
      "domain",
      "url",
      "Company Website",
      "Company Homepage",
      "公司主頁",
      "公司主页",
      "官網",
      "官网",
      "官網域名",
      "官网域名"
    ]);
    return { ...row, _normalizedDomain: normalizeDomain(website) };
  });
}

function ensureConfig() {
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (err) {
    config = DEFAULT_CONFIG;
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      const defaultFolder = path.join(__dirname, DEFAULT_CONFIG.import_folder);
      if (!fs.existsSync(defaultFolder)) fs.mkdirSync(defaultFolder, { recursive: true });
      console.warn("config.json rebuilt with default settings.");
    } catch (writeError) {
      console.warn(`config.json could not be rebuilt: ${writeError.message}`);
    }
  }
  return { ...DEFAULT_CONFIG, ...config };
}

function configuredImportFolder() {
  const folder = String(ensureConfig().import_folder || DEFAULT_CONFIG.import_folder);
  return path.isAbsolute(folder) ? folder : path.join(__dirname, folder);
}

function ensureImportFolder() {
  ensureConfig();
}

function listExcelFiles() {
  const folder = configuredImportFolder();
  if (!fs.existsSync(folder)) throw new Error("Folder does not exist or no Excel files found.");
  const stat = fs.statSync(folder);
  if (!stat.isDirectory()) throw new Error("Folder does not exist or no Excel files found.");
  const files = fs.readdirSync(folder)
    .filter((name) => /\.(xlsx|xls|csv)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
  if (!files.length) {
    throw new Error("Folder does not exist or no Excel files found.");
  }
  return files;
}

function readExcelRows(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return { sheetName, rows: attachNormalizedDomains(rows) };
}

function missingSmtpSettings() {
  const placeholderValues = new Set(["your-email@gmail.com", "your-app-password"]);
  return ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"].filter((key) => {
    const value = String(process.env[key] || "").trim();
    return !value || placeholderValues.has(value);
  });
}

function createMailTransport() {
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const secureValue = String(process.env.SMTP_SECURE || "").trim().toLowerCase();
  const secure = secureValue ? ["true", "1", "yes"].includes(secureValue) : smtpPort === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

app.get("/", (req, res) => {
  res.type("html");
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/script.js", (req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(PUBLIC_DIR, "script.js"));
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

app.get("/api/import-files", (req, res) => {
  if (rejectRemoteImport(req, res)) return;
  try {
    res.json({ success: true, files: listExcelFiles() });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || "Failed to list import files." });
  }
});

app.get("/list-excel", (req, res) => {
  if (rejectRemoteImport(req, res)) return;
  try {
    res.json({ success: true, files: listExcelFiles() });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || "Failed to list Excel files." });
  }
});

app.post("/api/fetch-website", async (req, res) => {
  const targetUrl = normalizeUrl(req.body?.url);
  if (!targetUrl) {
    res.status(400).json({ success: false, error: "Missing url." });
    return;
  }

  try {
    const response = await axios.get(targetUrl, {
      timeout: 10000,
      maxRedirects: 5,
      responseType: "text",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      validateStatus: (status) => status >= 200 && status < 400
    });
    const text = stripHtml(response.data);
    const content = summarizeContent(text);
    if (!content || content.length < 40) {
      res.status(502).json({ success: false, error: "Website fetched, but not enough readable content was found." });
      return;
    }
    res.json({ success: true, url: response.request?.res?.responseUrl || targetUrl, content });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || "Failed to fetch website." });
  }
});

app.get("/api/db/status", (req, res) => {
  try {
    const { data } = readSharedStore();
    res.json({
      success: true,
      database: "sqlite",
      path: SQLITE_PATH,
      keys: Object.keys(data),
      counts: {
        customers: Array.isArray(data.phottix_customers) ? data.phottix_customers.length : 0,
        products: Array.isArray(data.phottix_products) ? data.phottix_products.length : 0,
        logs: data.phottix_followup_logs && typeof data.phottix_followup_logs === "object" ? Object.keys(data.phottix_followup_logs).length : 0
      }
    });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "SQLite status failed." });
  }
});

app.get("/api/db/snapshot", (req, res) => {
  try {
    const snapshot = readSharedStore();
    res.json({ success: true, ...snapshot });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "SQLite snapshot failed." });
  }
});

app.post("/api/db/snapshot", (req, res) => {
  try {
    writeSharedSnapshot(req.body?.data || {});
    const snapshot = readSharedStore();
    res.json({ success: true, ...snapshot });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "SQLite snapshot save failed." });
  }
});

app.put("/api/db/key/:key", (req, res) => {
  try {
    const key = req.params.key;
    if (!isSharedStorageKey(key)) {
      res.status(400).json({ success: false, error: `Unsupported shared storage key: ${key}` });
      return;
    }
    writeSharedKey(key, req.body?.value);
    res.json({ success: true, key });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "SQLite key save failed." });
  }
});

app.get("/api/senders", (req, res) => {
  try {
    const rows = getSqliteDb()
      .prepare("SELECT id, name, email, isActive, createdAt, updatedAt FROM senders ORDER BY name COLLATE NOCASE, email COLLATE NOCASE")
      .all();
    res.json({ success: true, hostOnly: isHostImportRequest(req), senders: rows.map(publicSender) });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to load senders." });
  }
});

app.post("/api/senders", (req, res) => {
  if (rejectRemoteAdmin(req, res)) return;
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const appPassword = String(req.body?.appPassword || "").replace(/\s+/g, "");
    if (!name || !email || !appPassword) {
      res.status(400).json({ success: false, error: "Missing sender name, email, or app password." });
      return;
    }
    const now = new Date().toISOString();
    const id = uid("sender");
    getSqliteDb().prepare(`
      INSERT INTO senders (id, name, email, appPassword, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(id, name, email, encrypt(appPassword), now, now);
    const sender = getSqliteDb().prepare("SELECT id, name, email, isActive, createdAt, updatedAt FROM senders WHERE id = ?").get(id);
    res.json({ success: true, sender: publicSender(sender) });
  } catch (error) {
    const message = String(error.message || "");
    const duplicate = /UNIQUE constraint failed/i.test(message);
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? "Sender email already exists." : message || "Failed to add sender." });
  }
});

app.put("/api/senders/:id", (req, res) => {
  if (rejectRemoteAdmin(req, res)) return;
  try {
    const id = String(req.params.id || "").trim();
    const existing = getSqliteDb().prepare("SELECT * FROM senders WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ success: false, error: "Sender not found." });
      return;
    }
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const appPassword = String(req.body?.appPassword || "").replace(/\s+/g, "");
    if (!name || !email) {
      res.status(400).json({ success: false, error: "Missing sender name or email." });
      return;
    }
    const now = new Date().toISOString();
    if (appPassword) {
      getSqliteDb().prepare("UPDATE senders SET name = ?, email = ?, appPassword = ?, updatedAt = ? WHERE id = ?")
        .run(name, email, encrypt(appPassword), now, id);
    } else {
      getSqliteDb().prepare("UPDATE senders SET name = ?, email = ?, updatedAt = ? WHERE id = ?")
        .run(name, email, now, id);
    }
    const sender = getSqliteDb().prepare("SELECT id, name, email, isActive, createdAt, updatedAt FROM senders WHERE id = ?").get(id);
    res.json({ success: true, sender: publicSender(sender) });
  } catch (error) {
    const message = String(error.message || "");
    const duplicate = /UNIQUE constraint failed/i.test(message);
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? "Sender email already exists." : message || "Failed to update sender." });
  }
});

app.delete("/api/senders/:id", (req, res) => {
  if (rejectRemoteAdmin(req, res)) return;
  try {
    const result = getSqliteDb().prepare("DELETE FROM senders WHERE id = ?").run(String(req.params.id || ""));
    if (!result.changes) {
      res.status(404).json({ success: false, error: "Sender not found." });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to delete sender." });
  }
});

app.patch("/api/senders/:id/toggle", (req, res) => {
  if (rejectRemoteAdmin(req, res)) return;
  try {
    const id = String(req.params.id || "");
    const existing = getSqliteDb().prepare("SELECT * FROM senders WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ success: false, error: "Sender not found." });
      return;
    }
    const nextActive = existing.isActive ? 0 : 1;
    getSqliteDb().prepare("UPDATE senders SET isActive = ?, updatedAt = ? WHERE id = ?")
      .run(nextActive, new Date().toISOString(), id);
    const sender = getSqliteDb().prepare("SELECT id, name, email, isActive, createdAt, updatedAt FROM senders WHERE id = ?").get(id);
    res.json({ success: true, sender: publicSender(sender) });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to toggle sender." });
  }
});

app.post("/api/parse-excel-config", (req, res) => {
  if (rejectRemoteImport(req, res)) return;
  try {
    const filename = path.basename(String(req.body?.fileName || req.body?.filename || "").trim().replace(/^["']|["']$/g, ""));
    if (!filename) {
      res.status(400).json({ success: false, error: "Missing Excel filename." });
      return;
    }
    if (!/\.(xlsx|xls|csv)$/i.test(filename)) {
      res.status(400).json({ success: false, error: "Only .xlsx, .xls, or .csv files are supported." });
      return;
    }
    const folder = configuredImportFolder();
    const allowed = listExcelFiles();
    const requested = filename.toLowerCase().replace(/\s+/g, " ");
    const match = allowed.find((name) => name.toLowerCase() === filename.toLowerCase())
      || allowed.find((name) => name.toLowerCase().replace(/\s+/g, " ") === requested);
    if (!match) {
      res.status(404).json({ success: false, error: `File not found in import folder: ${filename}` });
      return;
    }
    const filePath = path.join(folder, match);
    const { sheetName, rows } = readExcelRows(filePath);
    res.json({ success: true, sheetName, data: rows, rows });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || "Failed to parse config Excel." });
  }
});

app.post("/api/generate-excel", (req, res) => {
  try {
    const data = Array.isArray(req.body?.data) ? req.body.data : [];
    if (!data.length) {
      res.status(400).json({ success: false, error: "No data provided." });
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Phottix Export");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="phottix_export_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || "Failed to generate Excel." });
  }
});

app.post("/api/send-email", async (req, res) => {
  const to = String(req.body?.to || "").trim();
  const subject = String(req.body?.subject || "").trim();
  const html = String(req.body?.html || "").trim();
  const senderId = String(req.body?.senderId || "").trim();
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

  if (!to || !subject || !html) {
    res.status(400).json({ success: false, error: "Missing to, subject, or html." });
    return;
  }

  try {
    let transporter = null;
    let from = process.env.SMTP_USER;
    if (senderId) {
      const sender = getSqliteDb().prepare("SELECT * FROM senders WHERE id = ? AND isActive = 1").get(senderId);
      if (!sender) {
        res.status(400).json({ success: false, error: "寄件者不存在或已停用" });
        return;
      }
      transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: sender.email,
          pass: decrypt(sender.appPassword)
        }
      });
      from = `"${sender.name}" <${sender.email}>`;
    } else {
      const missing = missingSmtpSettings();
      if (missing.length) {
        res.status(503).json({
          success: false,
          error: `SMTP is not configured. Missing: ${missing.join(", ")}`
        });
        return;
      }
      transporter = createMailTransport();
    }

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      attachments
    });
    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error(`Send email failed: ${error.message}`);
    res.status(500).json({ success: false, error: error.message || "Failed to send email." });
  }
});

// TODO: 郵件附件 / 影片 / 超連結功能下一階段預留
// POST /api/upload-attachment
// - 接收 multipart/form-data 檔案
// - 支援 PDF / Word / Excel / Image / Video
// - 儲存至 ./uploads/ 或雲端
// - 回傳檔案 metadata (name, size, type, path, url)
// 目前此路由尚未實作；前端只保存附件名稱、影片連結與 hyper link metadata

app.use((req, res) => {
  res.status(404).send("Not Found");
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Phottix Customer Agent listening on http://0.0.0.0:${PORT}`);
  console.log(`Local host URL: http://127.0.0.1:${PORT}/`);
  console.log(`Running file: ${__filename}`);
  console.log("Keep this window open. Press Ctrl+C to stop the server.");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Close the old Phottix server window, then run start.bat again.`);
  } else {
    console.error(`Server failed to start: ${error.message}`);
  }
  process.exit(1);
});

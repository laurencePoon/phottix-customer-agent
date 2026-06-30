require("dotenv").config({ quiet: true });
const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
const multer = require("multer");
const Imap = require("imap");
const { simpleParser } = require("mailparser");
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
const UPLOAD_TEMP_DIR = path.join(__dirname, "uploads", "temp");
const DEFAULT_CONFIG = { import_folder: "./imports/" };
const IV_LENGTH = 16;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 5;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);
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
ensureUploadTempDir();

const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_TEMP_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${path.basename(file.originalname)}`);
  }
});

const uploadAttachments = multer({
  storage: attachmentStorage,
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: MAX_ATTACHMENT_COUNT },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_ATTACHMENT_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Unsupported file type. Please upload PDF, Word, Excel, JPEG, PNG, or GIF files."));
  }
});

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
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS custom_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      purpose TEXT,
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

function publicCustomTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    purpose: row.purpose || "custom",
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

function normalizeCustomerEmailContacts(items) {
  let contacts = items;
  if (typeof contacts === "string") {
    try {
      contacts = JSON.parse(contacts);
    } catch {
      contacts = [];
    }
  }
  contacts = Array.isArray(contacts) ? contacts : [];
  const seen = new Set();
  return contacts.map((item) => ({
    email: String(item?.email || item?.address || "").trim(),
    role: ["to", "cc", "bcc"].includes(String(item?.role || "").trim().toLowerCase())
      ? String(item.role).trim().toLowerCase()
      : "to"
  }))
    .filter((item) => item.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email))
    .filter((item) => {
      const key = `${item.role}:${item.email.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function missingImapSettings() {
  const required = ["IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASS"];
  return required.filter((key) => !String(process.env[key] || "").trim());
}

function normalizeAddress(value) {
  return String(value || "").trim().toLowerCase();
}

function todayPlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatImapSearchDate(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getUTCDate()}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

function imapSearchAsync(imap, criteria) {
  return new Promise((resolve, reject) => {
    imap.search(criteria, (error, results) => error ? reject(error) : resolve(results || []));
  });
}

function imapOpenBoxAsync(imap, boxName) {
  return new Promise((resolve, reject) => {
    imap.openBox(boxName, false, (error, box) => error ? reject(error) : resolve(box));
  });
}

function fetchImapMessages(imap, uids) {
  return new Promise((resolve, reject) => {
    if (!uids.length) {
      resolve([]);
      return;
    }
    const messages = [];
    const pendingParses = [];
    const fetcher = imap.fetch(uids, { bodies: "", struct: false, markSeen: false });
    fetcher.on("message", (message) => {
      const chunks = [];
      let attrs = {};
      message.on("body", (stream) => {
        stream.on("data", (chunk) => chunks.push(chunk));
      });
      message.once("attributes", (attributes) => {
        attrs = attributes || {};
      });
      const parsedMessage = new Promise((resolveMessage) => {
        message.once("end", async () => {
          try {
            const parsed = await simpleParser(Buffer.concat(chunks));
            messages.push({ parsed, attrs });
          } catch (error) {
            messages.push({ error, attrs });
          } finally {
            resolveMessage();
          }
        });
      });
      pendingParses.push(parsedMessage);
    });
    fetcher.once("error", reject);
    fetcher.once("end", () => {
      Promise.all(pendingParses).then(() => resolve(messages)).catch(reject);
    });
  });
}

function syncInboxMessages() {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASS,
      host: process.env.IMAP_HOST || "imap.gmail.com",
      port: Number(process.env.IMAP_PORT || 993),
      tls: String(process.env.IMAP_TLS || "true").toLowerCase() !== "false"
    });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      try {
        imap.end();
      } catch {}
      error ? reject(error) : resolve(value);
    };
    imap.once("ready", async () => {
      try {
        await imapOpenBoxAsync(imap, "INBOX");
        const since = formatImapSearchDate(new Date(Date.now() - 7 * 86400000));
        const unread = await imapSearchAsync(imap, ["UNSEEN", ["SINCE", since]]);
        const fallback = unread.length ? unread : await imapSearchAsync(imap, [["SINCE", since]]);
        const latest = fallback.slice(-50);
        const messages = await fetchImapMessages(imap, latest);
        finish(null, messages);
      } catch (error) {
        finish(error);
      }
    });
    imap.once("error", (error) => finish(error));
    imap.connect();
  });
}

function findCustomerByReplyEmail(customers, fromEmail) {
  const target = normalizeAddress(fromEmail);
  if (!target) return null;
  return customers.find((customer) => {
    if (normalizeAddress(customer.contactEmail) === target) return true;
    if (normalizeAddress(customer.email) === target) return true;
    return normalizeCustomerEmailContacts(customer.emailContacts)
      .some((contact) => normalizeAddress(contact.email) === target);
  }) || null;
}

function applyInboxReplySignal(customers, customerId) {
  return customers.map((customer) => {
    if (customer.id !== customerId) return customer;
    const signals = Array.isArray(customer.businessSignals) ? customer.businessSignals : [];
    const hasReplySignal = signals.some((item) => {
      if (typeof item === "string") return /email_reply|客戶已回覆|客户已回复/i.test(item);
      return item?.type === "email_reply";
    });
    const currentScore = Number(customer.customerScore);
    const nextScore = Math.min(100, (Number.isFinite(currentScore) ? currentScore : 0) + 15);
    return {
      ...customer,
      businessSignals: hasReplySignal ? signals : [...signals, { type: "email_reply", value: "高潛力 - 客戶已回覆" }],
      customerScore: nextScore,
      nextFollowUpDate: todayPlusDays(2),
      followUpStatus: "pending"
    };
  });
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

function ensureUploadTempDir() {
  if (!fs.existsSync(UPLOAD_TEMP_DIR)) fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

function isPathInsideUploadTemp(filePath) {
  const resolved = path.resolve(filePath || "");
  const uploadRoot = path.resolve(UPLOAD_TEMP_DIR);
  return resolved === uploadRoot || resolved.startsWith(`${uploadRoot}${path.sep}`);
}

function safeUploadedMailAttachments(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && item.path && item.isUploadedFile)
    .map((item) => {
      const resolvedPath = path.resolve(String(item.path));
      if (!isPathInsideUploadTemp(resolvedPath) || !fs.existsSync(resolvedPath)) {
        throw new Error("Invalid or expired attachment file.");
      }
      return {
        filename: String(item.originalName || item.filename || "attachment"),
        path: resolvedPath,
        contentType: item.mimetype || undefined
      };
    });
}

function cleanupUploadedFiles(items = []) {
  // Uploaded files are temporary for one email send only. Successful sends remove them immediately.
  (Array.isArray(items) ? items : []).forEach((item) => {
    const filePath = item?.path ? path.resolve(String(item.path)) : "";
    if (!filePath || !isPathInsideUploadTemp(filePath)) return;
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.warn(`Temporary attachment cleanup failed: ${error.message}`);
    }
  });
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

app.get("/api/customers", (req, res) => {
  try {
    const { data } = readSharedStore();
    const customers = Array.isArray(data.phottix_customers) ? data.phottix_customers : [];
    res.json({
      success: true,
      customers: customers.map((customer) => ({
        ...customer,
        emailContacts: normalizeCustomerEmailContacts(customer.emailContacts)
      }))
    });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to load customers." });
  }
});

app.put("/api/customers/:id", (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      res.status(400).json({ success: false, error: "Missing customer id." });
      return;
    }
    const snapshot = readSharedStore();
    const customers = Array.isArray(snapshot.data.phottix_customers) ? snapshot.data.phottix_customers : [];
    const index = customers.findIndex((customer) => String(customer.id || "") === id);
    if (index < 0) {
      res.status(404).json({ success: false, error: "Customer not found." });
      return;
    }
    const nextCustomer = {
      ...customers[index],
      ...(req.body || {}),
      id,
      emailContacts: normalizeCustomerEmailContacts(req.body?.emailContacts ?? customers[index].emailContacts)
    };
    customers[index] = nextCustomer;
    writeSharedKey("phottix_customers", customers);
    res.json({ success: true, customer: nextCustomer });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to update customer." });
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

app.get("/api/custom-templates", (req, res) => {
  try {
    const rows = getSqliteDb()
      .prepare("SELECT id, name, subject, body, purpose, createdAt, updatedAt FROM custom_templates ORDER BY name COLLATE NOCASE")
      .all();
    res.json({ success: true, templates: rows.map(publicCustomTemplate) });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to load custom templates." });
  }
});

app.post("/api/custom-templates", (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const body = String(req.body?.body || "").trim();
    const purpose = String(req.body?.purpose || "custom").trim() || "custom";
    if (!name) {
      res.status(400).json({ success: false, error: "Template name is required." });
      return;
    }
    if (!subject || !body) {
      res.status(400).json({ success: false, error: "Template subject and body are required." });
      return;
    }
    const now = new Date().toISOString();
    const existing = getSqliteDb().prepare("SELECT id FROM custom_templates WHERE lower(name) = lower(?)").get(name);
    if (existing) {
      getSqliteDb().prepare(`
        UPDATE custom_templates
        SET subject = ?, body = ?, purpose = ?, updatedAt = ?
        WHERE id = ?
      `).run(subject, body, purpose, now, existing.id);
      const updated = getSqliteDb()
        .prepare("SELECT id, name, subject, body, purpose, createdAt, updatedAt FROM custom_templates WHERE id = ?")
        .get(existing.id);
      res.json({ success: true, updated: true, template: publicCustomTemplate(updated) });
      return;
    }
    const id = uid("template");
    getSqliteDb().prepare(`
      INSERT INTO custom_templates (id, name, subject, body, purpose, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, subject, body, purpose, now, now);
    const template = getSqliteDb()
      .prepare("SELECT id, name, subject, body, purpose, createdAt, updatedAt FROM custom_templates WHERE id = ?")
      .get(id);
    res.json({ success: true, updated: false, template: publicCustomTemplate(template) });
  } catch (error) {
    const message = String(error.message || "");
    const duplicate = /UNIQUE constraint failed/i.test(message);
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? "Template name already exists." : message || "Failed to save custom template." });
  }
});

app.put("/api/custom-templates/:id", (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const existing = getSqliteDb().prepare("SELECT id FROM custom_templates WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ success: false, error: "Custom template not found." });
      return;
    }
    const name = String(req.body?.name || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const body = String(req.body?.body || "").trim();
    const purpose = String(req.body?.purpose || "custom").trim() || "custom";
    if (!name) {
      res.status(400).json({ success: false, error: "Template name is required." });
      return;
    }
    if (!subject || !body) {
      res.status(400).json({ success: false, error: "Template subject and body are required." });
      return;
    }
    const duplicate = getSqliteDb()
      .prepare("SELECT id FROM custom_templates WHERE lower(name) = lower(?) AND id <> ?")
      .get(name, id);
    if (duplicate) {
      res.status(409).json({ success: false, error: "Template name already exists." });
      return;
    }
    getSqliteDb().prepare(`
      UPDATE custom_templates
      SET name = ?, subject = ?, body = ?, purpose = ?, updatedAt = ?
      WHERE id = ?
    `).run(name, subject, body, purpose, new Date().toISOString(), id);
    const template = getSqliteDb()
      .prepare("SELECT id, name, subject, body, purpose, createdAt, updatedAt FROM custom_templates WHERE id = ?")
      .get(id);
    res.json({ success: true, template: publicCustomTemplate(template) });
  } catch (error) {
    const message = String(error.message || "");
    const duplicate = /UNIQUE constraint failed/i.test(message);
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? "Template name already exists." : message || "Failed to update custom template." });
  }
});

app.delete("/api/custom-templates/:id", (req, res) => {
  try {
    const result = getSqliteDb().prepare("DELETE FROM custom_templates WHERE id = ?").run(String(req.params.id || ""));
    if (!result.changes) {
      res.status(404).json({ success: false, error: "Custom template not found." });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to delete custom template." });
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

app.post("/api/upload-attachments", (req, res) => {
  uploadAttachments.array("attachments", MAX_ATTACHMENT_COUNT)(req, res, (error) => {
    if (error) {
      const status = error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT" ? 400 : 400;
      res.status(status).json({ success: false, error: error.message || "Attachment upload failed." });
      return;
    }
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      res.status(400).json({ success: false, error: "No files selected." });
      return;
    }

    // Files are temporary and only used for the next email send. They are not saved to SQLite.
    res.json({
      success: true,
      files: files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        path: file.path,
        mimetype: file.mimetype,
        isUploadedFile: true
      }))
    });
  });
});

app.post("/api/send-email", async (req, res) => {
  const to = String(req.body?.to || "").trim();
  const cc = String(req.body?.cc || "").trim();
  const bcc = String(req.body?.bcc || "").trim();
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

    const mailAttachments = safeUploadedMailAttachments(attachments);
    const info = await transporter.sendMail({
      from,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      html,
      attachments: mailAttachments
    });
    cleanupUploadedFiles(attachments);
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

app.post("/api/sync-inbox", async (req, res) => {
  const missing = missingImapSettings();
  if (missing.includes("IMAP_PASS")) {
    res.status(503).json({ success: false, error: "IMAP 密碼未設定" });
    return;
  }
  if (missing.length) {
    res.status(503).json({ success: false, error: `IMAP 連線失敗，請檢查設定：${missing.join(", ")}` });
    return;
  }

  try {
    const messages = await syncInboxMessages();
    const snapshot = readSharedStore();
    let customers = Array.isArray(snapshot.data.phottix_customers) ? snapshot.data.phottix_customers : [];
    const logs = snapshot.data.phottix_followup_logs && typeof snapshot.data.phottix_followup_logs === "object"
      ? snapshot.data.phottix_followup_logs
      : {};
    let newReplies = 0;
    let failed = 0;
    const markedCustomers = new Set();

    for (const item of messages) {
      try {
        if (item.error) throw item.error;
        const parsed = item.parsed;
        const fromEmail = parsed.from?.value?.[0]?.address || "";
        const customer = findCustomerByReplyEmail(customers, fromEmail);
        if (!customer) continue;

        const messageId = String(parsed.messageId || item.attrs?.uid || `${fromEmail}-${parsed.date || ""}`).trim();
        const duplicate = Object.values(logs).some((log) => log.messageId && String(log.messageId) === messageId);
        if (duplicate) continue;

        const text = String(parsed.text || parsed.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const logId = uid("log");
        const receivedAt = parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString();
        logs[logId] = {
          logId,
          customerId: customer.id,
          logDate: receivedAt.slice(0, 10),
          channel: "Email",
          type: "email_received",
          signal: "high_potential",
          messageId,
          contactPerson: fromEmail,
          subject: parsed.subject || "(No subject)",
          summary: `客戶回信：${parsed.subject || "(No subject)"}\n${text.slice(0, 500)}`,
          content: text.slice(0, 500),
          response: "positive",
          nextAction: "High-potential reply detected. Follow up within 2 days.",
          nextFollowUpDate: todayPlusDays(2),
          status: "pending",
          receivedAt,
          createdAt: new Date().toISOString()
        };
        customers = applyInboxReplySignal(customers, customer.id);
        markedCustomers.add(customer.id);
        newReplies += 1;
      } catch (error) {
        failed += 1;
        console.warn(`Inbox message skipped: ${error.message}`);
      }
    }

    writeSharedSnapshot({
      ...snapshot.data,
      phottix_customers: customers,
      phottix_followup_logs: logs
    });

    res.json({
      success: true,
      processed: messages.length,
      newReplies,
      markedCustomers: markedCustomers.size,
      failed
    });
  } catch (error) {
    console.error(`IMAP sync failed: ${error.message}`);
    res.status(503).json({ success: false, error: "IMAP 連線失敗，請檢查設定", details: error.message });
  }
});

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

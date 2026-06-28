const express = require("express");
const axios = require("axios");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 8787);
const CONFIG_PATH = path.join(__dirname, "config.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const DEFAULT_CONFIG = { import_folder: "./imports/" };

ensureImportFolder();

app.use(express.json({ limit: "10mb" }));
app.use(express.static(PUBLIC_DIR, {
  etag: false,
  maxAge: 0,
  setHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  }
}));

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

function summarizeContent(text) {
  const lines = String(text || "")
    .split(/[。！？.!?\n]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 20 && !/cookie|privacy policy|terms of use|javascript/i.test(line));
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
  try {
    res.json({ success: true, files: listExcelFiles() });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || "Failed to list import files." });
  }
});

app.get("/list-excel", (req, res) => {
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

app.post("/api/parse-excel-config", (req, res) => {
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

// TODO: 郵件附件上傳功能預留
// POST /api/upload-attachment
// - 接收 multipart/form-data 檔案
// - 儲存至 ./uploads/ 或雲端
// - 回傳檔案 metadata (name, size, path)
// 目前此路由尚未實作，僅供未來擴充

app.use((req, res) => {
  res.status(404).send("Not Found");
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Phottix Customer Agent listening on http://127.0.0.1:${PORT}`);
});

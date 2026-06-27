const express = require("express");
const axios = require("axios");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const PORT = Number(process.env.PORT || 8787);

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname, {
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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok" });
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

app.post("/api/parse-excel", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "Missing Excel file." });
      return;
    }
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    res.json({ success: true, sheetName, rows });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || "Failed to parse Excel." });
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

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found." });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Phottix Customer Agent listening on http://127.0.0.1:${PORT}`);
});

require("dotenv").config({ quiet: true, override: true });
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
const { createAssetStorage, safeObjectKey } = require("./asset-storage");
const { classifyRows } = require("./public/customer-classification");

const app = express();
const PORT = Number(process.env.PORT || 8787);
const HOST = String(process.env.HOST || process.env.APP_HOST || "127.0.0.1").trim();
const CONFIG_PATH = path.join(__dirname, "config.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const SQLITE_PATH = path.join(DATA_DIR, "phottix.sqlite");
const BACKUP_DIR = path.join(__dirname, "backups");
const UPLOAD_TEMP_DIR = path.join(__dirname, "uploads", "temp");
const ASSET_LOCAL_DIR = path.join(__dirname, "uploads", "library");
const DEFAULT_CONFIG = { import_folder: "./imports/" };
const DEFAULT_LIVE_SYNC_SOURCE = "https://agent.phottix.cn";
const IV_LENGTH = 16;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const MAX_ASSET_SIZE = 200 * 1024 * 1024;
const MAX_ASSET_COUNT = 10;
const ASSET_SIGNED_URL_EXPIRES_SEC = 600;
const DEFAULT_CUSTOMER_GROUPS = [
  { id: "old_customers", name: "Old customers" }
];
const CUSTOMER_VISIBILITY_ROLES = [
  "admin", "sales", "sales_manager", "marketing_manager",
  "product_manager", "finance_manager", "shipping_manager"
];
const ASSET_CATEGORIES = new Set([
  "price_lists",
  "product_images",
  "product_videos",
  "product_documents",
  "email_templates",
  "shared_files"
]);
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".heic",
  ".heif",
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx"
]);
const SHARED_STORAGE_KEYS = [
  "phottix_customers",
  "phottix_products",
  "phottix_followup_logs",
  "phottix_email_templates",
  "phottix_settings",
  "phottix_auto_backups",
  "phottix_analysis_history",
  "phottix_error_logs",
  "phottix_customer_import_reviews"
];
const LIVE_SYNC_KEY_MAP = {
  customers: "phottix_customers",
  products: "phottix_products",
  logs: "phottix_followup_logs",
  templates: "phottix_email_templates",
  settings: "phottix_settings",
  analysisHistory: "phottix_analysis_history",
  errorLogs: "phottix_error_logs"
};
const LIVE_SYNC_ALIAS_MAP = {
  all: "all",
  customers: "customers",
  phottixcustomers: "customers",
  products: "products",
  phottixproducts: "products",
  logs: "logs",
  followuplogs: "logs",
  phottixfollowuplogs: "logs",
  templates: "templates",
  emailtemplates: "templates",
  phottixemailtemplates: "templates",
  settings: "settings",
  phottixsettings: "settings",
  analysishistory: "analysisHistory",
  phottixanalysishistory: "analysisHistory",
  errorlogs: "errorLogs",
  phottixerrorlogs: "errorLogs"
};

const APP_AUTH_USER = String(process.env.APP_AUTH_USER || "").trim();
const APP_AUTH_PASS = String(process.env.APP_AUTH_PASS || "").trim();
const APP_AUTH_SENDERS = String(process.env.APP_AUTH_SENDERS || "").trim();
const SESSION_COOKIE_NAME = "phottix_v11_session";
const SESSION_TTL_MS = Math.max(1, Number(process.env.APP_SESSION_TTL_HOURS || 12)) * 60 * 60 * 1000;
const APP_SESSION_SECRET = String(process.env.APP_SESSION_SECRET || process.env.ENCRYPTION_KEY || APP_AUTH_PASS || "phottix-local-session-secret").trim();
const assetStorage = createAssetStorage({ provider: process.env.STORAGE_PROVIDER || "local", localRoot: ASSET_LOCAL_DIR });

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
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (ALLOWED_ATTACHMENT_TYPES.has(file.mimetype) || ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
      cb(null, true);
      return;
    }
    cb(new Error("Unsupported file type. Please upload PDF, Word, Excel, JPEG, PNG, GIF, HEIC, or HEIF files."));
  }
});

const uploadCustomerExcel = multer({
  storage: attachmentStorage,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if ([".xlsx", ".xls", ".csv"].includes(extension)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only .xlsx, .xls, or .csv customer files are supported."));
  }
});

app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.get("/login", renderLoginPage);
app.post("/login", handleLogin);
app.get("/logout", handleLogout);
app.post("/logout", handleLogout);
app.use(appAuthMiddleware);
app.use(express.json({ limit: "50mb" }));
app.use(express.static(PUBLIC_DIR, {
  etag: false,
  maxAge: 0,
  setHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  }
}));

let sqliteDb = null;

function safeEqualText(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ""), "utf8");
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const text = String(stored || "");
  if (!text.startsWith("scrypt:")) return safeEqualText(password, text);
  const [, salt, hash] = text.split(":");
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return safeEqualText(actual, hash);
}

function parseEmailList(value) {
  return String(value || "")
    .split(/[,\n;]/)
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (role === "admin") return "admin";
  if (role === "sales" || role === "salesperson" || role === "sales_person" || role === "user") return "sales";
  if (role === "sales_manager" || role === "sales-manager" || role === "sales manager") return "sales_manager";
  if (role === "marketing_manager" || role === "marketing-manager" || role === "marketing manager") return "marketing_manager";
  if (role === "product_manager" || role === "product-manager" || role === "product manager") return "product_manager";
  if (role === "finance_manager" || role === "finance-manager" || role === "finance manager") return "finance_manager";
  if (role === "shipping_manager" || role === "shipping-manager" || role === "shipping manager") return "shipping_manager";
  return "sales";
}

function roleLabel(role) {
  return {
    admin: "Admin",
    sales: "Sales",
    sales_manager: "Sales Manager",
    marketing_manager: "Marketing Manager",
    product_manager: "Product Manager",
    finance_manager: "Finance Manager",
    shipping_manager: "Shipping Manager"
  }[normalizeRole(role)] || "Sales";
}

function normalizePosition(value) {
  return String(value || "").trim();
}

const XIAOHONGSHU_POSITION = "小红书管理员";

function canManageUsers(req) {
  return ["admin", "marketing_manager"].includes(currentRole(req));
}

function canManageEmailTemplates(req) {
  const role = currentRole(req);
  if (["admin", "sales_manager"].includes(role)) return true;
  return role === "sales"
    && String(req.appUserRecord?.username || req.appUser || "").trim().toLowerCase() === "gina";
}

function canMarketingManagerManageUser(req, user) {
  if (currentRole(req) !== "marketing_manager") return false;
  return normalizeRole(user?.role) === "sales"
    && normalizePosition(user?.position) === XIAOHONGSHU_POSITION;
}

function configuredUsers() {
  const users = [];
  if (APP_AUTH_USER && APP_AUTH_PASS) {
    users.push({
      username: APP_AUTH_USER,
      password: APP_AUTH_PASS,
      displayName: APP_AUTH_USER,
      email: normalizeEmail(process.env.APP_AUTH_EMAIL),
      role: "admin",
      position: "",
      managerUsername: "",
      senderEmails: parseEmailList(APP_AUTH_SENDERS || process.env.APP_AUTH_EMAIL)
    });
  }

  const rawUsers = String(process.env.APP_USERS_JSON || "").trim();
  if (rawUsers) {
    try {
      const parsed = JSON.parse(rawUsers);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          const username = String(item?.username || "").trim();
          const password = String(item?.password || "");
          if (!username || !password) return;
          const email = normalizeEmail(item.email);
          const senderEmails = Array.isArray(item.senderEmails)
            ? item.senderEmails.map((value) => normalizeEmail(value)).filter(Boolean)
            : parseEmailList(item.senderEmails || item.senderEmail || email);
          users.push({
            username,
            password,
            displayName: String(item.displayName || username).trim(),
            email,
            role: normalizeRole(item.role),
            position: normalizePosition(item.position),
            managerUsername: String(item.managerUsername || item.manager_username || "").trim(),
            senderEmails
          });
        });
      }
    } catch (error) {
      console.warn(`APP_USERS_JSON ignored: ${error.message}`);
    }
  }

  try {
    readDbUsers().forEach((item) => users.push(item));
  } catch (error) {
    console.warn(`SQLite users ignored: ${error.message}`);
  }

  const seen = new Set();
  return users.filter((user) => {
    const key = user.username.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readDbUsers() {
  const rows = getSqliteDb().prepare(`
    SELECT id, username, password_hash, display_name, email, role, position, manager_username, sender_emails, is_active, created_at, updated_at, last_login
    FROM users
    WHERE is_active = 1
    ORDER BY username COLLATE NOCASE
  `).all();
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    displayName: row.display_name || row.username,
    email: normalizeEmail(row.email),
    role: normalizeRole(row.role),
    position: normalizePosition(row.position),
    managerUsername: String(row.manager_username || "").trim(),
    senderEmails: parseEmailList(row.sender_emails || row.email),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLogin: row.last_login,
    source: "sqlite"
  }));
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.displayName || row.username,
    email: row.email || "",
    role: normalizeRole(row.role),
    roleLabel: roleLabel(row.role),
    position: normalizePosition(row.position),
    managerUsername: String(row.manager_username || row.managerUsername || "").trim(),
    senderEmails: parseEmailList(row.sender_emails || row.senderEmails || ""),
    isActive: row.is_active === undefined ? Boolean(row.isActive ?? true) : Boolean(row.is_active),
    createdAt: row.created_at || row.createdAt || "",
    updatedAt: row.updated_at || row.updatedAt || "",
    lastLogin: row.last_login || row.lastLogin || "",
    source: row.source || "sqlite"
  };
}

function findConfiguredUser(username) {
  const target = String(username || "").trim().toLowerCase();
  return configuredUsers().find((user) => user.username.toLowerCase() === target) || null;
}

function isAppAuthEnabled() {
  return configuredUsers().length > 0;
}

function senderAllowedForUser(user, sender) {
  if (!user) return false;
  const senderEmail = normalizeEmail(sender?.email);
  if (!senderEmail) return false;
  const allowedEmails = Array.isArray(user.senderEmails) ? user.senderEmails.map((email) => normalizeEmail(email)).filter(Boolean) : [];
  if (allowedEmails.length) return allowedEmails.includes(senderEmail);
  if (user.email) return normalizeEmail(user.email) === senderEmail;
  return user.role === "admin";
}

function appAuthMiddleware(req, res, next) {
  // Optional production guard: set APP_AUTH_USER/APP_AUTH_PASS or APP_USERS_JSON in .env.
  // /health stays public so the host can monitor whether the Node.js process is alive.
  if (!isAppAuthEnabled() || req.path === "/health") {
    next();
    return;
  }

  if (isHostImportRequest(req)) {
    req.appUser = "localhost";
    req.appUserRecord = {
      username: "localhost",
      user: "localhost",
      displayName: "Local Admin",
      email: "",
      role: "admin",
      senderEmails: []
    };
    next();
    return;
  }

  const session = getValidSession(req);
  if (session) {
    req.appUser = session.user;
    req.appUserRecord = session;
    next();
    return;
  }

  if (wantsJson(req)) {
    res.status(401).json({ success: false, error: "Authentication required.", loginUrl: "/login" });
    return;
  }

  const returnTo = encodeURIComponent(safeReturnTo(req.originalUrl || "/"));
  res.redirect(`/login?returnTo=${returnTo}`);
}

function wantsJson(req) {
  return req.path.startsWith("/api/")
    || req.path === "/list-excel"
    || req.xhr
    || String(req.headers.accept || "").includes("application/json");
}

function parseCookies(req) {
  const header = String(req.headers.cookie || "");
  return header.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index < 0) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
    }
    return cookies;
  }, {});
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function signSessionPayload(encodedPayload) {
  return crypto
    .createHmac("sha256", APP_SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createSessionToken(user) {
  const payload = base64UrlEncode(JSON.stringify({
    user: user.username,
    displayName: user.displayName || user.username,
    email: user.email || "",
    role: user.role || "sales",
    position: user.position || "",
    managerUsername: user.managerUsername || "",
    senderEmails: user.senderEmails || [],
    exp: Date.now() + SESSION_TTL_MS
  }));
  return `${payload}.${signSessionPayload(payload)}`;
}

function getValidSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE_NAME];
  if (!token || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqualText(signature, signSessionPayload(payload))) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload));
    if (!session?.user || Number(session.exp || 0) < Date.now()) return null;
    const currentUser = findConfiguredUser(session.user);
    if (!currentUser) return null;
    return {
      ...currentUser,
      user: currentUser.username,
      exp: Number(session.exp || 0)
    };
  } catch {
    return null;
  }
}

function isSecureRequest(req) {
  return req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

function sessionCookie(token, req) {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function safeReturnTo(value) {
  const fallback = "/";
  const target = String(value || fallback).trim();
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/login")) return fallback;
  return target;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLoginPage(req, res) {
  if (isAppAuthEnabled() && getValidSession(req)) {
    res.redirect(safeReturnTo(req.query?.returnTo || "/"));
    return;
  }

  const error = req.query?.error ? "帳號或密碼不正確 / Invalid username or password." : "";
  const returnTo = safeReturnTo(req.query?.returnTo || "/");
  res.type("html").send(`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login - Phottix Customer Agent</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7fbff;
      --card: #ffffff;
      --text: #1f2937;
      --muted: #64748b;
      --line: #dbeafe;
      --blue: #3d8fda;
      --blue-dark: #1d6fbf;
      --soft-blue: #ebf6ff;
      --danger: #d55b5b;
    }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 18% 12%, rgba(91, 176, 230, 0.22), transparent 28%),
        radial-gradient(circle at 82% 82%, rgba(116, 208, 160, 0.2), transparent 30%),
        var(--bg);
      color: var(--text);
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
    }
    .login-card {
      width: min(92vw, 420px);
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 24px 70px rgba(45, 89, 140, 0.16);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 24px;
    }
    .brand-mark {
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: linear-gradient(135deg, #dff3ff, #c9f3df);
      color: #1b74b7;
      font-weight: 800;
      box-shadow: inset 0 0 0 1px rgba(61, 143, 218, 0.16);
    }
    h1 {
      margin: 0;
      font-size: 1.35rem;
      line-height: 1.2;
    }
    p {
      margin: 5px 0 0;
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.45;
    }
    label {
      display: grid;
      gap: 8px;
      margin-top: 16px;
      color: #334155;
      font-size: 0.82rem;
      font-weight: 700;
    }
    input {
      width: 100%;
      min-height: 44px;
      padding: 10px 12px;
      border: 1px solid #d7e6f7;
      border-radius: 12px;
      background: #fbfdff;
      color: var(--text);
      font: inherit;
      outline: none;
    }
    input:focus {
      border-color: var(--blue);
      box-shadow: 0 0 0 4px rgba(61, 143, 218, 0.14);
    }
    button {
      width: 100%;
      min-height: 46px;
      margin-top: 20px;
      border: 0;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--blue), var(--blue-dark));
      color: #fff;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.01em;
      box-shadow: 0 14px 28px rgba(61, 143, 218, 0.24);
    }
    button:hover { filter: brightness(1.03); }
    .error {
      margin-top: 14px;
      padding: 10px 12px;
      border: 1px solid rgba(213, 91, 91, 0.22);
      border-radius: 12px;
      background: #fff5f5;
      color: var(--danger);
      font-size: 0.82rem;
      font-weight: 700;
    }
    .note {
      margin-top: 16px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--soft-blue);
      color: #496179;
      font-size: 0.78rem;
    }
  </style>
</head>
<body>
  <main class="login-card">
    <div class="brand">
      <span class="brand-mark">P</span>
      <div>
        <h1>Phottix Customer Agent</h1>
        <p>V1.1 secure workspace login</p>
      </div>
    </div>
    <form method="post" action="/login" autocomplete="on">
      <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
      <label>帳號 / Username
        <input name="username" autocomplete="username" required autofocus>
      </label>
      <label>密碼 / Password
        <input name="password" type="password" autocomplete="current-password" required>
      </label>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
      <button type="submit">登入 / Login</button>
    </form>
    <div class="note">For internal Phottix team use only. Please logout after using a shared computer.</div>
  </main>
</body>
</html>`);
}

function handleLogin(req, res) {
  if (!isAppAuthEnabled()) {
    res.redirect(safeReturnTo(req.body?.returnTo || "/"));
    return;
  }

  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const returnTo = safeReturnTo(req.body?.returnTo || "/");
  const user = findConfiguredUser(username);

  if (!user || !verifyPassword(password, user.passwordHash || user.password)) {
    res.redirect(`/login?error=1&returnTo=${encodeURIComponent(returnTo)}`);
    return;
  }

  logAudit({ ...req, appUser: user.username, appUserRecord: user }, "LOGIN", "user", user.username, user.displayName || user.username, { success: true });
  if (user.source === "sqlite") {
    try {
      getSqliteDb().prepare("UPDATE users SET last_login = ?, updated_at = ? WHERE username = ?")
        .run(new Date().toISOString(), new Date().toISOString(), user.username);
    } catch (error) {
      console.warn(`User last_login update skipped: ${error.message}`);
    }
  }
  res.setHeader("Set-Cookie", sessionCookie(createSessionToken(user), req));
  res.redirect(returnTo);
}

function handleLogout(req, res) {
  const session = getValidSession(req);
  if (session) {
    logAudit({ ...req, appUser: session.username || session.user, appUserRecord: session }, "LOGOUT", "user", session.username || session.user, session.displayName || session.user, {});
  }
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.redirect("/login");
}

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
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT,
      visible_roles TEXT
    )
  `);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      target_name TEXT,
      details TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT
    )
  `);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      created_at TEXT
    )
  `);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      email TEXT,
      role TEXT DEFAULT 'sales',
      position TEXT,
      manager_username TEXT,
      sender_emails TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      last_login TEXT
    )
  `);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS asset_library (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      oss_key TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      sku TEXT,
      file_type TEXT,
      mime_type TEXT,
      file_size INTEGER DEFAULT 0,
      uploaded_by TEXT,
      uploaded_by_name TEXT,
      uploaded_at TEXT,
      updated_at TEXT,
      version INTEGER DEFAULT 1,
      is_current INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      checksum TEXT,
      created_at TEXT
    )
  `);
  ensureOptionalCustomerGroupColumn(sqliteDb);
  ensureGroupVisibilityColumn(sqliteDb);
  ensureOptionalUserColumns(sqliteDb);
  ensureDefaultCustomerGroups(sqliteDb);
  seedDefaultSender(sqliteDb);
  return sqliteDb;
}

function defaultGroupVisibleRoles(name) {
  const normalizedName = String(name || "").toLowerCase().replace(/[\s_-]+/g, "");
  return CUSTOMER_VISIBILITY_ROLES.filter((role) => !(normalizedName === "procustomers" && role === "sales"));
}
function normalizeVisibleRoles(value, groupName = "") {
  let roles = value;
  if (typeof roles === "string") { try { roles = JSON.parse(roles); } catch { roles = roles.split(","); } }
  if (!Array.isArray(roles)) roles = defaultGroupVisibleRoles(groupName);
  const normalized = new Set(roles.map((role) => normalizeRole(role)));
  normalized.add("admin");
  return CUSTOMER_VISIBILITY_ROLES.filter((role) => normalized.has(role));
}
function ensureGroupVisibilityColumn(db) {
  try {
    const columns = db.prepare("PRAGMA table_info(groups)").all();
    if (!columns.some((column) => column.name === "visible_roles")) db.exec("ALTER TABLE groups ADD COLUMN visible_roles TEXT");
    const rows = db.prepare("SELECT id, name, visible_roles FROM groups").all();
    const update = db.prepare("UPDATE groups SET visible_roles = ? WHERE id = ?");
    rows.forEach((row) => { if (!String(row.visible_roles || "").trim()) update.run(JSON.stringify(defaultGroupVisibleRoles(row.name)), row.id); });
  } catch (error) { console.warn("Optional groups.visible_roles migration skipped: " + error.message); }
}
function ensureOptionalCustomerGroupColumn(db) {
  try {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'customers'").get();
    if (!table) return;
    const columns = db.prepare("PRAGMA table_info(customers)").all();
    if (!columns.some((column) => column.name === "group_id")) {
      db.exec("ALTER TABLE customers ADD COLUMN group_id TEXT");
    }
  } catch (error) {
    console.warn(`Optional customers.group_id migration skipped: ${error.message}`);
  }
}

function ensureOptionalUserColumns(db) {
  try {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
    if (!table) return;
    const columns = db.prepare("PRAGMA table_info(users)").all();
    if (!columns.some((column) => column.name === "position")) {
      db.exec("ALTER TABLE users ADD COLUMN position TEXT");
    }
    if (!columns.some((column) => column.name === "manager_username")) {
      db.exec("ALTER TABLE users ADD COLUMN manager_username TEXT");
    }
    db.prepare("UPDATE users SET role = 'sales' WHERE lower(COALESCE(role, '')) = 'user'").run();
  } catch (error) {
    console.warn('Optional users role migration skipped: ' + error.message)
  }
}

function ensureDefaultCustomerGroups(db) {
  try {
    const insert = db.prepare("INSERT OR IGNORE INTO groups (id, name, created_at) VALUES (?, ?, ?)");
    for (const group of DEFAULT_CUSTOMER_GROUPS) {
      const existing = db.prepare("SELECT id, name FROM groups").all()
        .find((row) => isOldCustomerGroupName(row.name));
      if (!existing) insert.run(group.id, group.name, new Date().toISOString());
    }
  } catch (error) {
    console.warn(`Default customer group migration skipped: ${error.message}`);
  }
}

function isOldCustomerGroupName(value) {
  const text = String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
  return text.includes("oldcustomers") || text.includes("oldcustomer") || text.includes("旧客户") || text.includes("舊客戶");
}

function consolidateOldCustomerGroups() {
  const db = getSqliteDb();
  const groups = db.prepare("SELECT id, name FROM groups ORDER BY created_at, id").all();
  const oldGroups = groups.filter((group) => isOldCustomerGroupName(group.name));
  if (!oldGroups.length) return null;

  const canonical = oldGroups.find((group) => group.id === "old_customers") || oldGroups[0];
  const aliases = oldGroups.filter((group) => group.id !== canonical.id).map((group) => group.id);
  if (canonical.name !== "Old customers") {
    db.prepare("UPDATE groups SET name = ? WHERE id = ?").run("Old customers", canonical.id);
  }
  if (aliases.length) {
    const aliasSet = new Set(aliases);
    const snapshot = readSharedStore();
    const customers = Array.isArray(snapshot.data.phottix_customers) ? snapshot.data.phottix_customers : [];
    const updatedCustomers = customers.map((customer) => {
      const groupId = String(customer.groupId || customer.group_id || "");
      if (!aliasSet.has(groupId)) return customer;
      return { ...customer, groupId: canonical.id, group_id: canonical.id };
    });
    if (updatedCustomers.some((customer, index) => customer !== customers[index])) {
      writeSharedKey("phottix_customers", updatedCustomers);
    }
    const deleteStatement = db.prepare("DELETE FROM groups WHERE id = ?");
    aliases.forEach((id) => deleteStatement.run(id));
  }
  return canonical.id;
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

function publicSenderForRequest(row, req) {
  return {
    ...publicSender(row),
    canUse: !isAppAuthEnabled() || isHostImportRequest(req) || senderAllowedForUser(req.appUserRecord, row)
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

function publicGroup(row) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    visibleRoles: normalizeVisibleRoles(row.visible_roles, row.name)
  };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeGroupId(value) {
  const text = String(value || "").trim();
  return text && text !== "null" && text !== "__ungrouped__" ? text : "";
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

function writeSharedSnapshot(data, selectedKeys = SHARED_STORAGE_KEYS) {
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
  const keysToWrite = Array.isArray(selectedKeys) && selectedKeys.length ? selectedKeys : SHARED_STORAGE_KEYS;
  db.exec("BEGIN");
  try {
    keysToWrite.forEach((key) => {
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

function clientIp(req) {
  return String(req?.headers?.["x-forwarded-for"] || req?.ip || req?.connection?.remoteAddress || "unknown").split(",")[0].trim();
}

function auditUser(req) {
  return {
    userId: req?.appUserRecord?.username || req?.appUser || "",
    username: req?.appUserRecord?.username || req?.appUser || "anonymous"
  };
}

function logAudit(req, action, targetType, targetId, targetName, details = {}) {
  const entry = {
    id: uid("audit"),
    ...auditUser(req),
    action: String(action || "").trim().toUpperCase(),
    targetType: String(targetType || "").trim(),
    targetId: String(targetId || "").trim(),
    targetName: String(targetName || "").trim(),
    details,
    ip: clientIp(req),
    userAgent: String(req?.headers?.["user-agent"] || "unknown"),
    createdAt: new Date().toISOString()
  };
  setImmediate(() => {
    try {
      getSqliteDb().prepare(`
        INSERT INTO audit_logs (id, user_id, username, action, target_type, target_id, target_name, details, ip, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.id,
        entry.userId,
        entry.username,
        entry.action,
        entry.targetType,
        entry.targetId,
        entry.targetName,
        JSON.stringify(entry.details || {}),
        entry.ip,
        entry.userAgent,
        entry.createdAt
      );
    } catch (error) {
      console.warn(`Audit log skipped: ${error.message}`);
    }
  });
}

function normalizeAssetCategory(value) {
  const category = String(value || "shared_files").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  return ASSET_CATEGORIES.has(category) ? category : "shared_files";
}

function safeAssetPart(value, fallback = "general") {
  const normalized = String(value || fallback).trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^[-.]+|[-.]+$/g, "").slice(0, 80) || fallback;
}

function assetFileType(mimetype, originalName) {
  const type = String(mimetype || "").toLowerCase();
  const extension = path.extname(originalName || "").toLowerCase();
  if (type.startsWith("video/") || [".mp4", ".mov", ".m4v", ".webm"].includes(extension)) return "video";
  if (type.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".heic", ".heif"].includes(extension)) return "image";
  if (type.includes("pdf") || extension === ".pdf") return "pdf";
  if (type.includes("word") || [".doc", ".docx"].includes(extension)) return "word";
  if (type.includes("sheet") || type.includes("excel") || [".xls", ".xlsx"].includes(extension)) return "excel";
  return "file";
}

function assetObjectKey(category, sku, version, originalName) {
  const extension = path.extname(originalName || "").toLowerCase();
  const safeName = safeAssetPart(path.basename(originalName || "asset"), "asset");
  return safeObjectKey(`${category}/${safeAssetPart(sku, "general")}/${Date.now()}-v${version}-${uid("asset").slice(-8)}-${safeName}${extension && !safeName.toLowerCase().endsWith(extension) ? extension : ""}`);
}

function publicAsset(row) {
  return {
    id: row.id,
    originalName: row.original_name,
    objectKey: row.oss_key,
    category: row.category,
    sku: row.sku || "",
    fileType: row.file_type || "file",
    mimeType: row.mime_type || "application/octet-stream",
    fileSize: Number(row.file_size || 0),
    uploadedBy: row.uploaded_by || "",
    uploadedByName: row.uploaded_by_name || row.uploaded_by || "",
    uploadedAt: row.uploaded_at || row.created_at || "",
    updatedAt: row.updated_at || row.uploaded_at || row.created_at || "",
    version: Number(row.version || 1),
    isCurrent: Boolean(row.is_current),
    status: row.status || "active",
    storageProvider: assetStorage.provider
  };
}

function findAsset(id, includeInactive = false) {
  const query = includeInactive
    ? "SELECT * FROM asset_library WHERE id = ?"
    : "SELECT * FROM asset_library WHERE id = ? AND status = 'active'";
  return getSqliteDb().prepare(query).get(String(id || ""));
}

function assetCanManage(req) {
  return ["admin", "product_manager"].includes(currentRole(req));
}

function assetUploader(req) {
  return {
    username: String(req.appUserRecord?.username || req.appUser || "localhost").trim(),
    displayName: String(req.appUserRecord?.displayName || req.appUserRecord?.username || req.appUser || "Local Admin").trim()
  };
}

function assetTempPath(fileName = "asset") {
  return path.join(UPLOAD_TEMP_DIR, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeAssetPart(fileName, "asset")}`);
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((file) => /^phottix_backup_\d{4}-\d{2}-\d{2}(?:_\d{6})?\.sqlite$/.test(file))
    .map((file) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        file,
        path: filePath,
        sizeBytes: stats.size,
        createdAt: stats.birthtime?.toISOString?.() || stats.mtime.toISOString(),
        modifiedAt: stats.mtime.toISOString()
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

function cleanupOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const backup of listBackups()) {
    if (new Date(backup.modifiedAt).getTime() < cutoff) {
      fs.unlinkSync(backup.path);
    }
  }
}

function localDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

function createBackup(reason = "scheduled", req = null) {
  if (!fs.existsSync(SQLITE_PATH)) throw new Error("SQLite database file does not exist yet.");
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  getSqliteDb().exec("PRAGMA wal_checkpoint(FULL)");
  const dateStr = localDateStamp();
  const backupPath = path.join(BACKUP_DIR, `phottix_backup_${dateStr}.sqlite`);
  fs.copyFileSync(SQLITE_PATH, backupPath);
  cleanupOldBackups();
  const stats = fs.statSync(backupPath);
  const createdAt = new Date().toISOString();
  getSqliteDb().prepare(`
    INSERT INTO backup_runs (id, file_name, file_path, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(uid("backup"), path.basename(backupPath), backupPath, stats.size, createdAt);
  logAudit(req, "BACKUP", "system", "sqlite", path.basename(backupPath), { reason, sizeBytes: stats.size });
  console.log(`SQLite backup completed: ${backupPath}`);
  return { file: path.basename(backupPath), path: backupPath, sizeBytes: stats.size, createdAt };
}

function msUntilNextBackup(hour = 2) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function scheduleDailyBackup() {
  setTimeout(() => {
    try {
      createBackup("scheduled");
    } catch (error) {
      console.warn(`Scheduled backup failed: ${error.message}`);
    } finally {
      scheduleDailyBackup();
    }
  }, msUntilNextBackup(2)).unref?.();
}

function normalizeLiveSyncSectionKey(value) {
  const text = String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  return LIVE_SYNC_ALIAS_MAP[text] || "";
}

function normalizeLiveSyncSections(values) {
  const input = Array.isArray(values) ? values : [];
  const normalized = input.map((value) => normalizeLiveSyncSectionKey(value)).filter(Boolean);
  if (!normalized.length || normalized.includes("all")) {
    return Object.keys(LIVE_SYNC_KEY_MAP);
  }
  return [...new Set(normalized.filter((value) => Object.prototype.hasOwnProperty.call(LIVE_SYNC_KEY_MAP, value)))];
}

function countSnapshotData(data = {}) {
  return {
    customers: Array.isArray(data.phottix_customers) ? data.phottix_customers.length : 0,
    products: Array.isArray(data.phottix_products) ? data.phottix_products.length : 0,
    logs: data.phottix_followup_logs && typeof data.phottix_followup_logs === "object" ? Object.keys(data.phottix_followup_logs).length : 0,
    templates: data.phottix_email_templates && typeof data.phottix_email_templates === "object" ? Object.keys(data.phottix_email_templates).length : 0,
    settings: data.phottix_settings && typeof data.phottix_settings === "object" ? 1 : 0,
    analysisHistory: data.phottix_analysis_history && typeof data.phottix_analysis_history === "object" ? Object.keys(data.phottix_analysis_history).length : 0,
    errorLogs: Array.isArray(data.phottix_error_logs) ? data.phottix_error_logs.length : 0
  };
}

function customerSnapshotRemovesRecords(beforeValue, afterValue) {
  if (!Array.isArray(beforeValue) || !Array.isArray(afterValue)) return false;
  const beforeIds = new Set(beforeValue.map((item) => String(item?.id || "")).filter(Boolean));
  if (!beforeIds.size) return false;
  const afterIds = new Set(afterValue.map((item) => String(item?.id || "")).filter(Boolean));
  return [...beforeIds].some((id) => !afterIds.has(id));
}

function pickSnapshotData(data = {}, sections = []) {
  const selectedSections = normalizeLiveSyncSections(sections);
  const next = {};
  selectedSections.forEach((section) => {
    const key = LIVE_SYNC_KEY_MAP[section];
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      next[key] = data[key];
    }
  });
  return next;
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

function currentRole(req) {
  if (isHostImportRequest(req)) return "admin";
  return normalizeRole(req.appUserRecord?.role);
}

function hasRole(req, allowedRoles = []) {
  const allowed = new Set((Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map((role) => normalizeRole(role)));
  return allowed.has(currentRole(req));
}

function isAdminRequest(req) {
  return hasRole(req, ["admin"]);
}

function customerGroupRows() {
  return getSqliteDb().prepare("SELECT id, name, created_at, visible_roles FROM groups ORDER BY name COLLATE NOCASE").all();
}
function visibleCustomerGroupIds(req) {
  const role = currentRole(req);
  return new Set(customerGroupRows().filter((group) => normalizeVisibleRoles(group.visible_roles, group.name).includes(role)).map((group) => String(group.id)));
}
function canViewGroupId(req, groupId) {
  const normalizedId = normalizeGroupId(groupId);
  return !normalizedId || isAdminRequest(req) || visibleCustomerGroupIds(req).has(normalizedId);
}
function canViewCustomer(req, customer) {
  if (isAdminRequest(req)) return true;
  const groupId = normalizeGroupId(customer?.groupId || customer?.group_id);
  return !groupId || visibleCustomerGroupIds(req).has(groupId);
}
function visibleCustomers(req, customers) {
  return (Array.isArray(customers) ? customers : []).filter((customer) => canViewCustomer(req, customer));
}
function publicCustomer(customer) {
  return { ...customer, groupId: normalizeGroupId(customer.groupId || customer.group_id), group_id: normalizeGroupId(customer.group_id || customer.groupId), emailContacts: normalizeCustomerEmailContacts(customer.emailContacts) };
}
function rejectHiddenCustomer(req, res, customer) {
  if (customer && canViewCustomer(req, customer)) return false;
  res.status(404).json({ success: false, error: "Customer not found." });
  return true;
}
function rejectRole(req, res, allowedRoles, message = "Permission denied.") {
  if (hasRole(req, allowedRoles)) return false;
  res.status(403).json({
    success: false,
    error: message,
    requiredRoles: (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map((role) => normalizeRole(role)),
    role: currentRole(req)
  });
  return true;
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
  if (isAdminRequest(req)) return false;
  res.status(403).json({
    success: false,
    hostOnly: true,
    error: "Admin management requires app login on the deployed site or localhost access on the host computer."
  });
  return true;
}

function rejectRemoteLiveSync(req, res) {
  if (isHostImportRequest(req)) return false;
  res.status(403).json({
    success: false,
    hostOnly: true,
    error: "Live sync is available only on the host computer."
  });
  return true;
}

function normalizeLiveSyncSource(value) {
  const raw = String(value || DEFAULT_LIVE_SYNC_SOURCE).trim();
  const normalized = normalizeUrl(raw || DEFAULT_LIVE_SYNC_SOURCE);
  const url = new URL(normalized);
  const host = url.hostname.toLowerCase();
  if (!["agent.phottix.cn", "www.agent.phottix.cn"].includes(host)) {
    throw new Error("Live sync source must be agent.phottix.cn.");
  }
  url.protocol = "https:";
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.origin;
}

function sharedSnapshotResponse(payload = {}) {
  return {
    success: true,
    sourceUrl: payload.sourceUrl || DEFAULT_LIVE_SYNC_SOURCE,
    updatedAt: payload.updatedAt || {},
    counts: payload.counts || countSnapshotData(payload.data || {}),
    data: payload.data || {}
  };
}

async function fetchLiveSnapshotFromSource(sourceUrl, credentials = {}) {
  const baseUrl = normalizeLiveSyncSource(sourceUrl);
  const snapshotUrl = new URL("/api/db/snapshot", baseUrl).toString();
  const loginUrl = new URL("/login", baseUrl).toString();
  const username = String(credentials.username || process.env.LIVE_SYNC_USER || APP_AUTH_USER || "").trim();
  const password = String(credentials.password || process.env.LIVE_SYNC_PASS || APP_AUTH_PASS || "").trim();
  const client = axios.create({
    timeout: 20000,
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 500,
    headers: {
      "User-Agent": "Mozilla/5.0 (Phottix Customer Agent Sync)",
      Accept: "application/json,text/plain,*/*"
    }
  });

  const directResponse = await client.get(snapshotUrl);
  if (directResponse.status === 200 && directResponse.data?.success) {
    return sharedSnapshotResponse({ ...directResponse.data, sourceUrl: baseUrl });
  }

  if (!username || !password) {
    throw new Error("Live sync credentials are missing. Set LIVE_SYNC_USER/LIVE_SYNC_PASS or APP_AUTH_USER/APP_AUTH_PASS.");
  }

  const loginBody = new URLSearchParams({
    username,
    password,
    returnTo: "/"
  }).toString();

  const loginResponse = await client.post(loginUrl, loginBody, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  const cookieHeader = (Array.isArray(loginResponse.headers["set-cookie"]) ? loginResponse.headers["set-cookie"] : [])
    .map((value) => String(value || "").split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

  if (!cookieHeader) {
    throw new Error("Unable to authenticate to the live site. Check the live login credentials.");
  }

  if (String(loginResponse.headers.location || "").includes("/login")) {
    throw new Error("Unable to authenticate to the live site. Check the live login credentials.");
  }

  const authedResponse = await client.get(snapshotUrl, {
    headers: { Cookie: cookieHeader }
  });

  if (authedResponse.status !== 200 || !authedResponse.data?.success) {
    throw new Error(authedResponse.data?.error || "Failed to fetch live snapshot.");
  }

  return sharedSnapshotResponse({ ...authedResponse.data, sourceUrl: baseUrl });
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

async function prepareMailAttachments(items = []) {
  const mailAttachments = [];
  const tempFiles = [];
  try {
    for (const item of (Array.isArray(items) ? items : [])) {
      if (item?.assetId) {
        const asset = findAsset(item.assetId);
        if (!asset) throw new Error("Cloud attachment is unavailable or has been deleted.");
        const tempPath = assetTempPath(asset.original_name);
        await assetStorage.copyToFile(asset.oss_key, tempPath);
        tempFiles.push({ path: tempPath });
        mailAttachments.push({
          filename: asset.original_name,
          path: tempPath,
          contentType: asset.mime_type || undefined
        });
        continue;
      }
      if (item?.path && item.isUploadedFile) {
        const resolvedPath = path.resolve(String(item.path));
        if (!isPathInsideUploadTemp(resolvedPath) || !fs.existsSync(resolvedPath)) {
          throw new Error("Invalid or expired attachment file.");
        }
        mailAttachments.push({
          filename: String(item.originalName || item.filename || "attachment"),
          path: resolvedPath,
          contentType: item.mimetype || undefined
        });
      }
    }
    return { mailAttachments, tempFiles };
  } catch (error) {
    cleanupUploadedFiles(tempFiles);
    throw error;
  }
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
  const files = fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    // Ignore Office lock/temp files such as "~$Price List.xlsx" and hidden desktop metadata.
    .filter((name) => !name.startsWith("~$") && !name.startsWith("."))
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

const uploadAssetFiles = multer({
  storage: attachmentStorage,
  limits: { fileSize: MAX_ASSET_SIZE, files: MAX_ASSET_COUNT },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (ALLOWED_ATTACHMENT_TYPES.has(file.mimetype) || ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
      cb(null, true);
      return;
    }
    cb(new Error("Unsupported asset type. Please upload PDF, Word, Excel, image, or video files."));
  }
});

app.get("/api/auth/me", (req, res) => {
  const role = currentRole(req);
  res.json({
    success: true,
    user: req.appUserRecord ? {
      username: req.appUserRecord.username || req.appUserRecord.user,
      displayName: req.appUserRecord.displayName || req.appUserRecord.username || req.appUserRecord.user,
      email: req.appUserRecord.email || "",
      role,
      roleLabel: roleLabel(role),
      position: req.appUserRecord.position || "",
      managerUsername: req.appUserRecord.managerUsername || "",
      senderEmails: req.appUserRecord.senderEmails || []
    } : {
      username: isHostImportRequest(req) ? "localhost" : "anonymous",
      displayName: isHostImportRequest(req) ? "Local Admin" : "Anonymous",
      email: "",
      role,
      roleLabel: roleLabel(role),
      position: "",
      managerUsername: "",
      senderEmails: []
    },
    permissions: {
      isAdmin: role === "admin",
      canManageProducts: ["admin", "product_manager"].includes(role),
      canManageCustomers: ["admin", "sales", "sales_manager", "shipping_manager"].includes(role),
      canDeleteCustomers: ["admin", "sales", "sales_manager"].includes(role),
      canBatchManageCustomers: ["admin", "sales", "sales_manager"].includes(role),
      canImportCustomers: ["admin", "sales", "sales_manager"].includes(role),
      canExportCustomers: ["admin", "product_manager", "finance_manager", "sales", "sales_manager"].includes(role),
      canManageSenders: role === "admin",
      canViewSenders: ["admin", "product_manager", "finance_manager", "shipping_manager", "sales", "sales_manager"].includes(role),
      canUseSenders: ["admin", "product_manager", "finance_manager", "shipping_manager", "sales", "sales_manager"].includes(role),
      canViewAssets: ["admin", "product_manager", "finance_manager", "shipping_manager", "marketing_manager", "sales", "sales_manager"].includes(role),
      canManageAssets: ["admin", "product_manager"].includes(role),
      canManageEmailTemplates: canManageEmailTemplates(req),
      canManageUsers: role === "admin" || role === "marketing_manager",
      canViewSystemLogs: role === "admin"
    }
  });
});

app.get("/api/users", (req, res) => {
  if (rejectRole(req, res, ["admin", "marketing_manager"], "User management is restricted to Admin and Marketing Manager.")) return;
  try {
    const dbUsers = getSqliteDb().prepare(`
      SELECT id, username, display_name, email, role, position, manager_username, sender_emails, is_active, created_at, updated_at, last_login
      FROM users
      ORDER BY username COLLATE NOCASE
    `).all().map((row) => publicUser(row));
    const envUsers = configuredUsers()
      .filter((user) => user.source !== "sqlite")
      .map((user) => publicUser({ ...user, source: "env", isActive: true }));
    const users = [...envUsers, ...dbUsers];
    const visibleUsers = currentRole(req) === "marketing_manager"
      ? users.filter((user) => canMarketingManagerManageUser(req, user))
      : users;
    res.json({ success: true, users: visibleUsers });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to load users." });
  }
});

app.post("/api/users", (req, res) => {
  if (rejectRole(req, res, ["admin", "marketing_manager"], "User management is restricted to Admin and Marketing Manager.")) return;
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const displayName = String(req.body?.displayName || req.body?.display_name || username).trim();
    const email = normalizeEmail(req.body?.email);
    const actorRole = currentRole(req);
    let role = normalizeRole(req.body?.role);
    let position = normalizePosition(req.body?.position);
    let managerUsername = String(req.body?.managerUsername || req.body?.manager_username || "").trim();
    if (actorRole === "marketing_manager") {
      role = "sales";
      position = XIAOHONGSHU_POSITION;
      managerUsername = String(req.appUserRecord?.username || req.appUser || "").trim();
    }
    const senderEmails = Array.isArray(req.body?.senderEmails)
      ? req.body.senderEmails.map((value) => normalizeEmail(value)).filter(Boolean)
      : parseEmailList(req.body?.senderEmails || req.body?.sender_emails || email);
    if (!username || !password) {
      res.status(400).json({ success: false, error: "Username and password are required." });
      return;
    }
    if (findConfiguredUser(username)) {
      res.status(409).json({ success: false, error: "Username already exists." });
      return;
    }
    const now = new Date().toISOString();
    const id = uid("user");
    getSqliteDb().prepare(`
      INSERT INTO users (id, username, password_hash, display_name, email, role, position, manager_username, sender_emails, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, username, hashPassword(password), displayName, email, role, position, managerUsername, senderEmails.join(","), now, now);
    const row = getSqliteDb().prepare("SELECT id, username, display_name, email, role, position, manager_username, sender_emails, is_active, created_at, updated_at, last_login FROM users WHERE id = ?").get(id);
    logAudit(req, "CREATE", "user", id, username, { role, email });
    res.json({ success: true, user: publicUser(row) });
  } catch (error) {
    const duplicate = /UNIQUE constraint failed/i.test(String(error.message || ""));
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? "Username already exists." : error.message || "Failed to create user." });
  }
});

app.put("/api/users/:id", (req, res) => {
  if (rejectRole(req, res, ["admin", "marketing_manager"], "User management is restricted to Admin and Marketing Manager.")) return;
  try {
    const id = String(req.params.id || "").trim();
    const existing = getSqliteDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ success: false, error: "User not found or is managed by .env." });
      return;
    }
    if (currentRole(req) === "marketing_manager" && !canMarketingManagerManageUser(req, existing)) {
      res.status(403).json({ success: false, error: "Marketing Manager can only manage the 小红书管理员 sales account." });
      return;
    }
    const displayName = String(req.body?.displayName || req.body?.display_name || existing.display_name || existing.username).trim();
    const email = normalizeEmail(req.body?.email);
    const actorRole = currentRole(req);
    let role = normalizeRole(req.body?.role || existing.role);
    let position = normalizePosition(req.body?.position ?? existing.position);
    let managerUsername = String(req.body?.managerUsername || req.body?.manager_username || existing.manager_username || "").trim();
    if (actorRole === "marketing_manager") {
      role = "sales";
      position = XIAOHONGSHU_POSITION;
      managerUsername = String(req.appUserRecord?.username || req.appUser || "").trim();
    }
    const senderEmails = Array.isArray(req.body?.senderEmails)
      ? req.body.senderEmails.map((value) => normalizeEmail(value)).filter(Boolean)
      : parseEmailList(req.body?.senderEmails || req.body?.sender_emails || email);
    const isActive = req.body?.isActive === undefined ? Boolean(existing.is_active) : Boolean(req.body.isActive);
    const password = String(req.body?.password || "");
    const now = new Date().toISOString();
    if (password) {
      getSqliteDb().prepare(`
        UPDATE users SET password_hash = ?, display_name = ?, email = ?, role = ?, position = ?, manager_username = ?, sender_emails = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `).run(hashPassword(password), displayName, email, role, position, managerUsername, senderEmails.join(","), isActive ? 1 : 0, now, id);
    } else {
      getSqliteDb().prepare(`
        UPDATE users SET display_name = ?, email = ?, role = ?, position = ?, manager_username = ?, sender_emails = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `).run(displayName, email, role, position, managerUsername, senderEmails.join(","), isActive ? 1 : 0, now, id);
    }
    const row = getSqliteDb().prepare("SELECT id, username, display_name, email, role, position, manager_username, sender_emails, is_active, created_at, updated_at, last_login FROM users WHERE id = ?").get(id);
    logAudit(req, "UPDATE", "user", id, existing.username, { role, email, isActive, passwordChanged: Boolean(password) });
    res.json({ success: true, user: publicUser(row) });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to update user." });
  }
});

app.delete("/api/users/:id", (req, res) => {
  if (rejectRole(req, res, ["admin", "marketing_manager"], "User management is restricted to Admin and Marketing Manager.")) return;
  try {
    const id = String(req.params.id || "").trim();
    const existing = getSqliteDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ success: false, error: "User not found or is managed by .env." });
      return;
    }
    if (currentRole(req) === "marketing_manager" && !canMarketingManagerManageUser(req, existing)) {
      res.status(403).json({ success: false, error: "Marketing Manager can only manage the 小红书管理员 sales account." });
      return;
    }
    if (String(existing.username || "").toLowerCase() === String(req.appUserRecord?.username || req.appUser || "").toLowerCase()) {
      res.status(400).json({ success: false, error: "You cannot delete your own login." });
      return;
    }
    getSqliteDb().prepare("DELETE FROM users WHERE id = ?").run(id);
    logAudit(req, "DELETE", "user", id, existing.username, {});
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to delete user." });
  }
});

app.get("/api/import-files", (req, res) => {
  if (rejectRole(req, res, ["admin", "sales", "sales_manager"], "Customer Excel import is not allowed for this role.")) return;
  if (rejectRemoteImport(req, res)) return;
  try {
    res.json({ success: true, files: listExcelFiles() });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || "Failed to list import files." });
  }
});

app.get("/list-excel", (req, res) => {
  if (rejectRole(req, res, ["admin", "sales", "sales_manager"], "Customer Excel import is not allowed for this role.")) return;
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

app.get("/api/backup/status", (req, res) => {
  if (rejectRemoteAdmin(req, res)) return;
  try {
    const backups = listBackups();
    res.json({
      success: true,
      backupDir: BACKUP_DIR,
      retentionDays: 7,
      lastBackup: backups[0] || null,
      backups
    });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Backup status failed." });
  }
});

app.post("/api/backup/now", (req, res) => {
  if (rejectRemoteAdmin(req, res)) return;
  try {
    const backup = createBackup("manual", req);
    res.json({ success: true, backup, backups: listBackups() });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Manual backup failed." });
  }
});

app.get("/api/audit-logs", (req, res) => {
  if (rejectRemoteAdmin(req, res)) return;
  try {
    const params = [];
    const where = [];
    const username = String(req.query.username || "").trim();
    const action = String(req.query.action || "").trim().toUpperCase();
    const target = String(req.query.target || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    if (username) {
      where.push("username = ?");
      params.push(username);
    }
    if (action) {
      where.push("action = ?");
      params.push(action);
    }
    if (target) {
      where.push("(target_name LIKE ? OR target_id LIKE ? OR target_type LIKE ?)");
      params.push(`%${target}%`, `%${target}%`, `%${target}%`);
    }
    if (from) {
      where.push("created_at >= ?");
      params.push(from);
    }
    if (to) {
      where.push("created_at <= ?");
      params.push(to);
    }
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
    params.push(limit);
    const rows = getSqliteDb().prepare(`
      SELECT id, user_id, username, action, target_type, target_id, target_name, details, ip, user_agent, created_at
      FROM audit_logs
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT ?
    `).all(...params).map((row) => {
      try {
        return { ...row, details: JSON.parse(row.details || "{}") };
      } catch {
        return { ...row, details: {} };
      }
    });
    res.json({ success: true, logs: rows });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to load audit logs." });
  }
});

app.get("/api/db/snapshot", (req, res) => {
  try {
    const snapshot = readSharedStore();
    snapshot.data.phottix_customers = visibleCustomers(req, snapshot.data.phottix_customers).map(publicCustomer);
    res.json({ success: true, ...snapshot });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "SQLite snapshot failed." });
  }
});

app.post("/api/db/snapshot", (req, res) => {
  if (rejectRole(req, res, ["admin"], "Full database restore is admin-only.")) return;
  try {
    const beforeCounts = countSnapshotData(readSharedStore().data);
    writeSharedSnapshot(req.body?.data || {});
    const snapshot = readSharedStore();
    logAudit(req, "UPDATE", "snapshot", "all", "SQLite snapshot", {
      before: beforeCounts,
      after: countSnapshotData(snapshot.data)
    });
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
    const before = readSharedStore().data[key];
    let nextValue = req.body?.value;
    const role = currentRole(req);
    if (key === "phottix_customers") {
      if (rejectRole(req, res, ["admin", "sales", "sales_manager", "shipping_manager"], "Customer changes are not allowed for this role.")) return;
      if (!isAdminRequest(req)) {
        const submitted = Array.isArray(nextValue) ? nextValue : [];
        if (submitted.some((customer) => !canViewCustomer(req, customer))) {
          res.status(403).json({ success: false, error: "Customer changes include a restricted group." }); return;
        }
        const submittedIds = new Set(submitted.map((customer) => String(customer?.id || "")));
        const hidden = (Array.isArray(before) ? before : []).filter((customer) => !canViewCustomer(req, customer));
        if (hidden.some((customer) => submittedIds.has(String(customer?.id || "")))) {
          res.status(403).json({ success: false, error: "Restricted customers cannot be changed." }); return;
        }
        nextValue = [...hidden, ...submitted];
      }
      if (role === "shipping_manager" && customerSnapshotRemovesRecords(before, nextValue)) {
        res.status(403).json({ success: false, error: "This role cannot delete customer records.", role });
        return;
      }
    } else if (key === "phottix_products") {
      if (rejectRole(req, res, ["admin", "product_manager"], "Product changes are not allowed for this role.")) return;
    } else if (["phottix_settings", "phottix_auto_backups", "phottix_error_logs"].includes(key)) {
      if (rejectRole(req, res, ["admin"], "System setting changes are admin-only.")) return;
    } else if (key === "phottix_customer_import_reviews") {
      if (rejectRole(req, res, ["admin", "sales", "sales_manager"], "Customer import review changes are not allowed for this role.")) return;
    }
    writeSharedKey(key, nextValue);
    const value = nextValue;
    logAudit(req, "UPDATE", "shared_key", key, key, {
      beforeCount: Array.isArray(before) ? before.length : before && typeof before === "object" ? Object.keys(before).length : 0,
      afterCount: Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : 0
    });
    res.json({ success: true, key });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "SQLite key save failed." });
  }
});

app.post("/api/sync-live-snapshot", async (req, res) => {
  if (rejectRemoteLiveSync(req, res)) return;
  try {
    const sourceUrl = normalizeLiveSyncSource(req.body?.sourceUrl || DEFAULT_LIVE_SYNC_SOURCE);
    const snapshot = await fetchLiveSnapshotFromSource(sourceUrl, {
      username: req.body?.username,
      password: req.body?.password
    });
    const sections = normalizeLiveSyncSections(req.body?.sections);
    const previewOnly = Boolean(req.body?.previewOnly);
    const selectedData = pickSnapshotData(snapshot.data || {}, sections);
    const liveCounts = countSnapshotData(snapshot.data || {});
    const currentBefore = readSharedStore();
    if (!previewOnly) {
      writeSharedSnapshot(selectedData, sections.map((section) => LIVE_SYNC_KEY_MAP[section]));
    }
    const restored = readSharedStore();
    res.json({
      success: true,
      sourceUrl,
      previewOnly,
      sections,
      previewCounts: liveCounts,
      beforeCounts: countSnapshotData(currentBefore.data || {}),
      afterCounts: {
        customers: Array.isArray(restored.data.phottix_customers) ? restored.data.phottix_customers.length : 0,
        products: Array.isArray(restored.data.phottix_products) ? restored.data.phottix_products.length : 0,
        logs: restored.data.phottix_followup_logs && typeof restored.data.phottix_followup_logs === "object"
          ? Object.keys(restored.data.phottix_followup_logs).length
          : 0,
        templates: restored.data.phottix_email_templates ? 1 : 0,
        settings: restored.data.phottix_settings ? 1 : 0
      },
      updatedAt: restored.updatedAt || {}
    });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || "Failed to sync live snapshot." });
  }
});

app.get("/api/customers", (req, res) => {
  try {
    const { data } = readSharedStore();
    const customers = Array.isArray(data.phottix_customers) ? data.phottix_customers : [];
    const query = String(req.query.q || "").trim().toLowerCase();
    const filtered = visibleCustomers(req, customers).filter((customer) => !query || [
      customer.companyName, customer.name, customer.website, customer.contactName,
      customer.contactEmail, customer.country, customer.city, customer.industry
    ].some((value) => String(value || "").toLowerCase().includes(query)));
    res.json({ success: true, customers: filtered.map(publicCustomer) });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to load customers." });
  }
});

app.get("/api/customers/:id", (req, res) => {
  try {
    const customers = readSharedStore().data.phottix_customers;
    const customer = (Array.isArray(customers) ? customers : []).find((item) => String(item.id || "") === String(req.params.id || ""));
    if (rejectHiddenCustomer(req, res, customer)) return;
    res.json({ success: true, customer: publicCustomer(customer) });
  } catch (error) { res.status(503).json({ success: false, error: error.message || "Failed to load customer." }); }
});

app.put("/api/customers/:id", (req, res) => {
  if (rejectRole(req, res, ["admin", "sales", "sales_manager", "shipping_manager"], "Customer editing is not allowed for this role.")) return;
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
    if (rejectHiddenCustomer(req, res, customers[index])) return;
    const requestedGroupId = normalizeGroupId(req.body?.groupId ?? req.body?.group_id ?? customers[index].groupId ?? customers[index].group_id);
    if (!canViewGroupId(req, requestedGroupId)) {
      res.status(403).json({ success: false, error: "The selected customer group is restricted." }); return;
    }
    const nextCustomer = {
      ...customers[index],
      ...(req.body || {}),
      id,
      groupId: requestedGroupId,
      group_id: requestedGroupId,
      emailContacts: normalizeCustomerEmailContacts(req.body?.emailContacts ?? customers[index].emailContacts)
    };
    const previousCustomer = customers[index];
    customers[index] = nextCustomer;
    writeSharedKey("phottix_customers", customers);
    logAudit(req, "UPDATE", "customer", id, nextCustomer.companyName || nextCustomer.name || id, {
      before: previousCustomer,
      after: nextCustomer
    });
    res.json({ success: true, customer: nextCustomer });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to update customer." });
  }
});

app.get("/api/groups", (req, res) => {
  try {
    consolidateOldCustomerGroups();
    const rows = customerGroupRows();
    const visibleRows = isAdminRequest(req) ? rows : rows.filter((row) => normalizeVisibleRoles(row.visible_roles, row.name).includes(currentRole(req)));
    res.json({ success: true, hostOnly: isAdminRequest(req), groups: visibleRows.map(publicGroup) });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to load groups." });
  }
});

app.post("/api/groups", (req, res) => {
  if (rejectRemoteAdmin(req, res)) return;
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      res.status(400).json({ success: false, error: "Group name is required." });
      return;
    }
    const id = uid("group");
    const createdAt = new Date().toISOString();
    const visibleRoles = normalizeVisibleRoles(req.body?.visibleRoles, name);
    getSqliteDb().prepare("INSERT INTO groups (id, name, created_at, visible_roles) VALUES (?, ?, ?, ?)")
      .run(id, name, createdAt, JSON.stringify(visibleRoles));
    const group = getSqliteDb().prepare("SELECT id, name, created_at, visible_roles FROM groups WHERE id = ?").get(id);
    logAudit(req, "CREATE", "group", id, name, {});
    res.json({ success: true, group: publicGroup(group) });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to create group." });
  }
});

app.put("/api/groups/:id", (req, res) => {
  if (rejectRemoteAdmin(req, res)) return;
  try {
    const id = String(req.params.id || "").trim();
    const name = String(req.body?.name || "").trim();
    if (!id || !name) {
      res.status(400).json({ success: false, error: "Group id and name are required." });
      return;
    }
    const existing = getSqliteDb().prepare("SELECT id, name, visible_roles FROM groups WHERE id = ?").get(id);
    const visibleRoles = normalizeVisibleRoles(req.body?.visibleRoles ?? existing?.visible_roles, name);
    const result = getSqliteDb().prepare("UPDATE groups SET name = ?, visible_roles = ? WHERE id = ?").run(name, JSON.stringify(visibleRoles), id);
    if (!result.changes) {
      res.status(404).json({ success: false, error: "Group not found." });
      return;
    }
    const group = getSqliteDb().prepare("SELECT id, name, created_at, visible_roles FROM groups WHERE id = ?").get(id);
    logAudit(req, "UPDATE", "group", id, name, {});
    res.json({ success: true, group: publicGroup(group) });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to update group." });
  }
});

app.delete("/api/groups/:id", (req, res) => {
  if (rejectRemoteAdmin(req, res)) return;
  try {
    const id = String(req.params.id || "").trim();
    const result = getSqliteDb().prepare("DELETE FROM groups WHERE id = ?").run(id);
    if (!result.changes) {
      res.status(404).json({ success: false, error: "Group not found." });
      return;
    }
    const snapshot = readSharedStore();
    const customers = Array.isArray(snapshot.data.phottix_customers) ? snapshot.data.phottix_customers : [];
    const updatedCustomers = customers.map((customer) => {
      const currentGroupId = normalizeGroupId(customer.groupId || customer.group_id);
      if (currentGroupId !== id) return customer;
      return { ...customer, groupId: "", group_id: "" };
    });
    writeSharedKey("phottix_customers", updatedCustomers);
    logAudit(req, "DELETE", "group", id, id, {
      movedToUngrouped: customers.filter((customer) => normalizeGroupId(customer.groupId || customer.group_id) === id).length
    });
    res.json({ success: true, movedToUngrouped: customers.filter((customer) => normalizeGroupId(customer.groupId || customer.group_id) === id).length });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to delete group." });
  }
});

app.put("/api/customers/:id/group", (req, res) => {
  if (rejectRole(req, res, ["admin"], "Customer group changes are admin-only.")) return;
  try {
    const id = String(req.params.id || "").trim();
    const groupId = normalizeGroupId(req.body?.group_id ?? req.body?.groupId);
    const snapshot = readSharedStore();
    const customers = Array.isArray(snapshot.data.phottix_customers) ? snapshot.data.phottix_customers : [];
    const index = customers.findIndex((customer) => String(customer.id || "") === id);
    if (index < 0) {
      res.status(404).json({ success: false, error: "Customer not found." });
      return;
    }
    if (!canViewGroupId(req, groupId)) {
      res.status(403).json({ success: false, error: "The selected customer group is restricted." }); return;
    }
    if (groupId) {
      const group = getSqliteDb().prepare("SELECT id FROM groups WHERE id = ?").get(groupId);
      if (!group) {
        res.status(400).json({ success: false, error: "Group not found." });
        return;
      }
    }
    const previousGroupId = normalizeGroupId(customers[index].groupId || customers[index].group_id);
    customers[index] = { ...customers[index], groupId, group_id: groupId };
    writeSharedKey("phottix_customers", customers);
    logAudit(req, "UPDATE", "customer_group", id, customers[index].companyName || customers[index].name || id, {
      beforeGroupId: previousGroupId,
      afterGroupId: groupId
    });
    res.json({ success: true, customer: customers[index] });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to move customer group." });
  }
});

app.post("/api/customers/batch-group", (req, res) => {
  if (rejectRole(req, res, ["admin", "sales", "sales_manager"], "Batch customer group changes are not allowed for this role.")) return;
  try {
    const customerIds = Array.isArray(req.body?.customerIds) ? req.body.customerIds.map((id) => String(id || "")) : [];
    const groupId = normalizeGroupId(req.body?.group_id ?? req.body?.groupId);
    if (!customerIds.length) {
      res.status(400).json({ success: false, error: "Please select customers first." });
      return;
    }
    if (groupId) {
      const group = getSqliteDb().prepare("SELECT id FROM groups WHERE id = ?").get(groupId);
      if (!group) {
        res.status(400).json({ success: false, error: "Group not found." });
        return;
      }
    }
    const idSet = new Set(customerIds);
    const snapshot = readSharedStore();
    const customers = Array.isArray(snapshot.data.phottix_customers) ? snapshot.data.phottix_customers : [];
    if (!canViewGroupId(req, groupId) || customers.some((customer) => idSet.has(String(customer.id || "")) && !canViewCustomer(req, customer))) {
      res.status(403).json({ success: false, error: "Batch changes include a restricted customer or group." }); return;
    }
    let updated = 0;
    const updatedCustomers = customers.map((customer) => {
      if (!idSet.has(String(customer.id || ""))) return customer;
      updated += 1;
      return { ...customer, groupId, group_id: groupId };
    });
    writeSharedKey("phottix_customers", updatedCustomers);
    logAudit(req, "UPDATE", "customer_group", "batch", `Batch move ${updated} customers`, {
      customerIds,
      groupId,
      updated
    });
    res.json({ success: true, updated });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to batch move customers." });
  }
});

app.get("/api/senders", (req, res) => {
  if (rejectRole(req, res, ["admin", "product_manager", "finance_manager", "shipping_manager", "sales", "sales_manager"], "Sender list is not available for this role.")) return;
  try {
    const rows = getSqliteDb()
      .prepare("SELECT id, name, email, isActive, createdAt, updatedAt FROM senders ORDER BY name COLLATE NOCASE, email COLLATE NOCASE")
      .all();
    const canManage = isAdminRequest(req);
    const senders = rows
      .filter((sender) => canManage || senderAllowedForUser(req.appUserRecord, sender))
      .map((sender) => publicSenderForRequest(sender, req));
    res.json({ success: true, hostOnly: canManage, senders });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to load senders." });
  }
});

app.post("/api/senders", (req, res) => {
  if (rejectRole(req, res, ["admin"], "Sender management is admin-only.")) return;
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
    logAudit(req, "CREATE", "sender", id, email, { name, email });
    res.json({ success: true, sender: publicSender(sender) });
  } catch (error) {
    const message = String(error.message || "");
    const duplicate = /UNIQUE constraint failed/i.test(message);
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? "Sender email already exists." : message || "Failed to add sender." });
  }
});

app.put("/api/senders/:id", (req, res) => {
  if (rejectRole(req, res, ["admin"], "Sender management is admin-only.")) return;
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
    logAudit(req, "UPDATE", "sender", id, email, {
      before: { name: existing.name, email: existing.email, isActive: Boolean(existing.isActive) },
      after: { name, email, isActive: Boolean(sender.isActive) },
      passwordChanged: Boolean(appPassword)
    });
    res.json({ success: true, sender: publicSender(sender) });
  } catch (error) {
    const message = String(error.message || "");
    const duplicate = /UNIQUE constraint failed/i.test(message);
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? "Sender email already exists." : message || "Failed to update sender." });
  }
});

app.delete("/api/senders/:id", (req, res) => {
  if (rejectRole(req, res, ["admin"], "Sender management is admin-only.")) return;
  try {
    const id = String(req.params.id || "");
    const existing = getSqliteDb().prepare("SELECT * FROM senders WHERE id = ?").get(id);
    const result = getSqliteDb().prepare("DELETE FROM senders WHERE id = ?").run(id);
    if (!result.changes) {
      res.status(404).json({ success: false, error: "Sender not found." });
      return;
    }
    logAudit(req, "DELETE", "sender", id, existing?.email || id, { email: existing?.email || "" });
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to delete sender." });
  }
});

app.patch("/api/senders/:id/toggle", (req, res) => {
  if (rejectRole(req, res, ["admin"], "Sender management is admin-only.")) return;
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
    logAudit(req, "UPDATE", "sender", id, sender.email, { isActive: Boolean(nextActive) });
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
  if (!canManageEmailTemplates(req)) {
    res.status(403).json({ success: false, error: "Only Admin, Sales Manager, or Gina can modify Email templates." });
    return;
  }
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
      logAudit(req, "UPDATE", "template", existing.id, name, { subject, purpose });
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
    logAudit(req, "CREATE", "template", id, name, { subject, purpose });
    res.json({ success: true, updated: false, template: publicCustomTemplate(template) });
  } catch (error) {
    const message = String(error.message || "");
    const duplicate = /UNIQUE constraint failed/i.test(message);
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? "Template name already exists." : message || "Failed to save custom template." });
  }
});

app.put("/api/custom-templates/:id", (req, res) => {
  if (!canManageEmailTemplates(req)) {
    res.status(403).json({ success: false, error: "Only Admin, Sales Manager, or Gina can modify Email templates." });
    return;
  }
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
    logAudit(req, "UPDATE", "template", id, name, { subject, purpose });
    res.json({ success: true, template: publicCustomTemplate(template) });
  } catch (error) {
    const message = String(error.message || "");
    const duplicate = /UNIQUE constraint failed/i.test(message);
    res.status(duplicate ? 409 : 503).json({ success: false, error: duplicate ? "Template name already exists." : message || "Failed to update custom template." });
  }
});

app.delete("/api/custom-templates/:id", (req, res) => {
  if (!canManageEmailTemplates(req)) {
    res.status(403).json({ success: false, error: "Only Admin, Sales Manager, or Gina can modify Email templates." });
    return;
  }

  try {
    const id = String(req.params.id || "");
    const existing = getSqliteDb().prepare("SELECT id, name FROM custom_templates WHERE id = ?").get(id);
    const result = getSqliteDb().prepare("DELETE FROM custom_templates WHERE id = ?").run(id);
    if (!result.changes) {
      res.status(404).json({ success: false, error: "Custom template not found." });
      return;
    }
    logAudit(req, "DELETE", "template", id, existing?.name || id, {});
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to delete custom template." });
  }
});

app.post("/api/parse-excel-config", (req, res) => {
  if (rejectRole(req, res, ["admin", "sales", "sales_manager"], "Customer Excel import is not allowed for this role.")) return;
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

app.post("/api/import-excel-upload", (req, res) => {
  if (rejectRole(req, res, ["admin", "product_manager"], "Product Excel import is not allowed for this role.")) return;
  if (rejectRemoteImport(req, res)) return;
  uploadCustomerExcel.single("excelFile")(req, res, (error) => {
    if (error) {
      res.status(400).json({ success: false, error: error.message || "Excel upload failed." });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: "No Excel file selected." });
      return;
    }
    try {
      const { sheetName, rows } = readExcelRows(file.path);
      res.json({
        success: true,
        sheetName,
        fileName: file.originalname,
        rows,
        data: rows
      });
    } catch (readError) {
      res.status(502).json({ success: false, error: readError.message || "Failed to parse uploaded Excel." });
    } finally {
      cleanupUploadedFiles([{ path: file.path }]);
    }
  });
});

app.post("/api/import-customer-excel-upload", (req, res) => {
  if (rejectRole(req, res, ["admin", "sales", "sales_manager"], "Customer Excel import is not allowed for this role.")) return;
  uploadCustomerExcel.single("customerExcel")(req, res, (error) => {
    if (error) {
      res.status(400).json({ success: false, error: error.message || "Customer Excel upload failed." });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: "No Excel file selected." });
      return;
    }
    try {
      const { sheetName, rows } = readExcelRows(file.path);
      const classification = classifyRows(rows);
      res.json({
        success: true,
        sheetName,
        fileName: file.originalname,
        rows,
        data: rows,
        classification: classification.counts
      });
    } catch (readError) {
      res.status(502).json({ success: false, error: readError.message || "Failed to parse uploaded Excel." });
    } finally {
      cleanupUploadedFiles([{ path: file.path }]);
    }
  });
});

app.post("/api/generate-excel", (req, res) => {
  const exportType = String(req.body?.exportType || "customer").trim().toLowerCase();
  if (exportType === "customer" && rejectRole(req, res, ["admin", "product_manager", "finance_manager", "sales", "sales_manager"], "Customer export is not allowed for this role.")) return;
  if (exportType === "product" && rejectRole(req, res, ["admin", "product_manager", "finance_manager", "shipping_manager", "sales", "sales_manager"], "Product export is not allowed for this role.")) return;
  try {
    const groupsById = new Map(customerGroupRows().map((group) => [String(group.id), group.name]));
    const data = exportType === "customer"
      ? visibleCustomers(req, readSharedStore().data.phottix_customers).map((customer) => ({
          id: customer.id, company_name: customer.companyName, contact_name: customer.contactName,
          contact_email: customer.contactEmail, country: customer.country, city: customer.city,
          industry: customer.industry, main_products: customer.mainProducts || "",
          group_id: normalizeGroupId(customer.groupId || customer.group_id),
          group_name: groupsById.get(normalizeGroupId(customer.groupId || customer.group_id)) || "Ungrouped",
          buying_role: customer.buyingRole || "", customer_score: customer.customerScore ?? "",
          customer_type: customer.customerType || "", rating: customer.rating || "",
          website: customer.website || "", notes: customer.notes || ""
        }))
      : (Array.isArray(req.body?.data) ? req.body.data : []);
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

app.get("/api/assets", (req, res) => {
  try {
    const where = ["status = 'active'", "is_current = 1"];
    const params = [];
    const category = String(req.query.category || "").trim().toLowerCase();
    const sku = String(req.query.sku || "").trim();
    const search = String(req.query.q || "").trim();
    if (ASSET_CATEGORIES.has(category)) {
      where.push("category = ?");
      params.push(category);
    }
    if (sku) {
      where.push("sku LIKE ?");
      params.push(`%${sku}%`);
    }
    if (search) {
      where.push("(original_name LIKE ? OR sku LIKE ? OR uploaded_by_name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const rows = getSqliteDb().prepare(`
      SELECT * FROM asset_library
      WHERE ${where.join(" AND ")}
      ORDER BY updated_at DESC, original_name COLLATE NOCASE
    `).all(...params);
    res.json({ success: true, provider: assetStorage.provider, assets: rows.map(publicAsset) });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to load asset library." });
  }
});

app.post("/api/assets", (req, res) => {
  if (!assetCanManage(req)) {
    res.status(403).json({ success: false, error: "Only Admin or Product Manager can upload shared assets." });
    return;
  }
  uploadAssetFiles.array("files", MAX_ASSET_COUNT)(req, res, async (error) => {
    const files = Array.isArray(req.files) ? req.files : [];
    try {
      if (error) throw new Error(error.code === "LIMIT_FILE_SIZE" ? "Asset file is too large." : error.message || "Asset upload failed.");
      if (!files.length) throw new Error("No asset files selected.");
      const category = normalizeAssetCategory(req.body?.category);
      const sku = String(req.body?.sku || "").trim();
      const uploader = assetUploader(req);
      const now = new Date().toISOString();
      const db = getSqliteDb();
      const insert = db.prepare(`
        INSERT INTO asset_library
          (id, original_name, oss_key, category, sku, file_type, mime_type, file_size, uploaded_by, uploaded_by_name, uploaded_at, updated_at, version, is_current, status, checksum, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)
      `);
      const created = [];
      for (const file of files) {
        const id = uid("asset");
        const key = assetObjectKey(category, sku, 1, file.originalname);
        await assetStorage.put(key, file.path, file.mimetype || "application/octet-stream");
        insert.run(
          id,
          file.originalname,
          key,
          category,
          sku,
          assetFileType(file.mimetype, file.originalname),
          file.mimetype || "application/octet-stream",
          file.size || 0,
          uploader.username,
          uploader.displayName,
          now,
          now,
          1,
          "",
          now
        );
        const row = db.prepare("SELECT * FROM asset_library WHERE id = ?").get(id);
        created.push(publicAsset(row));
        logAudit(req, "CREATE", "asset", id, file.originalname, { category, sku, version: 1, provider: assetStorage.provider });
      }
      res.json({ success: true, assets: created });
    } catch (uploadError) {
      res.status(400).json({ success: false, error: uploadError.message || "Asset upload failed." });
    } finally {
      cleanupUploadedFiles(files);
    }
  });
});

app.get("/api/assets/:id/download-url", async (req, res) => {
  try {
    const row = findAsset(req.params.id);
    if (!row) {
      res.status(404).json({ success: false, error: "Asset not found." });
      return;
    }
    const url = await assetStorage.getDownloadUrl(row.oss_key, {
      localUrl: `/api/assets/${encodeURIComponent(row.id)}/content`,
      expires: ASSET_SIGNED_URL_EXPIRES_SEC,
      contentType: row.mime_type,
      downloadName: row.original_name
    });
    logAudit(req, "DOWNLOAD", "asset", row.id, row.original_name, { category: row.category, version: row.version });
    res.json({ success: true, url, expiresIn: assetStorage.provider === "oss" ? ASSET_SIGNED_URL_EXPIRES_SEC : null, asset: publicAsset(row) });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message || "Failed to create asset download URL." });
  }
});

app.get("/api/assets/:id/content", async (req, res) => {
  try {
    const row = findAsset(req.params.id);
    if (!row) {
      res.status(404).json({ success: false, error: "Asset not found." });
      return;
    }
    res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(row.original_name)}"`);
    await assetStorage.pipeToResponse(row.oss_key, res);
  } catch (error) {
    if (!res.headersSent) res.status(404).json({ success: false, error: "Asset content is unavailable." });
  }
});

app.put("/api/assets/:id", (req, res) => {
  if (!assetCanManage(req)) {
    res.status(403).json({ success: false, error: "Only Admin or Product Manager can modify shared assets." });
    return;
  }
  uploadAssetFiles.single("file")(req, res, async (error) => {
    const file = req.file;
    try {
      if (error) throw new Error(error.code === "LIMIT_FILE_SIZE" ? "Asset file is too large." : error.message || "Asset update failed.");
      const existing = findAsset(req.params.id);
      if (!existing) {
        res.status(404).json({ success: false, error: "Asset not found." });
        return;
      }
      const db = getSqliteDb();
      const now = new Date().toISOString();
      const category = normalizeAssetCategory(req.body?.category || existing.category);
      const sku = String(req.body?.sku ?? existing.sku ?? "").trim();
      const originalName = String(req.body?.originalName || file?.originalname || existing.original_name).trim();
      if (!file) {
        db.prepare("UPDATE asset_library SET category = ?, sku = ?, original_name = ?, updated_at = ? WHERE id = ?")
          .run(category, sku, originalName, now, existing.id);
        const updated = db.prepare("SELECT * FROM asset_library WHERE id = ?").get(existing.id);
        logAudit(req, "UPDATE", "asset", existing.id, originalName, { category, sku, version: existing.version, metadataOnly: true });
        res.json({ success: true, asset: publicAsset(updated) });
        return;
      }
      const nextVersion = Number(existing.version || 1) + 1;
      const key = assetObjectKey(category, sku, nextVersion, originalName);
      await assetStorage.put(key, file.path, file.mimetype || existing.mime_type || "application/octet-stream");
      const uploader = assetUploader(req);
      const id = uid("asset");
      db.exec("BEGIN");
      try {
        db.prepare("UPDATE asset_library SET is_current = 0, updated_at = ? WHERE id = ?").run(now, existing.id);
        db.prepare(`
          INSERT INTO asset_library
            (id, original_name, oss_key, category, sku, file_type, mime_type, file_size, uploaded_by, uploaded_by_name, uploaded_at, updated_at, version, is_current, status, checksum, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)
        `).run(id, originalName, key, category, sku, assetFileType(file.mimetype, originalName), file.mimetype || existing.mime_type || "application/octet-stream", file.size || 0, uploader.username, uploader.displayName, now, now, nextVersion, "", now);
        db.exec("COMMIT");
      } catch (dbError) {
        db.exec("ROLLBACK");
        throw dbError;
      }
      const updated = db.prepare("SELECT * FROM asset_library WHERE id = ?").get(id);
      logAudit(req, "UPDATE", "asset", id, originalName, { previousAssetId: existing.id, category, sku, version: nextVersion });
      res.json({ success: true, asset: publicAsset(updated) });
    } catch (updateError) {
      res.status(400).json({ success: false, error: updateError.message || "Asset update failed." });
    } finally {
      cleanupUploadedFiles(file ? [file] : []);
    }
  });
});

app.delete("/api/assets/:id", (req, res) => {
  if (!assetCanManage(req)) {
    res.status(403).json({ success: false, error: "Only Admin or Product Manager can delete shared assets." });
    return;
  }
  try {
    const row = findAsset(req.params.id);
    if (!row) {
      res.status(404).json({ success: false, error: "Asset not found." });
      return;
    }
    const now = new Date().toISOString();
    getSqliteDb().prepare("UPDATE asset_library SET status = 'deleted', is_current = 0, updated_at = ? WHERE id = ?").run(now, row.id);
    logAudit(req, "DELETE", "asset", row.id, row.original_name, { category: row.category, version: row.version, softDelete: true });
    res.json({ success: true, id: row.id });
  } catch (deleteError) {
    res.status(503).json({ success: false, error: deleteError.message || "Asset delete failed." });
  }
});

app.post("/api/upload-attachments", (req, res) => {
  uploadAttachments.array("attachments", MAX_ATTACHMENT_COUNT)(req, res, (error) => {
    if (error) {
      const status = error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT" ? 400 : 400;
      const friendlyError = error.code === "LIMIT_FILE_COUNT"
        ? `Too many files. Please upload up to ${MAX_ATTACHMENT_COUNT} files at once.`
        : error.message || "Attachment upload failed.";
      res.status(status).json({ success: false, error: friendlyError });
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

  let preparedAttachments = { mailAttachments: [], tempFiles: [] };
  try {
    let transporter = null;
    let from = process.env.SMTP_USER;
    if (senderId) {
      const sender = getSqliteDb().prepare("SELECT * FROM senders WHERE id = ? AND isActive = 1").get(senderId);
      if (!sender) {
        res.status(400).json({ success: false, error: "寄件者不存在或已停用" });
        return;
      }
      if (isAppAuthEnabled() && !senderAllowedForUser(req.appUserRecord, sender) && !isHostImportRequest(req)) {
        res.status(403).json({ success: false, error: "This sender is not assigned to your login." });
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

    preparedAttachments = await prepareMailAttachments(attachments);
    const mailAttachments = preparedAttachments.mailAttachments;
    const info = await transporter.sendMail({
      from,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      html,
      attachments: mailAttachments
    });
    cleanupUploadedFiles([...attachments, ...preparedAttachments.tempFiles]);
    logAudit(req, "SEND_EMAIL", "email", info.messageId || "", subject, {
      to,
      cc,
      bcc,
      subject,
      senderId,
      from,
      attachmentCount: mailAttachments.length
    });
    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    cleanupUploadedFiles([...attachments, ...preparedAttachments.tempFiles]);
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

getSqliteDb();
scheduleDailyBackup();

const server = app.listen(PORT, HOST, () => {
  console.log(`Phottix Customer Agent listening on http://${HOST}:${PORT}`);
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

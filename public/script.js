(function () {
  "use strict";

  const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

  function isLocalEnvironment() {
    const host = String(location.hostname || "").toLowerCase();
    return location.protocol === "file:" || LOCAL_HOSTS.has(host);
  }

  document.documentElement.classList.toggle("local-compact-scale", isLocalEnvironment());

  const API_BASE = location.protocol === "file:" ? "http://127.0.0.1:8787" : location.origin;
  const LIVE_SYNC_SOURCE = "https://agent.phottix.cn";
  const TODAY = new Date().toISOString().slice(0, 10);
  const CustomerClassification = window.PhottixCustomerClassification;

  const STORAGE = {
    customers: "phottix_customers",
    products: "phottix_products",
    logs: "phottix_followup_logs",
    templates: "phottix_email_templates",
    settings: "phottix_settings",
    autoBackups: "phottix_auto_backups",
    analysisHistory: "phottix_analysis_history",
    errorLogs: "phottix_error_logs",
    customerImportReviews: "phottix_customer_import_reviews"
  };
  const SHARED_STORAGE_KEYS = Object.values(STORAGE);
  const SQLITE_SYNC_KEY = "phottix_sqlite_shared_sync";

  const RECOMMENDED_FOR_OPTIONS = ["All", "A", "B", "C", "D"];
  const TARGET_PRIORITY_DISPLAY_ORDER = ["A", "B", "C", "D", "All"];
  const CUSTOMER_TYPES = ["prospect", "existing"];
  const OLD_CUSTOMER_GROUP_ID = "old_customers";
  const INDUSTRY_TYPES = ["", "Wholesale", "Retail", "Studio", "Events", "Creator", "Camera Store", "Online Shop", "Physical Store", "Services", "Other"];
  const FOLLOW_STATUSES = ["open", "completed", "pending", "cancelled", "deferred"];
  const MAX_ATTACHMENT_COUNT = 10;
  const EMAIL_PURPOSES = [
    "First Touch",
    "Product Follow-up",
    "New Product Promotion",
    "Event Invitation",
    "Existing Customer Update",
    "Reactivation",
    "Holiday Greeting"
  ];
  const BUYING_ROLE_DEFINITIONS = [
    {
      code: "A",
      label: "批發商 / Wholesaler",
      directKeywords: ["wholesale", "distributor", "distribution", "b2b", "批發", "分銷", "代理"],
      strongKeywords: ["wholesale", "distributor", "distribution", "b2b", "bulk", "批發", "分銷", "代理"],
      keywords: ["dealer", "trade account", "trade pricing", "volume pricing", "importer", "exporter", "批量"]
    },
    {
      code: "B",
      label: "實體零售商 / Physical Reseller",
      directKeywords: ["camera store", "camera shop", "photo store", "camera center", "camera centre", "camera retailer", "photo retailer", "photography equipment retailer", "retail store", "physical store", "brick and mortar", "showroom", "實體店", "實體零售", "門店", "相機店", "攝影器材店"],
      strongKeywords: ["camera store", "camera shop", "photo store", "camera center", "camera centre", "camera retailer", "photo retailer", "retail store", "physical store", "brick and mortar", "showroom", "store hours", "visit us", "實體店", "實體零售", "門店", "相機店", "攝影器材店"],
      keywords: ["location", "locations", "in-store", "branch", "branches", "展廳"]
    },
    {
      code: "C",
      label: "網店零售商 / Online Reseller",
      directKeywords: ["online store", "e-commerce", "ecommerce", "webshop", "shopify", "woocommerce", "add to cart", "checkout", "buy online", "網店", "電商", "線上零售"],
      strongKeywords: ["online store", "e-commerce", "ecommerce", "webshop", "shopify", "woocommerce", "add to cart", "checkout", "buy online", "網店", "電商", "線上零售"],
      keywords: ["shipping", "delivery", "cart", "marketplace", "order online"]
    },
    {
      code: "D",
      label: "工作室 / Studio or End User",
      directKeywords: ["photo studio", "video studio", "production company", "studio", "攝影棚", "工作室"],
      strongKeywords: ["studio", "photo studio", "video studio", "production company", "攝影棚", "工作室"],
      keywords: ["photographer", "videographer", "content creator", "portfolio", "booking", "commercial shoot", "filmmaker", "creator", "gallery", "製作公司", "攝影師", "攝像師", "內容創作者", "最終用戶"]
    }
  ];
  const BUYING_ROLES = ["Unknown", ...BUYING_ROLE_DEFINITIONS.map((item) => item.code)];
  const LIVE_SYNC_SECTION_DEFS = [
    { key: "customers", label: "客戶 Customers", short: "客戶", defaultChecked: true },
    { key: "products", label: "產品 Products", short: "產品", defaultChecked: true },
    { key: "logs", label: "跟進紀錄 Logs", short: "紀錄", defaultChecked: false },
    { key: "templates", label: "Email 模板", short: "模板", defaultChecked: false },
    { key: "settings", label: "設定 Settings", short: "設定", defaultChecked: false },
    { key: "analysisHistory", label: "分析歷史", short: "歷史", defaultChecked: false },
    { key: "errorLogs", label: "錯誤日誌", short: "錯誤", defaultChecked: false }
  ];
  const LIVE_SYNC_SECTION_LABELS = Object.fromEntries(
    LIVE_SYNC_SECTION_DEFS.map((section) => [section.key, section.short || section.label || section.key])
  );

  const DEFAULT_PRODUCTS = [
    { name: "Phottix Kali50Ra RGB LED Light", category: "Lighting", recommendedFor: "All", inRecommendationPool: true, isPriority: true },
    { name: "Phottix X160 COB LED Light", category: "Lighting", recommendedFor: "All", inRecommendationPool: true, isPriority: true },
    { name: "Phottix X600 COB LED Light", category: "Lighting", recommendedFor: "All", inRecommendationPool: true, isPriority: false },
    { name: "Phottix M200R RGB Panel", category: "Lighting", recommendedFor: "All", inRecommendationPool: true, isPriority: true },
    { name: "Phottix M500R RGB Panel", category: "Lighting", recommendedFor: "All", inRecommendationPool: true, isPriority: false },
    { name: "Phottix G-Capsule Softbox 85cm", category: "Modifiers", recommendedFor: "All", inRecommendationPool: true, isPriority: true },
    { name: "Phottix G-Capsule Softbox 105cm", category: "Modifiers", recommendedFor: "All", inRecommendationPool: true, isPriority: false },
    { name: "Phottix Odin II TTL Flash Trigger", category: "Flash & Trigger", recommendedFor: "All", inRecommendationPool: true, isPriority: false },
    { name: "Phottix Juno Flash", category: "Flash & Trigger", recommendedFor: "All", inRecommendationPool: false, isPriority: false },
    { name: "Phottix Light Stand", category: "Support & Accessories", recommendedFor: "All", inRecommendationPool: true, isPriority: false }
  ];

  const DEFAULT_TEMPLATES = {
    first_touch: {
      purpose: "First Touch",
      subject: "Quick Phottix introduction for {{公司名}}",
      body: [
        "Hi {{聯絡人}},",
        "",
        "I came across {{公司名}} and noticed your work around {{官網發現的產品線}}.",
        "",
        "Phottix works with photo and video partners on practical products such as {{推薦產品}}.",
        "",
        "No pressure at all, but would it be alright if I sent over a short product overview for the right person on your team?",
        "",
        "If there is a better contact for new brand or product line discussions, I would also appreciate being pointed in the right direction.",
        "",
        "Best regards,",
        "[Your Name]",
        "Phottix Business Development Team"
      ].join("\n")
    },
    product_follow_up: {
      purpose: "Product Follow-up",
      subject: "Product ideas for {{公司名}}",
      body: [
        "Hi {{聯絡人}},",
        "",
        "I wanted to follow up with a more specific Phottix direction for {{公司名}}.",
        "",
        "Based on your business signals, the most relevant items to review first may be {{推薦產品}}.",
        "",
        "Would it be useful if I sent a short overview with dealer pricing or product details?",
        "",
        "Best regards,",
        "[Your Name]"
      ].join("\n")
    },
    new_product_promotion: {
      purpose: "New Product Promotion",
      subject: "New Phottix product update for {{公司名}}",
      body: [
        "Hi {{聯絡人}},",
        "",
        "I wanted to share a quick Phottix product update that may be relevant to {{公司名}}.",
        "",
        "The new items I would suggest reviewing first are {{推薦產品}}.",
        "",
        "Would it be useful if I sent over a short overview with key specs, availability, and sample pricing?",
        "",
        "Best regards,",
        "[Your Name]",
        "Phottix Business Development Team"
      ].join("\n")
    },
    event_invitation: {
      purpose: "Event Invitation",
      subject: "Possible Phottix demo discussion",
      body: "Hi {{聯絡人}},\n\nI wanted to share a quick Phottix demo or product update that may fit {{公司名}}.\n\nWould it be useful if I sent over a short overview for your team?\n\nBest regards,\n[Your Name]"
    },
    existing_customer_update: {
      purpose: "Existing Customer Update",
      subject: "Phottix update for {{公司名}}",
      body: "Hi {{聯絡人}},\n\nI wanted to share a quick Phottix update for {{公司名}}.\n\nThe items most relevant to review first are {{推薦產品}}.\n\nWould you like me to send the latest overview and availability?\n\nBest regards,\n[Your Name]"
    },
    reactivation: {
      purpose: "Reactivation",
      subject: "Quick Phottix reconnect",
      body: "Hi {{聯絡人}},\n\nIt has been a while, so I wanted to reconnect and see whether a short Phottix update would be useful for {{公司名}}.\n\nNo pressure at all. If now is not the right timing, I can follow up later.\n\nBest regards,\n[Your Name]"
    },
    holiday_greeting: {
      purpose: "Holiday Greeting",
      subject: "Seasonal greetings from Phottix",
      body: "Hi {{聯絡人}},\n\nSeasonal greetings from Phottix. I hope things are going well at {{公司名}}.\n\nWhen timing is right, I would be happy to send a short product update around {{推薦產品}}.\n\nBest regards,\n[Your Name]"
    }
  };

  const SCORING_RULES = [
    { key: "wholesale", label: "Wholesale", weight: 30, terms: [/wholesale|distributor|distribution|dealer|reseller|b2b|trade account|trade pricing|bulk|importer|代表品牌|代理|經銷|批發/i] },
    { key: "retail", label: "Retail", weight: 20, terms: [/retail|shop|store|sales|product catalog|products|buy|order|購買|零售|商店|商城/i] },
    { key: "cameraStore", label: "Camera Store", weight: 25, terms: [/camera store|camera shop|photo store|camera center|camera centre|camera retailer|photo retailer|photography equipment|camera equipment|相機店|攝影器材店/i] },
    { key: "onlineShop", label: "Online Shop", weight: 15, terms: [/add to cart|cart|checkout|online store|shop online|buy online|shipping|e-commerce|網店|線上商店|購物車/i] },
    { key: "physicalStore", label: "Physical Store", weight: 20, terms: [/address|phone|visit us|store hours|opening hours|showroom|location|directions|門店|地址|電話|營業時間/i] },
    { key: "studio", label: "Studio", weight: 20, terms: [/studio|photo studio|video studio|portrait|commercial shoot|影棚|工作室|拍攝/i] },
    { key: "services", label: "Services", weight: 10, terms: [/rental|repair|service|installation|support|calibration|租賃|維修|服務/i] },
    { key: "events", label: "Events", weight: 10, terms: [/event|workshop|training|seminar|course|demo day|展會|活動|課程|培訓/i] },
    { key: "creator", label: "Creator", weight: 15, terms: [/creator|content creator|youtube|tiktok|vlogger|filmmaker|videographer|photographer|創作者|影片|直播/i] },
    { key: "completeWebsite", label: "完整官網內容", weight: 15, terms: [] }
  ];

  const dom = {};
  const state = {
    currentAnalysis: null,
    currentCustomerId: "",
    selectedCustomerIds: new Set(),
    productView: "pool",
    emailAttachments: [],
    buyingRoleManualDirty: false,
    emailContactsDraft: [],
    customTemplates: [],
    selectedTemplateKind: "default",
    selectedCustomTemplateId: "",
    senders: [],
    users: [],
    assets: [],
    groups: [],
    isHostAdmin: false,
    username: "",
    userRole: "sales",
    permissions: {}
  };

  function $(id) {
    return document.getElementById(id);
  }

  function uid(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  const GENERIC_CONTACT_ALIASES = new Set([
    "info", "sales", "admin", "support", "hello", "hola", "contact", "contactus", "office", "service",
    "customer", "customerservice", "inquiries", "enquiries", "enquiry", "orders", "order", "marketing",
    "business", "team", "general", "mail", "postmaster", "noreply", "help", "webmaster", "careers",
    "accounts", "finance", "billing", "press", "media", "booking", "bookings", "reception", "frontdesk",
    "notifications", "seminars", "data", "jimukyoku", "secretariat"
  ]);

  function compactContactLabel(value) {
    return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function looksLikePersonEmailLocal(value) {
    const local = normalizeText(value).toLowerCase();
    return /^[a-z]{2,}[._-][a-z]{2,}$/i.test(local) || /^[a-z]\.[a-z]{3,}$/i.test(local);
  }

  function contactNameType(value, email = "") {
    const raw = normalizeText(value);
    if (!raw) return "";
    const compact = compactContactLabel(raw);
    const local = normalizeText(email).toLowerCase().split("@")[0] || "";
    const compactLocal = compactContactLabel(local);
    if (GENERIC_CONTACT_ALIASES.has(compact)) return "generic_inbox";
    if (/^(info|sales|admin|support|contact|office|service|team|group|grupo|hello|hola)[a-z0-9]*$/i.test(compact)) return "generic_inbox";
    if (compactLocal && compact === compactLocal && !/\s/.test(raw) && !looksLikePersonEmailLocal(local)) return "unconfirmed_label";
    return "person";
  }

  function normalizeContactName(value, email = "") {
    const normalized = normalizeText(value);
    const type = contactNameType(normalized, email);
    // A name entered by a user is authoritative unless it is a generic mailbox label.
    if (normalized && type !== "generic_inbox") return normalized;
    const local = String(email || "").trim().split("@")[0] || "";
    if (!normalized && looksLikePersonEmailLocal(local)) {
      return local.split(/[._-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
    }
    return "";
  }

  function displayRecipient(email, contactName = "") {
    const cleanEmail = normalizeText(email);
    const name = normalizeContactName(contactName, cleanEmail);
    return name && cleanEmail ? `${name} <${cleanEmail}>` : cleanEmail;
  }

  function contactNameNote(value, email = "") {
    const raw = normalizeText(value);
    const type = contactNameType(raw, email);
    if (!raw || type === "person") return "";
    return `原始 Contact Name：${raw}（部门邮箱标签或未确认真人姓名，不用于邮件称呼）`;
  }

  function emailGreeting(customer = {}) {
    const contactName = normalizeContactName(customer.contactName, customer.contactEmail);
    if (contactName) return `Hi ${contactName},`;
    const company = normalizeText(customer.companyName);
    return company ? `Hello ${company} team,` : "Dear Sir or Madam,";
  }

  function decodeWebsiteEntities(value) {
    return String(value || "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'");
  }

  function cleanWebsiteExtract(value) {
    let text = decodeWebsiteEntities(value);
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
    const cleaned = [];

    text.split(/\n|(?<=\.)\s+(?=[A-Z0-9(])|(?<=!)\s+|(?<=\?)\s+/)
      .map((line) => normalizeText(line).replace(/\bView\b$/i, "").trim())
      .filter(Boolean)
      .forEach((line) => {
        line = line.replace(/\bHi\b$/i, "").replace(/\s+[,;:]+$/g, "").trim();
        if (menuOnly.test(line) || noisy.test(line)) return;
        if (line.length < 8 && !/@|\d{3}|\b[A-Z]{2}\b/.test(line)) return;
        const key = line.toLowerCase().replace(/[^\w@]+/g, " ").trim();
        if (seen.has(key)) return;
        seen.add(key);
        cleaned.push(line);
      });

    return cleaned.join("\n").slice(0, 8000).trim();
  }

  function normalizeUrl(value) {
    const text = normalizeText(value);
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    if (/^www\./i.test(text)) return `https://${text}`;
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) return `https://${text}`;
    return text;
  }

  function isPhottixCompany(companyName = "", website = "") {
    const company = normalizeText(companyName).toLowerCase();
    const domain = normalizeDomain(website);
    return /\bphottix\b/i.test(company) || domain === "phottix.com" || domain.endsWith(".phottix.com");
  }

  function normalizeBuyingRole(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) return "Unknown";
    const compact = text.replace(/[\s_./\\-]+/g, "");
    const aliases = {
      a: "A",
      wholesaler: "A",
      wholesales: "A",
      wholesale: "A",
      wholesalerb2b: "A",
      批發商: "A",
      批發: "A",
      b: "B",
      physicalreseller: "B",
      resellerphysical: "B",
      physicalretailer: "B",
      brickandmortar: "B",
      實體零售商: "B",
      實體零售: "B",
      實體店: "B",
      門店: "B",
      c: "C",
      onlinereseller: "C",
      reselleronline: "C",
      onlineretailer: "C",
      網店零售商: "C",
      網店零售: "C",
      網店: "C",
      電商: "C",
      d: "D",
      studio: "D",
      enduserstudio: "D",
      enduser: "D",
      studioorenduser: "D",
      工作室: "D",
      工作室或最終用戶: "D",
      最終用戶: "D",
      unknown: "Unknown",
      未分類: "Unknown",
      未知: "Unknown"
    };
    const prefixedCode = text.match(/^(a|b|c|d)(?:\s*[-=:：/]\s*.*)?$/i)?.[1];
    return prefixedCode?.toUpperCase() || aliases[text] || aliases[compact] || "Unknown";
  }

  function buyingRoleDisplay(value) {
    const code = normalizeBuyingRole(value);
    const definition = BUYING_ROLE_DEFINITIONS.find((item) => item.code === code);
    return definition ? `${definition.code} - ${definition.label}` : "Unknown / 未分類";
  }

  function recommendedForFromBuyingRole(value) {
    const role = normalizeBuyingRole(value);
    return BUYING_ROLE_DEFINITIONS.some((item) => item.code === role) ? role : "All";
  }

  function normalizeRecommendedFor(value) {
    const text = normalizeText(value).toLowerCase();
    const aliases = {
      wholesaler: "A",
      "resellerphysical": "B",
      "reseller-physical": "B",
      "physicalreseller": "B",
      "reselleronline": "C",
      "reseller-online": "C",
      "onlinereseller": "C",
      "enduserstudio": "D",
      "enduser-studio": "D",
      studio: "D",
      unknown: "All",
      all: "All"
    };
    const compact = text.replace(/[\s_]+/g, "");
    const direct = RECOMMENDED_FOR_OPTIONS.find((option) => option.toLowerCase() === text);
    return direct || aliases[compact] || "All";
  }

  function parseTargetPriority(value) {
    const text = normalizeText(value);
    if (!text) return "";
    const match = text.match(/\d+/);
    if (!match) return "";
    const priority = Number(match[0]);
    return Number.isFinite(priority) ? Math.max(1, Math.floor(priority)) : "";
  }

  function normalizeTargetPriorities(value = {}) {
    const result = {};
    RECOMMENDED_FOR_OPTIONS.forEach((target) => {
      const priority = parseTargetPriority(value?.[target]);
      if (priority !== "") result[target] = priority;
    });
    return result;
  }

  function editableTargetPriorities(product = {}) {
    const direct = normalizeTargetPriorities(product.targetPriorities);
    if (Object.keys(direct).length) return direct;
    const target = normalizeRecommendedFor(product.recommendedFor);
    const priority = parseTargetPriority(product.priority);
    return priority === "" ? {} : { [target]: priority };
  }

  function productTargetPriorities(product = {}) {
    const direct = normalizeTargetPriorities(product.targetPriorities);
    if (Object.keys(direct).length) return direct;
    const target = normalizeRecommendedFor(product.recommendedFor);
    const priority = parseTargetPriority(product.priority);
    return priority === "" ? {} : { [target]: priority };
  }

  function primaryTargetPriority(product = {}) {
    const priorities = productTargetPriorities(product);
    const order = new Map(TARGET_PRIORITY_DISPLAY_ORDER.map((target, index) => [target, index]));
    return Object.entries(priorities).sort((a, b) => Number(a[1]) - Number(b[1]) || order.get(a[0]) - order.get(b[0]))[0] || ["All", 999];
  }

  function targetPrioritySummary(product = {}) {
    const priorities = productTargetPriorities(product);
    return TARGET_PRIORITY_DISPLAY_ORDER
      .filter((target) => priorities[target] !== undefined)
      .map((target) => [target, priorities[target]])
      .map(([target, priority]) => `${target}-${priority}`)
      .join(" / ");
  }

  function parseTargetPriorityQuery(value) {
    const compact = normalizeText(value).toUpperCase().replace(/\s+/g, "");
    const match = compact.match(/^(ALL|[ABCD])-?(\d+)$/);
    if (!match) return null;
    return { target: match[1], priority: Number(match[2]) };
  }

  function recommendedForOptionsHtml(selected = "All") {
    const current = normalizeRecommendedFor(selected);
    return RECOMMENDED_FOR_OPTIONS.map((option) => `<option value="${escapeHtml(option)}" ${option === current ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
  }

  function normalizeCustomerScore(value) {
    const text = normalizeText(value);
    if (!text) return null;
    const score = Number(text);
    if (!Number.isFinite(score)) return null;
    return Math.min(100, Math.max(1, Math.round(score)));
  }

  function splitEmailList(value) {
    return String(value || "")
      .split(",")
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  function normalizeEmailRole(value) {
    const role = normalizeText(value).toLowerCase();
    return ["to", "cc", "bcc"].includes(role) ? role : "to";
  }

  function normalizeEmailContacts(items) {
    const contacts = Array.isArray(items) ? items : [];
    const seen = new Set();
    return contacts.map((item) => ({
      email: normalizeText(item?.email || item?.address || ""),
      role: normalizeEmailRole(item?.role)
    }))
      .filter((item) => item.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email))
      .filter((item) => {
        const key = `${item.role}:${item.email.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function contactsByRole(contacts, role) {
    return normalizeEmailContacts(contacts).filter((item) => item.role === role).map((item) => item.email).join(", ");
  }

  function keywordHit(text, keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
  }

  function directKeywordHit(text, keyword) {
    if (keywordHit(text, keyword)) return true;
    const compactText = String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const compactKeyword = String(keyword || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    return compactKeyword.length >= 6 && compactText.includes(compactKeyword);
  }

  function determineBuyingRole(websiteText, company = {}) {
    const text = normalizeText(websiteText);
    if (!text) return "Unknown";

    if (isPhottixCompany(company.companyName, company.website)) return "A";

    // Exact business-model signals take precedence over general photography words.
    // This prevents a camera retailer mentioning studios or photographers from being classified as D.
    const directMatches = BUYING_ROLE_DEFINITIONS.filter((definition) =>
      definition.directKeywords.some((keyword) => directKeywordHit(text, keyword))
    ).map((definition) => definition.code);
    for (const preferredRole of ["A", "B", "C", "D"]) {
      if (directMatches.includes(preferredRole)) return preferredRole;
    }

    const scores = BUYING_ROLE_DEFINITIONS.map((definition) => ({
      role: definition.code,
      hits: definition.strongKeywords.filter((keyword) => keywordHit(text, keyword)).length * 2
        + definition.keywords.filter((keyword) => keywordHit(text, keyword)).length
    }));
    const highest = Math.max(...scores.map((item) => item.hits));
    if (highest <= 0) return "Unknown";

    const winners = scores.filter((item) => item.hits === highest);
    return winners.length === 1 ? winners[0].role : "Unknown";
  }

  function buyingRoleOptionsHtml(selected = "Unknown") {
    const current = normalizeBuyingRole(selected);
    return [
      `<option value="Unknown" ${current === "Unknown" ? "selected" : ""}>Unknown / 未分類</option>`,
      ...BUYING_ROLE_DEFINITIONS.map((definition) => `<option value="${definition.code}" ${definition.code === current ? "selected" : ""}>${definition.code} - ${escapeHtml(definition.label)}</option>`)
    ].join("");
  }

  function todayString(date = new Date()) {
    return date.toISOString().slice(0, 10);
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-HK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function daysSince(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor((Date.now() - date.getTime()) / 86400000);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadCustomerImportReview(status) {
    const review = DB.getCustomerImportReviews();
    const entries = Array.isArray(review[status]) ? review[status] : [];
    if (!entries.length) {
      UI.toast("没有可下载的审核记录。", "warn");
      return;
    }
    const sourceRows = entries.map((entry) => ({
      ...(entry.row || {}),
      "Import Status": entry.status || status,
      "Reason": entry.reason || "",
      "Buyer Role": entry.buyingRole || "",
      "Source Row": entry.rowNumber || ""
    }));
    const headers = [...new Set(sourceRows.flatMap((row) => Object.keys(row)))];
    const csvCell = (value) => {
      const text = String(value ?? "").replace(/\r?\n/g, " ");
      return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [headers, ...sourceRows.map((row) => headers.map((header) => row[header] ?? ""))]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), `phottix-customer-${status}-review.csv`);
  }

  function purposeKey(purpose) {
    return normalizeText(purpose).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  function syncEmailPurposeFromTemplate() {
    if (!dom.emailPurpose || !dom.templatePurpose) return;
    const [kind, id] = String(dom.templatePurpose.value || "").split(":");
    if (kind !== "default") return;
    const matchedPurpose = EMAIL_PURPOSES.find((purpose) => purposeKey(purpose) === id);
    if (matchedPurpose) dom.emailPurpose.value = matchedPurpose;
  }

  function ratingFromScore(score, evidenceEnough = true) {
    if (!evidenceEnough) return "NR";
    if (score >= 70) return "A";
    if (score >= 40) return "B";
    if (score >= 25) return "C";
    return "D";
  }

  function ratingClass(rating) {
    return `rating-${String(rating || "NR").toLowerCase()}`;
  }

  function inferAttachmentType(item = {}) {
    const mimetype = normalizeText(item.mimetype).toLowerCase();
    const filename = normalizeText(item.originalName || item.filename || item.name).toLowerCase();
    if (/pdf/.test(mimetype) || /\.pdf$/i.test(filename)) return "pdf";
    if (/word|document/.test(mimetype) || /\.(doc|docx)$/i.test(filename)) return "word";
    if (/excel|spreadsheet/.test(mimetype) || /\.(xls|xlsx)$/i.test(filename)) return "excel";
    if (/image/.test(mimetype) || /\.(jpe?g|png|gif|heic|heif)$/i.test(filename)) return "image";
    return "file";
  }

  function formatFileSize(bytes) {
    const size = Number(bytes || 0);
    if (!Number.isFinite(size) || size <= 0) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function hasPermission(name) {
    return Boolean(state.permissions?.[name]);
  }

  function canManageProducts() {
    return hasPermission("canManageProducts") || state.userRole === "admin" || state.userRole === "product_manager";
  }

  function canManageTemplates() {
    return hasPermission("canManageEmailTemplates")
      || state.userRole === "admin"
      || state.userRole === "sales_manager"
      || (state.userRole === "sales" && String(state.username || "").toLowerCase() === "gina");
  }

  function canManageUsers() {
    return hasPermission("canManageUsers") || state.userRole === "admin" || state.userRole === "marketing_manager";
  }

  function canManageCustomers() {
    return hasPermission("canManageCustomers") || state.userRole === "admin" || state.userRole === "sales" || state.userRole === "sales_manager" || state.userRole === "shipping_manager";
  }

  function canDeleteCustomers() {
    return hasPermission("canDeleteCustomers") || state.userRole === "admin" || state.userRole === "sales" || state.userRole === "sales_manager";
  }

  function canBatchManageCustomers() {
    return hasPermission("canBatchManageCustomers") || state.userRole === "admin" || state.userRole === "sales" || state.userRole === "sales_manager";
  }

  function canManageAssets() {
    return hasPermission("canManageAssets") || state.userRole === "admin" || state.userRole === "product_manager";
  }

  function compactDetails(details = {}) {
    if (!details || typeof details !== "object") return "";
    const parts = [];
    if (details.reason) parts.push(`reason: ${details.reason}`);
    if (details.sizeBytes) parts.push(`size: ${formatFileSize(details.sizeBytes)}`);
    if (details.to) parts.push(`to: ${details.to}`);
    if (details.subject) parts.push(`subject: ${details.subject}`);
    if (details.senderId) parts.push(`sender: ${details.senderId}`);
    if (details.attachmentCount) parts.push(`attachments: ${details.attachmentCount}`);
    if (details.updated) parts.push(`updated: ${details.updated}`);
    if (details.beforeCount !== undefined || details.afterCount !== undefined) {
      parts.push(`${details.beforeCount ?? 0} -> ${details.afterCount ?? 0}`);
    }
    if (details.passwordChanged !== undefined) parts.push(`password changed: ${details.passwordChanged ? "yes" : "no"}`);
    if (details.isActive !== undefined) parts.push(`active: ${details.isActive ? "yes" : "no"}`);
    return parts.length ? parts.join(", ") : JSON.stringify(details).slice(0, 120);
  }

  function normalizeAttachment(item = {}) {
    const assetId = normalizeText(item.assetId || item.asset_id);
    const isCloudAsset = Boolean(assetId);
    const isUploadedFile = Boolean(item.isUploadedFile || item.path || item.filename || isCloudAsset);
    const type = normalizeText(item.type || item.fileType || (isUploadedFile ? inferAttachmentType(item) : "hyperlink")).toLowerCase();
    const url = normalizeText(item.url || item.href || "");
    const originalName = normalizeText(item.originalName || item.originalname || item.name || item.label || item.filename || "Attachment");
    const name = normalizeText(item.name || item.label || originalName || url || "Attachment");
    return {
      id: item.id || uid("att"),
      type,
      name,
      url,
      filename: item.filename || "",
      originalName,
      path: item.path || "",
      assetId,
      category: item.category || "",
      version: item.version || "",
      storageProvider: item.storageProvider || "",
      mimetype: item.mimetype || "",
      isUploadedFile,
      size: item.size || "",
      createdAt: item.createdAt || new Date().toISOString()
    };
  }

  function normalizeAttachments(items) {
    return Array.isArray(items)
      ? items.map(normalizeAttachment).filter((item) => item.name || item.url || item.path || item.assetId)
      : [];
  }

  function uploadedMailAttachments(items = []) {
    return normalizeAttachments(items).filter((item) => item.assetId || (item.isUploadedFile && item.path));
  }

  function persistableAttachments(items = []) {
    return normalizeAttachments(items).filter((item) => !item.isUploadedFile || item.assetId);
  }

  function attachmentTypeLabel(type) {
    return {
      pdf: "PDF",
      word: "Word",
      excel: "Excel",
      image: "Image",
      video: "Video",
      hyperlink: "Hyper Link",
      file: "File",
      other: "Other"
    }[String(type || "").toLowerCase()] || "Attachment";
  }

  function formatAttachmentText(items = []) {
    const attachments = normalizeAttachments(items).filter((item) => !item.isUploadedFile || item.assetId);
    if (!attachments.length) return "";
    return attachments.map((item) => {
      const sizeText = item.size ? ` (${formatFileSize(item.size)})` : "";
      const label = item.isUploadedFile ? "File" : attachmentTypeLabel(item.type);
      return `- [${label}] ${item.originalName || item.name}${sizeText}${item.url ? `: ${item.url}` : ""}`;
    }).join("\n");
  }

  function renderEmailText(subject, body, attachments = []) {
    const attachmentText = formatAttachmentText(attachments);
    const renderedBody = String(body || "").split("{{emailAttachments}}").join(attachmentText);
    const shouldAppend = attachmentText && !/Attachments \/ Links:/i.test(renderedBody);
    return `Subject: ${subject || ""}\n\n${renderedBody}${shouldAppend ? `\n\nAttachments / Links:\n${attachmentText}` : ""}`;
  }

  function renderEmailBody(body, attachments = []) {
    const attachmentText = formatAttachmentText(attachments);
    const renderedBody = String(body || "").split("{{emailAttachments}}").join(attachmentText);
    const shouldAppend = attachmentText && !/Attachments \/ Links:/i.test(renderedBody) && !renderedBody.includes(attachmentText);
    return `${renderedBody}${shouldAppend ? `\n\nAttachments / Links:\n${attachmentText}` : ""}`;
  }

  function hasUnresolvedTemplateVariables(text = "") {
    return /\{\{[^}]+\}\}/.test(String(text || ""));
  }

  function suggestAction(customer) {
    const rating = customer.rating || "NR";
    const ready = Number(customer.scores?.readiness || 0);
    if (!customer.contactEmail) return "先補聯絡郵箱 / Verify contact email";
    if (rating === "A" && ready >= 60) return "高優先級寄信 / High priority outreach";
    if (rating === "A") return "高匹配，先確認窗口 / High fit, verify contact";
    if (rating === "B") return "中優先級追蹤 / Medium priority follow-up";
    if (rating === "C") return "低頻簡短觸達 / Light touch";
    if (rating === "NR") return "先補資料再判斷 / Enrich evidence first";
    return "暫緩或低頻 / Pause or low frequency";
  }

  const DB = {
    sharedReady: false,
    sharedSyncing: false,
    sharedWarning: "",
    pendingSharedWrites: {},
    read(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
      this.syncKey(key, value);
    },
    writeLocal(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    localSnapshot() {
      return {
        [STORAGE.customers]: this.read(STORAGE.customers, []),
        [STORAGE.products]: this.read(STORAGE.products, []),
        [STORAGE.logs]: this.read(STORAGE.logs, {}),
        [STORAGE.templates]: this.read(STORAGE.templates, DEFAULT_TEMPLATES),
        [STORAGE.settings]: this.getSettings(),
        [STORAGE.autoBackups]: this.read(STORAGE.autoBackups, {}),
        [STORAGE.analysisHistory]: this.read(STORAGE.analysisHistory, {}),
        [STORAGE.errorLogs]: this.read(STORAGE.errorLogs, []),
        [STORAGE.customerImportReviews]: this.getCustomerImportReviews()
      };
    },
    applySharedSnapshot(data = {}) {
      SHARED_STORAGE_KEYS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          this.writeLocal(key, data[key]);
        }
      });
    },
    hasAnyLocalBusinessData() {
      const customers = this.read(STORAGE.customers, []);
      const products = this.read(STORAGE.products, []);
      const logs = this.read(STORAGE.logs, {});
      const reviews = this.getCustomerImportReviews();
      return customers.length > 0 || products.length > 0 || Object.keys(logs || {}).length > 0
        || reviews.pending.length > 0 || reviews.invalid.length > 0;
    },
    snapshotHasBusinessData(data = {}) {
      return Array.isArray(data[STORAGE.customers]) && data[STORAGE.customers].length > 0
        || Array.isArray(data[STORAGE.products]) && data[STORAGE.products].length > 0
        || data[STORAGE.logs] && typeof data[STORAGE.logs] === "object" && Object.keys(data[STORAGE.logs]).length > 0
        || data[STORAGE.customerImportReviews] && (
          data[STORAGE.customerImportReviews].pending?.length > 0 || data[STORAGE.customerImportReviews].invalid?.length > 0
        );
    },
    async initSharedStore() {
      try {
        const response = await fetch(`${API_BASE}/api/db/snapshot`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || "SQLite shared database is unavailable.");
        const sharedData = payload.data || {};
        if (this.snapshotHasBusinessData(sharedData)) {
          this.applySharedSnapshot(sharedData);
        } else if (this.hasAnyLocalBusinessData()) {
          await this.pushSnapshot();
        } else {
          await this.pushSnapshot();
        }
        this.sharedReady = true;
        this.sharedWarning = "";
        this.writeLocal(SQLITE_SYNC_KEY, { enabled: true, lastSyncAt: new Date().toISOString() });
      } catch (error) {
        this.sharedReady = false;
        this.sharedWarning = error.message || "SQLite shared database is unavailable.";
        this.writeLocal(SQLITE_SYNC_KEY, { enabled: false, error: this.sharedWarning, lastSyncAt: new Date().toISOString() });
        console.warn("SQLite shared sync disabled:", error);
      }
    },
    async pushSnapshot() {
      if (!hasPermission("isAdmin")) {
        throw new Error("Full database restore is admin-only.");
      }
      const response = await fetch(`${API_BASE}/api/db/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: this.localSnapshot() })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to save SQLite snapshot.");
      if (payload.data) this.applySharedSnapshot(payload.data);
      return payload;
    },
    syncKey(key, value) {
      if (!SHARED_STORAGE_KEYS.includes(key)) return;
      if (!this.sharedReady) return;
      this.pendingSharedWrites[key] = value;
      this.flushSharedWrites();
    },
    async flushSharedWrites() {
      if (this.sharedSyncing) return;
      this.sharedSyncing = true;
      try {
        while (Object.keys(this.pendingSharedWrites).length) {
          const key = Object.keys(this.pendingSharedWrites)[0];
          const value = this.pendingSharedWrites[key];
          delete this.pendingSharedWrites[key];
          const response = await fetch(`${API_BASE}/api/db/key/${encodeURIComponent(key)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.success) throw new Error(payload.error || `Failed to sync ${key}.`);
          this.sharedReady = true;
          this.sharedWarning = "";
          this.writeLocal(SQLITE_SYNC_KEY, { enabled: true, lastSyncAt: new Date().toISOString(), key });
        }
      } catch (error) {
        this.sharedReady = false;
        this.sharedWarning = error.message || "SQLite shared sync failed.";
        this.writeLocal(SQLITE_SYNC_KEY, { enabled: false, error: this.sharedWarning, lastSyncAt: new Date().toISOString() });
        console.warn("SQLite shared sync failed:", error);
      } finally {
        this.sharedSyncing = false;
      }
    },
    getCustomers() {
      // TODO: 郵件附件功能預留。舊資料若沒有附件欄位，讀取時補空陣列，避免未來啟用時報錯。
      return this.read(STORAGE.customers, []).map((customer) => ({
        ...customer,
        city: customer.city || "",
        industry: customer.industry || "",
        groupId: normalizeGroupId(customer.groupId || customer.group_id),
        group_id: normalizeGroupId(customer.group_id || customer.groupId),
        buyingRole: normalizeBuyingRole(customer.buyingRole),
        isBuyingRoleManuallyReviewed: Boolean(customer.isBuyingRoleManuallyReviewed),
        customerScore: normalizeCustomerScore(customer.customerScore),
        emailContacts: normalizeEmailContacts(customer.emailContacts),
        emailPurpose: customer.emailPurpose || "First Touch",
        attachments: customer.attachments || [],
        emailDraft: {
          ...(customer.emailDraft || { subject: "", body: "" }),
          emailAttachments: persistableAttachments(customer.emailDraft?.emailAttachments)
        },
        emailHistory: Array.isArray(customer.emailHistory)
          ? customer.emailHistory.map((item) => ({ ...item, emailAttachments: persistableAttachments(item.emailAttachments) }))
          : customer.emailHistory
      }));
    },
    setCustomers(customers) {
      const previous = this.getCustomers();
      const next = Array.isArray(customers) ? customers : [];
      if (!canManageCustomers()) throw new Error("Customer changes are not allowed for this role.");
      if (!canDeleteCustomers()) {
        const previousIds = new Set(previous.map((item) => String(item.id || "")).filter(Boolean));
        const nextIds = new Set(next.map((item) => String(item.id || "")).filter(Boolean));
        if ([...previousIds].some((id) => !nextIds.has(id))) {
          throw new Error("Users cannot delete customer records.");
        }
      }
      this.write(STORAGE.customers, customers);
    },
    normalizeProduct(product = {}) {
      const {
        status: _deprecatedStatus,
        Status: _deprecatedStatusLabel,
        productStatus: _deprecatedProductStatus,
        ...cleanProduct
      } = product;
      const targetPriorities = normalizeTargetPriorities(cleanProduct.targetPriorities);
      const primary = primaryTargetPriority({ ...cleanProduct, targetPriorities });
      return {
        ...cleanProduct,
        targetPriorities,
        priority: Object.keys(targetPriorities).length ? primary[1] : cleanProduct.priority ?? "",
        sku: cleanProduct.sku || "",
        description: cleanProduct.description || "",
        price: cleanProduct.price ?? "",
        productUrl: cleanProduct.productUrl || "",
        launchDate: cleanProduct.launchDate || "",
        recommendedFor: Object.keys(targetPriorities).length ? primary[0] : normalizeRecommendedFor(cleanProduct.recommendedFor)
      };
    },
    getProducts() {
      const products = this.read(STORAGE.products, []).map((product) => this.normalizeProduct(product));
      if (products.length) return products;
      const seeded = DEFAULT_PRODUCTS.map((item) => ({
        id: uid("prod"),
        createdAt: new Date().toISOString(),
        ...item
      }));
      if (canManageProducts()) this.setProducts(seeded);
      else this.writeLocal(STORAGE.products, seeded);
      return seeded;
    },
    setProducts(products) {
      if (!canManageProducts()) throw new Error("Product changes are not allowed for this role.");
      this.write(STORAGE.products, (products || []).map((product) => this.normalizeProduct(product)));
    },
    getLogs() {
      return this.read(STORAGE.logs, {});
    },
    setLogs(logs) {
      this.write(STORAGE.logs, logs);
    },
    getTemplates() {
      const templates = this.read(STORAGE.templates, null);
      if (templates) return templates;
      this.setTemplates(DEFAULT_TEMPLATES);
      return DEFAULT_TEMPLATES;
    },
    setTemplates(templates) {
      this.write(STORAGE.templates, templates);
    },
    getSettings() {
      return this.read(STORAGE.settings, {
        analysisVersion: "1.0",
        lastBackup: "",
        scoringRules: SCORING_RULES.map(({ key, label, weight }) => ({ key, label, weight }))
      });
    },
    setSettings(settings) {
      this.write(STORAGE.settings, settings);
    },
    getBackups() {
      const raw = this.read(STORAGE.autoBackups, {});
      if (Array.isArray(raw)) return raw;
      return Object.values(raw || {}).sort((a, b) => String(b.createdAt || b.exportedAt || "").localeCompare(String(a.createdAt || a.exportedAt || "")));
    },
    setBackups(backups) {
      const next = {};
      backups.slice(0, 5).forEach((backup) => {
        const stamp = String(backup.createdAt || backup.exportedAt || new Date().toISOString())
          .replace(/[-:T.Z]/g, "")
          .slice(0, 14);
        next[`backup_${stamp}`] = backup;
      });
      this.write(STORAGE.autoBackups, next);
    },
    getAnalysisHistory() {
      return this.read(STORAGE.analysisHistory, {});
    },
    setAnalysisHistory(history) {
      this.write(STORAGE.analysisHistory, history);
    },
    addAnalysisHistory(customerId, snapshot) {
      if (!customerId) return;
      const history = this.getAnalysisHistory();
      history[customerId] = Array.isArray(history[customerId]) ? history[customerId] : [];
      history[customerId].unshift({
        analyzedAt: new Date().toISOString(),
        rating: snapshot.rating,
        scores: snapshot.scores,
        recommendedProducts: snapshot.recommendedProducts || [],
        emailDraft: snapshot.emailDraft || { subject: "", body: "", emailAttachments: [] }
      });
      history[customerId] = history[customerId].slice(0, 20);
      this.setAnalysisHistory(history);
    },
    getErrorLogs() {
      return this.read(STORAGE.errorLogs, []);
    },
    setErrorLogs(logs) {
      this.write(STORAGE.errorLogs, logs);
    },
    getCustomerImportReviews() {
      const value = this.read(STORAGE.customerImportReviews, {});
      return {
        importedAt: value.importedAt || "",
        sourceFile: value.sourceFile || "",
        counts: value.counts || { total: 0, valid: 0, pending: 0, invalid: 0, added: 0 },
        pending: Array.isArray(value.pending) ? value.pending : [],
        invalid: Array.isArray(value.invalid) ? value.invalid : []
      };
    },
    setCustomerImportReviews(value) {
      this.write(STORAGE.customerImportReviews, value || {});
    },
    addErrorLog(operation, error, customer = {}) {
      const logs = this.getErrorLogs();
      logs.unshift({
        timestamp: new Date().toISOString(),
        operation,
        message: error?.message || String(error || "Unknown error"),
        customerId: customer.id || "",
        customerName: customer.companyName || ""
      });
      this.setErrorLogs(logs.slice(0, 100));
    },
    clearErrorLogs() {
      this.setErrorLogs([]);
    },
    snapshot() {
      return {
        exportedAt: new Date().toISOString(),
        phottix_customers: this.getCustomers(),
        phottix_products: this.getProducts(),
        phottix_followup_logs: this.getLogs(),
        phottix_email_templates: this.getTemplates(),
        phottix_settings: this.getSettings(),
        phottix_analysis_history: this.getAnalysisHistory(),
        phottix_error_logs: this.getErrorLogs(),
        phottix_customer_import_reviews: this.getCustomerImportReviews()
      };
    },
    backup(reason = "manual") {
      const snapshot = { reason, createdAt: new Date().toISOString(), ...this.snapshot() };
      const backups = this.getBackups();
      backups.unshift(snapshot);
      this.setBackups(backups.slice(0, 5));
      this.setSettings({ ...this.getSettings(), lastBackup: new Date().toISOString() });
      return snapshot;
    },
    restore(snapshot) {
      if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid backup JSON.");
      if (Array.isArray(snapshot.phottix_customers)) this.setCustomers(snapshot.phottix_customers);
      if (Array.isArray(snapshot.phottix_products)) this.setProducts(snapshot.phottix_products);
      if (snapshot.phottix_followup_logs) this.setLogs(snapshot.phottix_followup_logs);
      if (snapshot.phottix_email_templates) this.setTemplates(snapshot.phottix_email_templates);
      if (snapshot.phottix_settings) this.setSettings(snapshot.phottix_settings);
      if (snapshot.phottix_analysis_history) this.setAnalysisHistory(snapshot.phottix_analysis_history);
      if (snapshot.phottix_error_logs) this.setErrorLogs(snapshot.phottix_error_logs);
      if (snapshot.phottix_customer_import_reviews) this.setCustomerImportReviews(snapshot.phottix_customer_import_reviews);
    }
  };

  const ScoringEngine = {
    SCORING_RULES,
    buildText(input) {
      return [
        input.companyName,
        input.website,
        input.country,
        input.city,
        input.industry,
        input.businessNotes,
        input.manualWebsiteSummary,
        input.websiteExtract,
        input.instagram,
        input.facebook
      ].filter(Boolean).join("\n");
    },
    getBusinessSignals(input) {
      const text = this.buildText(input);
      const details = SCORING_RULES.map((rule) => {
        const matched = rule.key === "completeWebsite"
          ? normalizeText(input.websiteExtract || input.manualWebsiteSummary).length >= 300
          : rule.terms.some((term) => term.test(text));
        return {
          key: rule.key,
          ruleName: rule.label,
          condition: rule.key === "completeWebsite" ? "website/manual extract length >= 300 chars" : rule.terms.map(String).join(" | "),
          score: rule.weight,
          matched
        };
      });
      return details;
    },
    calculate(input) {
      const details = this.getBusinessSignals(input);
      const score = details.reduce((sum, item) => sum + (item.matched ? item.score : 0), 0);
      const evidenceText = normalizeText(this.buildText(input));
      const evidenceEnough = evidenceText.length >= 80 || details.some((item) => item.matched && item.key !== "completeWebsite");
      const rating = ratingFromScore(score, evidenceEnough);
      const signals = details.filter((item) => item.matched && item.key !== "completeWebsite").map((item) => item.ruleName);
      const confidence = Math.min(100, (input.website ? 20 : 0) + (input.websiteExtract?.length >= 300 ? 45 : input.websiteExtract ? 20 : 0) + (input.manualWebsiteSummary ? 20 : 0) + Math.min(15, signals.length * 3));
      const productFit = Math.min(100, signals.length * 12 + (details.find((item) => item.key === "wholesale")?.matched ? 18 : 0) + (details.find((item) => item.key === "cameraStore")?.matched ? 15 : 0));
      const readiness = Math.min(100, (rating === "A" ? 35 : rating === "B" ? 25 : rating === "C" ? 14 : 5) + (input.contactEmail ? 20 : 0) + (input.contactName ? 8 : 0) + Math.round(confidence * 0.28) + Math.round(productFit * 0.18));
      return {
        rating,
        totalScore: score,
        details,
        businessSignals: signals,
        scores: {
          priority: Math.min(100, score),
          productFit,
          confidence,
          readiness
        }
      };
    }
  };

  const RecommendationEngine = {
    isProductReadyLead(scoring) {
      return Boolean(scoring);
    },
    recommend(customer, scoring) {
      if (!this.isProductReadyLead(scoring)) return [];
      const target = recommendedForFromBuyingRole(customer.buyingRole);
      const products = DB.getProducts()
        .filter((product) => {
          if (!product.inRecommendationPool) return false;
          const priorities = productTargetPriorities(product);
          if (target === "All") return priorities.All !== undefined;
          return priorities[target] !== undefined || priorities.All !== undefined;
        });
      const signals = scoring.businessSignals.join(" ").toLowerCase();
      const scored = products.map((product) => {
        const text = `${product.name} ${product.category}`.toLowerCase();
        const priorities = productTargetPriorities(product);
        const exactPriority = priorities[target];
        const matchedTarget = exactPriority !== undefined ? target : "All";
        const recommendationPriority = exactPriority ?? priorities.All ?? 999;
        let score = product.isPriority ? 20 : 0;
        if (exactPriority !== undefined) score += 30;
        if (/wholesale|retail|camera store|online shop/.test(signals) && /lighting|modifier|flash|trigger|accessor/i.test(text)) score += 20;
        if (/studio|creator|events/.test(signals) && /lighting|softbox|panel|stand|modifier/i.test(text)) score += 18;
        if (/services/.test(signals) && /support|accessor|stand|trigger/i.test(text)) score += 10;
        if (/lighting|led|rgb|cob|softbox/i.test(text)) score += 8;
        return { ...product, matchScore: score, matchedTarget, recommendationPriority };
      })
        .sort((a, b) => Number(a.recommendationPriority || 999) - Number(b.recommendationPriority || 999) || b.matchScore - a.matchScore || a.name.localeCompare(b.name))
        .slice(0, 3);
      return scored.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        sku: product.sku || "",
        description: product.description || "",
        productUrl: product.productUrl || "",
        matchedTarget: product.matchedTarget,
        targetPriority: product.recommendationPriority,
        targetPriorityCode: `${product.matchedTarget}-${product.recommendationPriority}`,
        reason: this.reason(product, scoring)
      }));
    },
    reason(product, scoring) {
      if (/Lighting|Modifiers/i.test(product.category)) return `Strong fit for photo/video partners, stores, studios, and lighting-related assortment.`;
      if (/Flash|Trigger/i.test(product.category)) return `Good add-on for camera retailers and photographer-focused channels.`;
      return `Relevant accessory or support item for bundle and upsell discussion.`;
    }
  };

  const EmailEngine = {
    describeSignals(signals = []) {
      const set = new Set(signals);
      const descriptions = [];
      if (set.has("Retail") || set.has("Camera Store") || set.has("Online Shop")) {
        descriptions.push("camera retail and photo/video equipment sales");
      }
      if (set.has("Wholesale")) descriptions.push("dealer or distribution business");
      if (set.has("Physical Store")) descriptions.push("a physical retail presence");
      if (set.has("Studio")) descriptions.push("studio and production work");
      if (set.has("Services")) descriptions.push("service or support work");
      if (set.has("Events")) descriptions.push("workshops or industry events");
      if (set.has("Creator")) descriptions.push("content creation");
      return [...new Set(descriptions)].slice(0, 2).join(" and ") || "photo and video products";
    },
    describeProducts(items = []) {
      const names = items.map((item) => item.name || item).filter(Boolean).slice(0, 3);
      if (!names.length) return "LED lighting, softboxes, and photo/video accessories";
      if (names.length === 1) return names[0];
      return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    },
    strategy(customer) {
      const role = normalizeBuyingRole(customer.buyingRole);
      const map = {
        "A": {
          message: "professional and pricing-oriented, with priority on high-value Priority 1 products"
        },
        "B": {
          message: "friendly and showroom-oriented, with priority on easy-to-display popular products"
        },
        "C": {
          message: "concise and logistics-oriented, with priority on lightweight or entry-level products"
        },
        "D": {
          message: "warm and service-oriented, with priority on bundles and after-sales support"
        }
      };
      return map[role] || null;
    },
    recommendedProductsForEmail(customer, analysis) {
      return (analysis?.recommendedProducts || []).slice(0, 3);
    },
    variables(customer, analysis) {
      const products = analysis?.emailRecommendedProducts || analysis?.recommendedProducts || customer.recommendedProducts || [];
      const signals = analysis?.businessSignals || customer.businessSignals || [];
      const emailStrategy = analysis?.emailStrategy || this.strategy(customer, analysis);
      return {
        "{{公司名}}": customer.companyName || "your team",
        "{{聯絡人}}": normalizeContactName(customer.contactName, customer.contactEmail) || "there",
        "{{稱呼}}": emailGreeting(customer),
        "{{官網}}": customer.website || "",
        "{{客戶類型}}": customer.customerType || "prospect",
        "{{官網發現的產品線}}": this.describeSignals(signals),
        "{{推薦產品}}": this.describeProducts(products),
        "{{評分}}": `${analysis?.rating || customer.rating || "NR"} / ${analysis?.totalScore || ""}`,
        "{{郵件目的}}": customer.emailPurpose || dom.emailPurpose?.value || "First Touch",
        "{{郵件推薦策略}}": emailStrategy?.message || "",
        "{{emailAttachments}}": formatAttachmentText(state.emailAttachments)
      };
    },
    renderTemplate(template, variables) {
      let subject = template.subject || "";
      let body = template.body || "";
      for (const [key, value] of Object.entries(variables)) {
        subject = subject.split(key).join(value || "");
        body = body.split(key).join(value || "");
      }
      if (variables["{{聯絡人}}"] === "there" && variables["{{稱呼}}"] ) {
        body = body.replace(/^\s*(?:Hi|Hello|Dear)\s+there,\s*$/gim, variables["{{稱呼}}"]);
      }
      return { subject, body };
    },
    generate(customer, analysis) {
      const emailStrategy = this.strategy(customer, analysis);
      const emailRecommendedProducts = this.recommendedProductsForEmail(customer, analysis);
      const emailAnalysis = { ...analysis, emailStrategy, emailRecommendedProducts };
      if (!analysis?.recommendedProducts?.length) {
        const company = customer.companyName || "your team";
        return {
          subject: `Quick Phottix introduction for ${company}`,
          body: [
            emailGreeting(customer),
            "",
            `I came across ${company} and wanted to make a brief introduction from Phottix.`,
            "",
            "We work with photo and video partners on lighting and accessory solutions, and I wanted to check whether there is a suitable person on your team who reviews new brand or product line opportunities.",
            "",
            "No pressure at all. If it is relevant, I would be happy to send a short product overview first.",
            "",
            "If there is a better contact for this kind of discussion, I would also appreciate being pointed in the right direction.",
            "",
            "Best regards,",
            "[Your Name]",
            "Phottix Business Development Team"
          ].join("\n")
        };
      }
      if ((customer.emailPurpose || "") === "New Product Promotion") {
        const company = customer.companyName || "your team";
        const products = this.describeProducts(emailRecommendedProducts || customer.recommendedProducts || []);
        const isExisting = customer.customerType === "existing";
        return {
          emailRecommendedProducts,
          emailStrategy,
          subject: isExisting
            ? `New Phottix product update for ${company}`
            : `New Phottix products for ${company}`,
          body: isExisting ? [
            emailGreeting(customer),
            "",
            `I wanted to share a quick update on our new Phottix products that may be useful for ${company}'s next product refresh or reorder planning.`,
            "",
            `The items I would suggest reviewing first are ${products}.`,
            "",
            "Would you like me to send the latest overview, availability, and sample pricing?",
            "",
            "Best regards,",
            "[Your Name]",
            "Phottix Business Development Team"
          ].filter((line) => line !== null).join("\n") : [
            emailGreeting(customer),
            "",
            `I came across ${company} and wanted to briefly introduce a few new Phottix products that may fit your photo/video equipment range.`,
            "",
            `A few items that may be worth a quick look are ${products}.`,
            "",
            "No pressure at all, but would it be alright if I sent over a short product overview for the right person on your team?",
            "",
            "If there is a better contact for new product line discussions, I would also appreciate being pointed in the right direction.",
            "",
            "Best regards,",
            "[Your Name]",
            "Phottix Business Development Team"
          ].filter((line) => line !== null).join("\n")
        };
      }
      const templates = DB.getTemplates();
      const key = purposeKey(customer.emailPurpose || "First Touch");
      const template = templates[key] || templates.first_touch || DEFAULT_TEMPLATES.first_touch;
      const rendered = this.renderTemplate(template, this.variables(customer, emailAnalysis));
      return { ...rendered, emailRecommendedProducts, emailStrategy };
    }
  };

  const ExcelHandler = {
    customerFileKeywords: [
      "customer",
      "customers",
      "client",
      "clients",
      "contact",
      "contacts",
      "buyer",
      "buyers",
      "email",
      "emails",
      "mailing",
      "mailing list",
      "company",
      "companies",
      "prospect",
      "prospects",
      "lead",
      "leads",
      "dealer",
      "dealers",
      "distributor",
      "distributors",
      "account",
      "accounts",
      "客戶",
      "客户",
      "聯絡",
      "联系人",
      "聯繫人"
    ],
    productFileKeywords: [
      "product",
      "products",
      "price",
      "price list",
      "pricelist",
      "catalog",
      "catalogue",
      "sku",
      "產品",
      "产品",
      "價格",
      "价格",
      "價目",
      "价目"
    ],
    customerFileExclusionKeywords: [
      "product",
      "products",
      "price",
      "price list",
      "pricelist",
      "catalog",
      "catalogue",
      "sku",
      "img",
      "image",
      "images",
      "photo",
      "photos",
      "picture",
      "pictures",
      "decision",
      "decision table",
      "purchase",
      "purchase request",
      "procurement",
      "requirement",
      "requirements",
      "需求",
      "採購",
      "采购",
      "phottix_product_import"
    ],
    matchesFileKeyword(text = "", keyword = "") {
      const source = normalizeText(text).toLowerCase();
      const needle = normalizeText(keyword).toLowerCase();
      if (!needle) return false;
      return source.includes(needle) || source.replace(/\s+/g, "").includes(needle.replace(/\s+/g, ""));
    },
    isCustomerFile(filename = "") {
      const text = normalizeText(filename).toLowerCase();
      const hasCustomerSignal = this.customerFileKeywords.some((keyword) => this.matchesFileKeyword(text, keyword));
      const hasUnrelatedSignal = this.customerFileExclusionKeywords.some((keyword) => this.matchesFileKeyword(text, keyword));
      return hasCustomerSignal && !hasUnrelatedSignal;
    },
    isProductFile(filename = "") {
      const text = normalizeText(filename).toLowerCase();
      return this.productFileKeywords.some((keyword) => this.matchesFileKeyword(text, keyword));
    },
    async listImportFiles() {
      const response = await fetch(`${API_BASE}/list-excel`);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        const error = new Error(payload.error || "Failed to list import files.");
        error.hostOnly = Boolean(payload.hostOnly);
        throw error;
      }
      return payload;
    },
    async parseConfigFile(filename) {
      const response = await fetch(`${API_BASE}/api/parse-excel-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: filename })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Excel config import failed.");
      return payload.data || payload.rows || [];
    },
    async parseUploadedCustomerFile(file) {
      if (!file) throw new Error("Please choose a customer Excel file first.");
      const formData = new FormData();
      formData.append("customerExcel", file);
      const response = await fetch(`${API_BASE}/api/import-customer-excel-upload`, {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Customer Excel upload failed.");
      return {
        rows: payload.data || payload.rows || [],
        classification: payload.classification || null,
        fileName: payload.fileName || file.name || "customer-import.xlsx"
      };
    },
    async parseUploadedExcelFile(file) {
      if (!file) throw new Error("Please choose an Excel file first.");
      const formData = new FormData();
      formData.append("excelFile", file);
      const response = await fetch(`${API_BASE}/api/import-excel-upload`, {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Excel upload failed.");
      return payload.data || payload.rows || [];
    },
    selectedImportFilename(selectEl = dom.customerImportFileSelect, indexEl = dom.customerImportIndex) {
      const files = Array.from(selectEl.options).map((option) => option.value).filter(Boolean);
      const index = Number(indexEl.value || selectEl.selectedIndex + 1);
      if (!Number.isInteger(index) || index < 1 || index > files.length) {
        throw new Error(`Please enter a file number from 1 to ${files.length || 0}.`);
      }
      return files[index - 1];
    },
    importCustomerRows(rows, options = {}) {
      DB.backup("before_customer_import");
      const customers = DB.getCustomers();
      const classification = CustomerClassification.classifyRows(rows);
      const targetGroupId = normalizeGroupId(options.groupId ?? dom.customerImportGroupSelect?.value);
      const detectedOldCustomerImport = rows.some((row) => isOldCustomerImportRow(row));
      if (detectedOldCustomerImport && dom.customerImportGroupSelect) {
        dom.customerImportGroupSelect.value = getOldCustomerGroupId();
      }
      let added = 0;
      let skipped = 0;
      let forceUpdated = 0;
      let movedGroup = 0;
      let oldCustomerRetained = 0;
      for (const classifiedRow of classification.rows) {
        const row = classifiedRow.row;
        const rowIsOldCustomer = isOldCustomerImportRow(row);
        const keepAsOldCustomer = rowIsOldCustomer || isOldCustomerGroupId(targetGroupId);
        if (classifiedRow.status !== CustomerClassification.STATUS.VALID && !keepAsOldCustomer) continue;
        const incoming = normalizeImportedCustomer(row);
        if (incoming.buyingRole === "Unknown" && classifiedRow.buyingRole) {
          incoming.buyingRole = classifiedRow.buyingRole;
          incoming.isBuyingRoleManuallyReviewed = false;
        }
        incoming.importClassification = keepAsOldCustomer && classifiedRow.status !== CustomerClassification.STATUS.VALID
          ? "old_customer_review"
          : "valid";
        incoming.importOriginalClassification = classifiedRow.status;
        incoming.importReviewReason = classifiedRow.reason || "";
        incoming.isOldCustomer = keepAsOldCustomer;
        incoming._normalizedDomain = importedRowDomain(row) || normalizeDomain(incoming.website);
        const importedGroupId = normalizeGroupId(incoming.groupId || incoming.group_id);
        const effectiveGroupId = keepAsOldCustomer
          ? getOldCustomerGroupId()
          : (targetGroupId || importedGroupId);
        if (effectiveGroupId) {
          incoming.groupId = effectiveGroupId;
          incoming.group_id = effectiveGroupId;
        }
        if (!incoming.companyName && !incoming.website && !incoming.contactEmail) continue;
        if (keepAsOldCustomer) oldCustomerRetained += 1;
        const index = customers.findIndex((item) => isDuplicateCustomer(item, incoming));
        if (index >= 0) {
          if (isForceUpdateRow(row)) {
            const cleanIncoming = removeEmpty(stripTransientCustomerFields(incoming));
            if (!incoming.isBuyingRoleManuallyReviewed) {
              delete cleanIncoming.buyingRole;
            }
            customers[index] = {
              ...customers[index],
              ...cleanIncoming,
              id: customers[index].id,
              isBuyingRoleManuallyReviewed: customers[index].isBuyingRoleManuallyReviewed || incoming.isBuyingRoleManuallyReviewed
            };
            forceUpdated += 1;
          } else if (options.forceGroup && effectiveGroupId) {
            customers[index] = {
              ...customers[index],
              groupId: effectiveGroupId,
              group_id: effectiveGroupId
            };
            movedGroup += 1;
          } else {
            skipped += 1;
          }
        } else {
          customers.push(stripTransientCustomerFields(incoming));
          added += 1;
        }
      }
      const reviewPayload = {
        importedAt: new Date().toISOString(),
        sourceFile: options.fileName || "",
        counts: { ...classification.counts, added, skipped, forceUpdated, movedGroup, oldCustomerRetained },
        pending: classification.rows.filter((item) => item.status === CustomerClassification.STATUS.PENDING).map((item) => ({
          rowNumber: item.rowNumber,
          status: item.status,
          reason: item.reason,
          buyingRole: item.buyingRole,
          row: item.row
        })),
        invalid: classification.rows.filter((item) => item.status === CustomerClassification.STATUS.INVALID).map((item) => ({
          rowNumber: item.rowNumber,
          status: item.status,
          reason: item.reason,
          buyingRole: item.buyingRole,
          row: item.row
        }))
      };
      DB.setCustomers(customers);
      DB.setCustomerImportReviews(reviewPayload);
      UI.refreshAll();
      UI.toast(`导入完成：总记录 ${classification.counts.total}，有效 ${classification.counts.valid}，待分类 ${classification.counts.pending}，无效 ${classification.counts.invalid}。新增客户池 ${added}。`, "good");
    },
    async importCustomersFromConfig(filename) {
      const cleanName = normalizeText(filename || this.selectedImportFilename()).replace(/^["']|["']$/g, "");
      if (!cleanName) throw new Error("Please type or select an Excel filename first.");
      this.importCustomerRows(await this.parseConfigFile(cleanName), { groupId: dom.customerImportGroupSelect?.value, forceGroup: true });
    },
    async importCustomersFromUpload(file) {
      const payload = await this.parseUploadedCustomerFile(file);
      this.importCustomerRows(payload.rows, {
        groupId: dom.customerImportGroupSelect?.value,
        forceGroup: true,
        fileName: payload.fileName || file.name
      });
    },
    importProductRows(rows) {
      DB.backup("before_product_import");
      const products = DB.getProducts();
      const incomingByKey = new Map();
      let added = 0;
      let overwritten = 0;
      let skipped = 0;
      for (const row of rows) {
        const incoming = normalizeImportedProduct(row);
        if (!incoming.name) continue;
        const key = incoming.sku
          ? `sku:${incoming.sku.toLowerCase()}`
          : `name:${incoming.name.toLowerCase()}`;
        const duplicate = incomingByKey.get(key);
        if (duplicate) {
          incomingByKey.set(key, mergeProductTargetData(duplicate, incoming));
          continue;
        }
        incomingByKey.set(key, incoming);
      }
      const duplicateCount = [...incomingByKey.values()].filter((incoming) => products.some((item) => {
        const sameSku = incoming.sku && item.sku && String(item.sku).toLowerCase() === String(incoming.sku).toLowerCase();
        const sameName = String(item.name || "").toLowerCase() === String(incoming.name || "").toLowerCase();
        return sameSku || (!incoming.sku && sameName);
      })).length;
      const overwriteDuplicates = duplicateCount > 0
        ? confirm(`发现 ${duplicateCount} 个已存在的产品。确定：批量更新这些产品；取消：保留现有资料，只加入新 SKU。`)
        : false;
      for (const incoming of incomingByKey.values()) {
        const index = products.findIndex((item) => {
          const sameSku = incoming.sku && item.sku && String(item.sku).toLowerCase() === String(incoming.sku).toLowerCase();
          const sameName = String(item.name || "").toLowerCase() === String(incoming.name || "").toLowerCase();
          return sameSku || (!incoming.sku && sameName);
        });
        if (index >= 0) {
          if (overwriteDuplicates) {
            products[index] = mergeProductTargetData(products[index], incoming);
            products[index].id = products[index].id || incoming.id;
            overwritten += 1;
          } else {
            skipped += 1;
          }
        } else {
          products.push(incoming);
          added += 1;
        }
      }
      DB.setProducts(products);
      UI.renderProductList();
      UI.toast(`Imported products. Added: ${added}. Overwritten: ${overwritten}. Skipped: ${skipped}.`, "good");
    },
    async importProductsFromUpload(file) {
      this.importProductRows(await this.parseUploadedExcelFile(file));
    },
    async exportCustomers(scope = 'all') {
      const allCustomers = DB.getCustomers();
      let selectedCustomers = allCustomers;
      let filenameScope = 'all';
      if (scope === 'group') {
        const selectedGroupId = dom.groupFilter?.value || '';
        if (!selectedGroupId) throw new Error('Please select a customer group before exporting the current group.');
        selectedCustomers = selectedGroupId === '__ungrouped__' ? allCustomers.filter((customer) => !normalizeGroupId(customer.groupId || customer.group_id)) : allCustomers.filter((customer) => normalizeGroupId(customer.groupId || customer.group_id) === selectedGroupId);
        filenameScope = selectedGroupId === '__ungrouped__' ? 'ungrouped' : groupName(selectedGroupId).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase() || 'group';
      } else if (scope === 'filtered') {
        selectedCustomers = filterCustomers(allCustomers);
        filenameScope = 'filtered';
      }
      if (!selectedCustomers.length) throw new Error('There are no customers in this export scope.');
      const customers = selectedCustomers.map((customer) => ({
        id: customer.id,
        company_name: customer.companyName,
        contact_name: customer.contactName,
        contact_email: customer.contactEmail,
        country: customer.country,
        city: customer.city,
        industry: customer.industry,
        main_products: customer.mainProducts || "",
        group_id: normalizeGroupId(customer.groupId || customer.group_id),
        group_name: groupName(customer.groupId || customer.group_id),
        buying_role: normalizeBuyingRole(customer.buyingRole),
        buying_role_manually_reviewed: customer.isBuyingRoleManuallyReviewed ? "YES" : "NO",
        customer_score: customer.customerScore ?? "",
        customer_type: customer.customerType,
        rating: customer.rating,
        customer_priority: customer.scores?.priority || "",
        product_fit: customer.scores?.productFit || "",
        data_confidence: customer.scores?.confidence || "",
        outreach_readiness: customer.scores?.readiness || "",
        recommended_products: (customer.recommendedProducts || []).map((item) => item.name || item).join(" | "),
        email_subject: customer.emailDraft?.subject || "",
        email_body: customer.emailDraft?.body || "",
        follow_up_status: customer.followUpStatus,
        next_follow_up_date: customer.nextFollowUpDate,
        last_contact_date: customer.lastContactDate,
        suggested_action: suggestAction(customer),
        website: customer.website,
        notes: customer.notes,
        email_purpose: customer.emailPurpose
      }));
      const response = await fetch(`${API_BASE}/api/generate-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType: "customer", data: customers })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Export failed.");
      }
      downloadBlob(await response.blob(), `phottix_customers_${filenameScope}_${Date.now()}.xlsx`);
      UI.toast("Excel exported: " + customers.length + " customers.", "good");
    },
    async importUpdateRows(rows) {
      DB.backup("before_excel_update_import");
      const customers = DB.getCustomers();
      let updated = 0;
      let added = 0;
      let skipped = 0;
      for (const row of rows) {
        const normalized = normalizeKeys(row);
        const id = normalized.id || "";
        const incoming = normalizeImportedCustomer(row);
        incoming._normalizedDomain = importedRowDomain(row) || normalizeDomain(incoming.website);
        const index = customers.findIndex((item) => (id && item.id === id) || isDuplicateCustomer(item, incoming));
        if (index < 0) {
          customers.push(stripTransientCustomerFields(incoming));
          added += 1;
          continue;
        }
        if (!isForceUpdateRow(row)) {
          skipped += 1;
          continue;
        }
        customers[index] = {
          ...customers[index],
          followUpStatus: normalized.followupstatus || normalized.follow_up_status || customers[index].followUpStatus,
          nextFollowUpDate: normalized.nextfollowupdate || normalized.next_follow_up_date || customers[index].nextFollowUpDate,
          lastContactDate: normalized.lastcontactdate || normalized.last_contact_date || customers[index].lastContactDate,
          notes: [customers[index].notes, normalized.notes].filter(Boolean).join(" | "),
          buyingRole: incoming.isBuyingRoleManuallyReviewed ? incoming.buyingRole : customers[index].buyingRole,
          isBuyingRoleManuallyReviewed: customers[index].isBuyingRoleManuallyReviewed || incoming.isBuyingRoleManuallyReviewed,
          customerScore: incoming.customerScore ?? customers[index].customerScore,
          groupId: incoming.groupId || customers[index].groupId || customers[index].group_id || "",
          group_id: incoming.group_id || customers[index].group_id || customers[index].groupId || ""
        };
        updated += 1;
      }
      DB.setCustomers(customers);
      UI.refreshAll();
      UI.toast(`Imported update. Updated ${updated}. Added ${added}. Skipped ${skipped}.`, updated || added ? "good" : "warn");
    },
    async importUpdateFromConfig(filename) {
      const cleanName = normalizeText(filename || this.selectedImportFilename()).replace(/^["']|["']$/g, "");
      if (!cleanName) throw new Error("Please type or select an Excel filename first.");
      this.importUpdateRows(await this.parseConfigFile(cleanName));
    }
  };

  const CustomTemplateApi = {
    async list() {
      const response = await fetch(`${API_BASE}/api/custom-templates`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to load custom templates.");
      state.customTemplates = Array.isArray(payload.templates) ? payload.templates : [];
      return state.customTemplates;
    },
    async save(name, templateInput = {}) {
      if (!canManageTemplates()) throw new Error("Only Admin, Sales Manager, or Gina can modify Email templates.");
      const body = {
        name: normalizeText(name),
        subject: String(templateInput.subject ?? dom.templateSubject.value ?? "").trim(),
        body: String(templateInput.body ?? dom.templateBody.value ?? "").trim(),
        purpose: String(templateInput.purpose || "custom").trim() || "custom"
      };
      if (!body.name) throw new Error("Template name is required.");
      if (!body.subject || !body.body) throw new Error("Template subject and body are required.");
      const response = await fetch(`${API_BASE}/api/custom-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to save custom template.");
      await this.list();
      state.selectedTemplateKind = "custom";
      state.selectedCustomTemplateId = payload.template?.id || "";
      UI.renderTemplateEditor({
        preserveContent: Boolean(templateInput.preserveCurrentEditor),
        selectedValue: `custom:${state.selectedCustomTemplateId}`
      });
      UI.toast(payload.updated ? "Custom template updated." : "Custom template saved.", "good");
      return payload.template;
    },
    async remove(id) {
      if (!canManageTemplates()) throw new Error("Only Admin, Sales Manager, or Gina can modify Email templates.");
      const response = await fetch(`${API_BASE}/api/custom-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to delete custom template.");
      await this.list();
      state.selectedTemplateKind = "default";
      state.selectedCustomTemplateId = "";
      UI.renderTemplateEditor({ selectedValue: `default:${purposeKey("First Touch")}` });
      UI.toast("Custom template deleted.", "good");
    }
  };

  const AuthApi = {
    async me() {
      const response = await fetch(`${API_BASE}/api/auth/me`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to load current user.");
      state.username = String(payload.user?.username || "").trim();
      state.userRole = payload.user?.role || "sales";
      state.permissions = payload.permissions || {};
      state.isHostAdmin = Boolean(payload.permissions?.isAdmin || state.userRole === "admin");
      return payload.user;
    }
  };

  const SenderApi = {
    async list() {
      const response = await fetch(`${API_BASE}/api/senders`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to load senders.");
      state.senders = Array.isArray(payload.senders) ? payload.senders : [];
      state.isHostAdmin = Boolean(payload.hostOnly || state.isHostAdmin);
      return state.senders;
    },
    async save() {
      const id = normalizeText(dom.senderId.value);
      const body = {
        name: normalizeText(dom.senderName.value),
        email: normalizeText(dom.senderEmail.value),
        appPassword: normalizeText(dom.senderAppPassword.value).replace(/\s+/g, "")
      };
      if (!body.name || !body.email) throw new Error("Please enter sender name and email.");
      if (!id && !body.appPassword) throw new Error("Please enter Gmail App Password.");
      const response = await fetch(`${API_BASE}/api/senders${id ? `/${encodeURIComponent(id)}` : ""}`, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to save sender.");
      clearSenderForm();
      await refreshSenders();
      UI.toast("Sender saved.", "good");
    },
    async toggle(id) {
      const response = await fetch(`${API_BASE}/api/senders/${encodeURIComponent(id)}/toggle`, { method: "PATCH" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to toggle sender.");
      await refreshSenders();
      UI.toast("Sender status updated.", "good");
    },
    async remove(id) {
      const response = await fetch(`${API_BASE}/api/senders/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to delete sender.");
      await refreshSenders();
      UI.toast("Sender deleted.", "good");
    }
  };

  const SystemApi = {
    async status() {
      const [backupResponse, auditResponse] = await Promise.all([
        fetch(`${API_BASE}/api/backup/status`, { cache: "no-store" }),
        fetch(`${API_BASE}/api/audit-logs?limit=50`, { cache: "no-store" })
      ]);
      const backup = await backupResponse.json().catch(() => ({}));
      const audit = await auditResponse.json().catch(() => ({}));
      if (!backupResponse.ok || !backup.success) throw new Error(backup.error || "Failed to load backup status.");
      if (!auditResponse.ok || !audit.success) throw new Error(audit.error || "Failed to load audit logs.");
      return { backup, audit };
    },
    async backupNow() {
      const response = await fetch(`${API_BASE}/api/backup/now`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Backup failed.");
      return payload;
    }
  };

  const UserApi = {
    async list() {
      const response = await fetch(`${API_BASE}/api/users`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to load users.");
      state.users = Array.isArray(payload.users) ? payload.users : [];
      return state.users;
    },
    async save() {
      const id = normalizeText(dom.managedUserId?.value);
      const body = {
        username: normalizeText(dom.managedUsername?.value),
        password: String(dom.managedPassword?.value || ""),
        displayName: normalizeText(dom.managedDisplayName?.value),
        email: normalizeText(dom.managedEmail?.value),
        position: normalizeText(dom.managedPosition?.value),
        role: normalizeText(dom.managedRole?.value || "sales"),
        senderEmails: normalizeText(dom.managedSenderEmails?.value),
        isActive: Boolean(dom.managedIsActive?.checked)
      };
      if (!body.username) throw new Error("Username is required.");
      if (!id && !body.password) throw new Error("Password is required for new users.");
      const response = await fetch(`${API_BASE}/api/users${id ? `/${encodeURIComponent(id)}` : ""}`, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to save user.");
      clearUserForm();
      await this.list();
      UI.renderUserList();
      UI.toast("User saved.", "good");
    },
    async remove(id) {
      const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to delete user.");
      await this.list();
      UI.renderUserList();
      UI.toast("User deleted.", "good");
    }
  };

  const AssetApi = {
    async list() {
      const response = await fetch(`${API_BASE}/api/assets`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to load asset library.");
      state.assets = Array.isArray(payload.assets) ? payload.assets : [];
      return state.assets;
    },
    async upload(files, category, sku) {
      const formData = new FormData();
      Array.from(files || []).forEach((file) => formData.append("files", file));
      formData.append("category", category || "shared_files");
      formData.append("sku", sku || "");
      const response = await fetch(`${API_BASE}/api/assets`, { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Asset upload failed.");
      await this.list();
      UI.renderAssetList();
      return payload.assets || [];
    },
    async replace(id, file) {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE}/api/assets/${encodeURIComponent(id)}`, { method: "PUT", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Asset version update failed.");
      await this.list();
      UI.renderAssetList();
      return payload.asset;
    },
    async download(id) {
      const popup = window.open("about:blank", "_blank", "noopener");
      const response = await fetch(`${API_BASE}/api/assets/${encodeURIComponent(id)}/download-url`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        popup?.close();
        throw new Error(payload.error || "Asset download is unavailable.");
      }
      if (popup) popup.location.href = payload.url;
      else window.location.href = payload.url;
      return payload;
    },
    async remove(id) {
      const response = await fetch(`${API_BASE}/api/assets/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Asset delete failed.");
      await this.list();
      UI.renderAssetList();
    }
  };

  const GroupApi = {
    async list() {
      const response = await fetch(`${API_BASE}/api/groups`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to load groups.");
      state.groups = Array.isArray(payload.groups) ? payload.groups : [];
      state.isHostAdmin = Boolean(payload.hostOnly || state.isHostAdmin);
      return state.groups;
    },
    async create(name) {
      const cleanName = normalizeText(name);
      if (!cleanName) throw new Error("Group name is required.");
      const response = await fetch(`${API_BASE}/api/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to create group.");
      await this.list();
      if (payload.group?.id && dom.groupFilter) dom.groupFilter.value = payload.group.id;
      UI.renderGroupControls();
      UI.renderCustomerList();
      UI.toast("Group created.", "good");
      return payload.group;
    },
    async update(id, name, visibleRoles) {
      const cleanName = normalizeText(name);
      if (!id || !cleanName) throw new Error("Group name is required.");
      const response = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName, ...(Array.isArray(visibleRoles) ? { visibleRoles } : {}) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to update group.");
      await this.list();
      UI.renderGroupControls();
      UI.renderCustomerList();
      UI.toast("Group updated.", "good");
      return payload.group;
    },
    async remove(id) {
      const response = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to delete group.");
      await this.list();
      await DB.initSharedStore();
      UI.refreshAll();
      UI.toast(`Group deleted. ${payload.movedToUngrouped || 0} customers moved to ungrouped.`, "good");
    },
    async moveCustomer(customerId, groupId) {
      const response = await fetch(`${API_BASE}/api/customers/${encodeURIComponent(customerId)}/group`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: normalizeGroupId(groupId) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to move customer.");
      await DB.initSharedStore();
      UI.refreshAll();
      UI.toast(`Customer moved to ${groupName(groupId)}.`, "good");
      return payload.customer;
    },
    async batchMove(customerIds, groupId) {
      const ids = Array.isArray(customerIds) ? customerIds.filter(Boolean) : [];
      if (!ids.length) throw new Error("Please select customers first.");
      const response = await fetch(`${API_BASE}/api/customers/batch-group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: ids, group_id: normalizeGroupId(groupId) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to move selected customers.");
      await DB.initSharedStore();
      state.selectedCustomerIds.clear();
      UI.refreshAll();
      UI.toast(`Moved ${payload.updated || 0} customers to ${groupName(groupId)}.`, "good");
    }
  };

  function renderGroupVisibilityControls(group) {
    const roles = [["admin", "Admin"], ["sales", "Sales"], ["sales_manager", "Sales Manager"], ["marketing_manager", "Marketing Manager"], ["product_manager", "Product Manager"], ["finance_manager", "Finance Manager"], ["shipping_manager", "Shipping Manager"]];
    const allowed = Array.isArray(group.visibleRoles) ? group.visibleRoles : roles.map(([role]) => role);
    return `<span class="group-role-permissions" data-group-id="${escapeHtml(group.id)}">${roles.map(([role, label]) => `<label><input type="checkbox" value="${role}" ${role === "admin" ? "checked disabled" : allowed.includes(role) ? "checked" : ""}> ${label}</label>`).join("")}</span><button data-action="save-group-visibility" data-id="${escapeHtml(group.id)}" type="button">Save access</button>`;
  }

  const UI = {
    toast(message, tone = "") {
      dom.toast.textContent = message;
      dom.toast.className = `toast ${tone}`.trim();
    },
    renderEnvironmentBanner() {
      if (!dom.environmentBanner) return;
      const isLocal = isLocalEnvironment();
      const label = isLocal ? "本機工作版 / Local Working Copy" : "正式線上版 / Live Site";
      const detail = isLocal
        ? "僅供開發與測試，客戶與產品主資料以 agent.phottix.cn 為準"
        : "正式資料已部署於線上站點";
      dom.environmentBanner.textContent = `${label} · ${detail}`;
      dom.environmentBanner.className = `environment-banner ${isLocal ? "local" : "live"}`.trim();
      dom.environmentBanner.hidden = false;
      const backupBox = document.querySelector(".backup-box");
      if (backupBox) backupBox.hidden = !isLocal;
      [dom.backupExportBtn, dom.backupImportBtn, dom.pullLiveSnapshotBtn].forEach((item) => {
        if (item) item.hidden = !isLocal;
      });
      if (dom.backupFileInput) dom.backupFileInput.hidden = true;
      if (dom.pullLiveSnapshotBtn) dom.pullLiveSnapshotBtn.hidden = !isLocal;
    },
    showPage(pageId) {
      if (pageId === "systemPage" && !state.isHostAdmin) {
        this.toast("System Logs is admin-only.", "warn");
        pageId = "analysisPage";
      }
      if (pageId === "usersPage" && !canManageUsers()) {
        this.toast("User management is restricted to Admin and Marketing Manager.", "warn");
        pageId = "analysisPage";
      }
      if (pageId === "sendersPage" && !hasPermission("canViewSenders")) {
        this.toast("Sender Management is not available for this role.", "warn");
        pageId = "analysisPage";
      }
      document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === pageId));
      document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.page === pageId));
      const titles = {
        analysisPage: ["客戶分析 / Customer Analysis", "抓取官網、提取業務信號、評分、推薦產品並生成英文開發信。"],
        productsPage: ["產品資料庫 / Product Database", "管理完整目錄、推薦池、Recommended For 與 Priority。"],
        customersPage: ["客戶池 / Customer Pool", "管理 Prospect / Existing、批量分析、跟進狀態和客戶 Excel 匯出。"],
        sendersPage: ["寄件者管理 / Sender Management", "主機端管理 Gmail App Password 寄件者。"]
      };
      dom.pageTitle.textContent = titles[pageId]?.[0] || "Phottix Customer Agent";
      dom.pageSubtitle.textContent = titles[pageId]?.[1] || "";
      if (pageId === "assetsPage") {
        dom.pageTitle.textContent = "云端资料库 / Cloud File Library";
        dom.pageSubtitle.textContent = "集中管理产品图片、视频、PDF、Excel、价格表和共用文件。";
      }
      if (pageId === "systemPage") {
        dom.pageTitle.textContent = "System Backup & Audit Logs";
        dom.pageSubtitle.textContent = "Readable backup status and operation history.";
        this.loadSystemPage().catch((error) => this.toast(error.message, "bad"));
      }
      if (pageId === "usersPage") {
        dom.pageTitle.textContent = "User Management";
        dom.pageSubtitle.textContent = "Role and position access settings.";
        UserApi.list().then(() => this.renderUserList()).catch((error) => this.toast(error.message, "bad"));
      }
    },
    renderAdminNavigation() {
      document.body.classList.remove("role-admin", "role-sales", "role-sales-manager", "role-marketing-manager", "role-product-manager", "role-finance-manager", "role-shipping-manager", "role-user");
      document.body.classList.add(`role-${String(state.userRole || "sales").replace(/_/g, "-")}`);
      const canImportCustomers = hasPermission("canImportCustomers");
      const canExportCustomers = hasPermission("canExportCustomers");
      const canManageSenders = hasPermission("canManageSenders");
      const canEditTemplates = canManageTemplates();
      if (dom.assetUploadForm) dom.assetUploadForm.classList.toggle("hidden", !canManageAssets());
      if (dom.sendersNavBtn) dom.sendersNavBtn.classList.toggle("hidden", !hasPermission("canViewSenders"));
      if (dom.usersNavBtn) dom.usersNavBtn.classList.toggle("hidden", !canManageUsers());
      if (dom.systemNavBtn) dom.systemNavBtn.classList.toggle("hidden", !hasPermission("canViewSystemLogs"));
      [dom.newBlankTemplateBtn, dom.saveTemplateBtn, dom.saveTemplateTopBtn, dom.deleteTemplateBtn, dom.deleteTemplateTopBtn].forEach((button) => {
        if (button) button.classList.toggle("hidden", !canEditTemplates);
      });
      [
        dom.addProductBtn,
        dom.importProductsBtn
      ].forEach((button) => {
        if (button) button.classList.toggle("hidden", !hasPermission("canManageProducts"));
      });
      [
        dom.addCustomerBtn,
        dom.saveCustomerBtn,
        dom.importCustomersBtn,
        dom.uploadCustomerExcelBtn,
        dom.importCustomersConfigBtn,
        dom.importUpdateBtn
      ].forEach((button) => {
        if (!button) return;
        const isSaveButton = button === dom.saveCustomerBtn;
        button.classList.toggle("hidden", isSaveButton ? !canManageCustomers() : !canImportCustomers);
      });
      [dom.bulkAnalyzeSelectedBtn, dom.bulkAnalyzeAllBtn].forEach((button) => {
        if (button) button.classList.toggle("hidden", !canManageCustomers());
      });
      [dom.exportCustomersBtn, dom.exportCurrentGroupBtn, dom.exportFilteredCustomersBtn].forEach((button) => {
        if (button) button.classList.toggle("hidden", !canExportCustomers);
      });
      if (dom.bulkDeleteBtn) dom.bulkDeleteBtn.classList.toggle("hidden", !canBatchManageCustomers());
      if (dom.bulkMoveGroupBtn) dom.bulkMoveGroupBtn.classList.toggle("hidden", !canBatchManageCustomers());
      [dom.bulkConvertBtn, dom.addGroupBtn].forEach((button) => {
        if (button) button.classList.toggle("hidden", !state.isHostAdmin);
      });
      if (dom.senderForm) dom.senderForm.classList.toggle("hidden", !canManageSenders);
    },
    renderUserList() {
      if (!dom.userList) return;
      if (!canManageUsers()) {
        dom.userList.innerHTML = `<div class="empty">User management is restricted to Admin and Marketing Manager.</div>`;
        return;
      }
      dom.userList.innerHTML = state.users.length ? `
        <table>
          <thead><tr><th>Username</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            ${state.users.map((user) => `
              <tr>
                <td>${escapeHtml(user.username)}${user.source === "env" ? ` <small class="muted-text">.env</small>` : ""}</td>
                <td>${escapeHtml(user.displayName || "")}</td>
                <td>${escapeHtml(user.email || "")}</td>
                <td><span class="audit-action">${escapeHtml(user.roleLabel || user.role || "User")}</span></td>
                <td><span class="status-pill ${user.isActive ? "positive" : "negative"}">${user.isActive ? "Active" : "Inactive"}</span></td>
                <td>${escapeHtml(formatDateTime(user.lastLogin) || "Never")}</td>
                <td>${user.source === "env" ? `<span class="muted-text">Managed by .env</span>` : `
                  <button class="mini-button" data-action="edit-user" data-id="${escapeHtml(user.id)}" type="button">Edit</button>
                  <button class="danger-button" data-action="delete-user" data-id="${escapeHtml(user.id)}" type="button">Delete</button>
                `}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty">No SQLite users yet. .env users may still be active.</div>`;
    },
    renderSystemPage(payload = {}) {
      const backup = payload.backup || {};
      const audit = payload.audit || {};
      const backups = Array.isArray(backup.backups) ? backup.backups : [];
      const logs = Array.isArray(audit.logs) ? audit.logs : [];
      const lastBackup = backup.lastBackup || backups[0] || null;

      if (dom.systemLastBackup) dom.systemLastBackup.textContent = lastBackup ? `${lastBackup.file} (${formatFileSize(lastBackup.sizeBytes)})` : "No backup yet";
      if (dom.systemBackupDir) dom.systemBackupDir.textContent = `Backup folder: ${backup.backupDir || "-"}`;
      if (dom.systemRetentionDays) dom.systemRetentionDays.textContent = `${backup.retentionDays || 7} days`;
      if (dom.systemAuditCount) dom.systemAuditCount.textContent = String(logs.length);
      if (dom.systemBackupStatus) dom.systemBackupStatus.textContent = backups.length ? `${backups.length} files` : "No files";

      if (dom.backupFileList) {
        dom.backupFileList.innerHTML = backups.length ? backups.map((item) => `
          <div class="system-list-item">
            <strong>${escapeHtml(item.file)}</strong>
            <span>${escapeHtml(formatDateTime(item.modifiedAt || item.createdAt))} · ${escapeHtml(formatFileSize(item.sizeBytes))}</span>
          </div>
        `).join("") : `<div class="empty-state">No SQLite backup files yet.</div>`;
      }

      if (dom.auditLogTableBody) {
        dom.auditLogTableBody.innerHTML = logs.length ? logs.map((log) => `
          <tr>
            <td>${escapeHtml(formatDateTime(log.created_at))}</td>
            <td>${escapeHtml(log.username || "anonymous")}</td>
            <td><span class="audit-action">${escapeHtml(log.action || "")}</span></td>
            <td>
              <strong>${escapeHtml(log.target_name || log.target_id || "-")}</strong>
              <small>${escapeHtml(log.target_type || "")}</small>
            </td>
            <td>${escapeHtml(compactDetails(log.details || {}))}</td>
          </tr>
        `).join("") : `<tr><td colspan="5">No audit logs yet.</td></tr>`;
      }
    },
    renderAssetList() {
      if (!dom.assetList) return;
      const category = normalizeText(dom.assetCategoryFilter?.value).toLowerCase();
      const sku = normalizeText(dom.assetSkuFilter?.value).toLowerCase();
      const search = normalizeText(dom.assetSearch?.value).toLowerCase();
      const categoryLabels = {
        price_lists: "Price List",
        product_images: "Product Image",
        product_videos: "Product Video",
        product_documents: "Product Document",
        email_templates: "Email Template",
        shared_files: "Shared File"
      };
      const assets = state.assets.filter((asset) => {
        const haystack = `${asset.originalName || ""} ${asset.sku || ""} ${asset.uploadedByName || ""}`.toLowerCase();
        return (!category || asset.category === category)
          && (!sku || String(asset.sku || "").toLowerCase().includes(sku))
          && (!search || haystack.includes(search));
      });
      if (!assets.length) {
        dom.assetList.innerHTML = `<div class="empty-state">No matching files. Upload a shared file to start the local test.</div>`;
        return;
      }
      dom.assetList.innerHTML = `
        <div class="asset-list-summary">${assets.length} current file(s). Older versions remain available to historical emails.</div>
        <div class="asset-table-wrap">
          <table class="asset-table">
            <thead><tr><th>File</th><th>Category / SKU</th><th>Version</th><th>Size</th><th>Uploaded by / Updated</th><th>Actions</th></tr></thead>
            <tbody>
              ${assets.map((asset) => `
                <tr>
                  <td><strong>${escapeHtml(asset.originalName || "-")}</strong><br><small class="muted-text">${escapeHtml(attachmentTypeLabel(asset.fileType))}</small></td>
                  <td>${escapeHtml(categoryLabels[asset.category] || asset.category || "Shared File")}<br><small class="muted-text">SKU: ${escapeHtml(asset.sku || "-")}</small></td>
                  <td><span class="status-pill positive">v${escapeHtml(asset.version || 1)}${asset.isCurrent ? " / current" : ""}</span></td>
                  <td>${escapeHtml(formatFileSize(asset.fileSize) || "-")}</td>
                  <td>${escapeHtml(asset.uploadedByName || asset.uploadedBy || "-")}<br><small class="muted-text">${escapeHtml(formatDateTime(asset.updatedAt || asset.uploadedAt) || "-")}</small></td>
                  <td>
                    <div class="asset-actions">
                      <button class="mini-button" data-action="download-asset" data-id="${escapeHtml(asset.id)}" type="button">Download</button>
                      <button class="mini-button" data-action="add-asset-attachment" data-id="${escapeHtml(asset.id)}" type="button">Attach to email</button>
                      ${canManageAssets() ? `<button class="mini-button" data-action="replace-asset" data-id="${escapeHtml(asset.id)}" type="button">New version</button><button class="danger-button" data-action="delete-asset" data-id="${escapeHtml(asset.id)}" type="button">Delete</button>` : ""}
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },
    async loadSystemPage() {
      if (dom.systemBackupStatus) dom.systemBackupStatus.textContent = "Loading...";
      const payload = await SystemApi.status();
      this.renderSystemPage(payload);
      return payload;
    },
    async runManualSqliteBackup() {
      if (dom.manualSqliteBackupBtn) {
        dom.manualSqliteBackupBtn.disabled = true;
        dom.manualSqliteBackupBtn.textContent = "Backing up...";
      }
      try {
        await SystemApi.backupNow();
        await this.loadSystemPage();
        this.toast("SQLite backup created.", "good");
      } finally {
        if (dom.manualSqliteBackupBtn) {
          dom.manualSqliteBackupBtn.disabled = false;
          dom.manualSqliteBackupBtn.textContent = "Backup Now";
        }
      }
    },
    refreshAll() {
      this.renderEnvironmentBanner();
      this.renderAdminNavigation();
      this.renderTodayFollowUps();
      this.renderStats();
      this.renderErrorLogs();
      this.renderCustomerImportResult();
      this.renderGroupControls();
      this.renderLoadCustomerSelect();
      this.renderSenderSelector();
      this.renderSenderList();
      this.renderUserList();
      this.renderAssetList();
      this.renderProductList();
      this.renderCustomerList();
      this.renderTemplateEditor();
    },
    renderSenderSelector() {
      if (!dom.senderSelect) return;
      const previous = dom.senderSelect.value;
      const activeSenders = state.senders.filter((sender) => sender.isActive && sender.canUse !== false);
      dom.senderSelect.innerHTML = `<option value="">請選擇寄件者</option>${activeSenders.map((sender) => (
        `<option value="${escapeHtml(sender.id)}">${escapeHtml(sender.name)} &lt;${escapeHtml(sender.email)}&gt;</option>`
      )).join("")}`;
      if (activeSenders.some((sender) => sender.id === previous)) {
        dom.senderSelect.value = previous;
      } else if (activeSenders.length === 1) {
        dom.senderSelect.value = activeSenders[0].id;
      }
      if (dom.senderStatus) {
        dom.senderStatus.textContent = activeSenders.length
          ? `可用寄件者：${activeSenders.length}`
          : "沒有啟用的寄件者";
      }
      this.updateSenderAvatar();
    },
    updateSenderAvatar() {
      if (!dom.senderAvatar) return;
      const sender = state.senders.find((item) => item.id === dom.senderSelect?.value);
      const source = normalizeText(sender?.name || sender?.email || "");
      const initial = source.match(/[A-Za-z0-9]/)?.[0]?.toUpperCase() || "S";
      dom.senderAvatar.textContent = initial;
      dom.senderAvatar.title = sender ? `${sender.name || sender.email} sender` : "Sender";
    },
    renderSenderList() {
      if (!dom.senderList) return;
      if (!state.isHostAdmin) {
        dom.senderList.innerHTML = `<div class="empty">寄件者管理僅限主機端使用。請在 http://127.0.0.1:8787/ 開啟。</div>`;
        if (dom.sendersNavBtn) dom.sendersNavBtn.classList.add("hidden");
        return;
      }
      if (dom.sendersNavBtn) dom.sendersNavBtn.classList.remove("hidden");
      dom.senderList.innerHTML = state.senders.length ? `
        <table>
          <thead><tr><th>名稱</th><th>Email</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>
            ${state.senders.map((sender) => `
              <tr>
                <td>${escapeHtml(sender.name)}</td>
                <td>${escapeHtml(sender.email)}</td>
                <td><span class="status-pill ${sender.isActive ? "positive" : "negative"}">${sender.isActive ? "啟用" : "停用"}</span></td>
                <td>
                  <button class="mini-button" data-action="edit-sender" data-id="${escapeHtml(sender.id)}" type="button">編輯</button>
                  <button class="mini-button" data-action="toggle-sender" data-id="${escapeHtml(sender.id)}" type="button">${sender.isActive ? "停用" : "啟用"}</button>
                  <button class="danger-button" data-action="delete-sender" data-id="${escapeHtml(sender.id)}" type="button">刪除</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty">尚未設定寄件者。</div>`;
    },
    renderTodayFollowUps() {
      const active = DB.getCustomers().filter((item) => ["open", "pending"].includes(item.followUpStatus));
      const dueToday = active.filter((item) => item.nextFollowUpDate === TODAY);
      const overdue = active.filter((item) => item.nextFollowUpDate && item.nextFollowUpDate < TODAY);
      const customers = [...overdue, ...dueToday];
      dom.todayFollowCount.textContent = customers.length;
      if (dom.overdueFollowCount) dom.overdueFollowCount.textContent = `逾期 / Overdue ${overdue.length}`;
      if (dom.dueTodayFollowCount) dom.dueTodayFollowCount.textContent = `今日 / Today ${dueToday.length}`;
      dom.todayFollowList.innerHTML = customers.length
        ? customers.slice(0, 8).map((item) => {
          const label = item.nextFollowUpDate < TODAY ? `逾期 ${Math.max(1, Math.floor((new Date(TODAY) - new Date(item.nextFollowUpDate)) / 86400000))} 天` : "今日到期";
          const dueClass = item.nextFollowUpDate < TODAY ? "overdue" : "due-today";
          return `<button class="today-item ${dueClass}" data-action="load-customer" data-id="${escapeHtml(item.id)}" type="button"><strong>${escapeHtml(item.companyName)}</strong><br>${escapeHtml(label)}</button>`;
        }).join("")
        : `<div class="empty">暫無待跟進 / Import Excel or save customers to build follow-up data.</div>`;
    },
    renderStats() {
      if (!dom.statsSummary) return;
      const customers = DB.getCustomers();
      const logs = Object.values(DB.getLogs());
      const monthKey = new Date().toISOString().slice(0, 7);
      const ratingCounts = ["A", "B", "C", "D", "NR"].map((rating) => ({
        rating,
        count: customers.filter((item) => (item.rating || "NR") === rating).length
      }));
      const activeLogs = logs.filter((log) => ["positive", "neutral", "negative", "no_response"].includes(log.response));
      const positive = activeLogs.filter((log) => log.response === "positive").length;
      const responseRate = activeLogs.length ? Math.round((positive / activeLogs.length) * 100) : 0;
      const cards = [
        ["◌", `${customers.filter((item) => item.customerType === "prospect").length}/${customers.filter((item) => item.customerType === "existing").length}`, "客戶類型 / Type"],
        ["★", ratingCounts, "評級分布 / Rating"],
        ["◷", customers.filter((item) => item.nextFollowUpDate === TODAY && ["open", "pending"].includes(item.followUpStatus)).length, "今日待跟進 / Due Today"],
        ["!", customers.filter((item) => item.nextFollowUpDate && item.nextFollowUpDate < TODAY && ["open", "pending"].includes(item.followUpStatus)).length, "逾期跟進 / Overdue"],
        ["+", customers.filter((item) => String(item.createdAt || "").slice(0, 7) === monthKey).length, "本月新增 / New This Month"],
        ["%", `${responseRate}%`, "正面回應率 / Response"]
      ];
      dom.statsSummary.innerHTML = cards.map(([icon, value, label]) => {
        const content = Array.isArray(value)
          ? `<div class="rating-chip-row">${value.map((item) => `<span class="rating-chip ${item.rating.toLowerCase()}">${escapeHtml(item.rating)} ${escapeHtml(String(item.count))}</span>`).join("")}</div>`
          : `<strong>${escapeHtml(String(value))}</strong>`;
        return `<div class="stat-card"><span class="widget-icon" aria-hidden="true">${escapeHtml(icon)}</span>${content}<span>${escapeHtml(label)}</span></div>`;
      }).join("");
    },
    renderErrorLogs() {
      if (!dom.errorLogList) return;
      const logs = DB.getErrorLogs().slice(0, 5);
      dom.errorLogList.innerHTML = logs.length
        ? logs.map((log) => `<div class="today-item"><strong>${escapeHtml(log.operation)}</strong><br>${escapeHtml(log.message)}<br><small>${escapeHtml(formatDateTime(log.timestamp))}</small></div>`).join("")
        : `<div class="empty">沒有錯誤日誌。</div>`;
    },
    renderCustomerImportResult() {
      if (!dom.customerImportResult) return;
      const review = DB.getCustomerImportReviews();
      const counts = review.counts || {};
      if (!review.importedAt || !Number(counts.total)) {
        dom.customerImportResult.textContent = "";
        return;
      }
      dom.customerImportResult.className = "attachment-upload-status good";
      dom.customerImportResult.innerHTML = `
        ${counts.oldCustomerRetained ? `Old customers retained: ${Number(counts.oldCustomerRetained)}` : ""}
        导入完成 / Import complete：总记录 ${Number(counts.total) || 0}，有效 ${Number(counts.valid) || 0}，待分类 ${Number(counts.pending) || 0}，无效 ${Number(counts.invalid) || 0}；新增客户池 ${Number(counts.added) || 0}。
        ${counts.pending ? `<button type="button" class="mini-button" data-action="download-customer-review" data-status="pending">下载待分类</button>` : ""}
        ${counts.invalid ? `<button type="button" class="mini-button" data-action="download-customer-review" data-status="invalid">下载无效存档</button>` : ""}
      `;
    },
    renderLoadCustomerSelect() {
      const customers = DB.getCustomers();
      dom.loadCustomerSelect.innerHTML = `<option value="">從客戶池載入 / Load from Customer Pool</option>${customers.map((item) => {
        const label = item.companyName || item.website || item.contactEmail;
        return `<option value="${escapeHtml(item.id)}">${escapeHtml(label)} · ${escapeHtml(groupName(item.groupId || item.group_id))}</option>`;
      }).join("")}`;
    },
    renderProductList() {
      const rawQuery = normalizeText(dom.productSearch.value);
      const query = rawQuery.toLowerCase();
      const targetQuery = parseTargetPriorityQuery(rawQuery);
      const view = dom.productView.value;
      let products = DB.getProducts();
      if (view === "pool") products = products.filter((item) => item.inRecommendationPool);
      if (targetQuery) {
        products = products.filter((item) => productTargetPriorities(item)[targetQuery.target] === targetQuery.priority);
      } else if (query) {
        products = products.filter((item) => `${item.name} ${item.sku || ""} ${item.category} ${targetPrioritySummary(item)} ${item.description || ""}`.toLowerCase().includes(query));
      }
      dom.productTable.innerHTML = products.length ? `
        <table class="product-table">
          <thead><tr><th>Product Name / SKU</th><th>Category</th><th>Target Priority</th><th>Description</th></tr></thead>
          <tbody>
            ${products.map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.name)}</strong><br><small>${escapeHtml(item.sku || "-")}</small></td>
                <td>${escapeHtml(item.category)}</td>
                <td>
                  <span class="target-priority-summary">${escapeHtml(targetPrioritySummary(item) || "-")}</span>
                </td>
                <td>
                  <div class="product-description-cell">${escapeHtml(item.description || "-")}</div>
                  <div class="product-row-actions">
                    <label class="product-pool-toggle"><input type="checkbox" data-action="toggle-product-pool" data-id="${escapeHtml(item.id)}" ${item.inRecommendationPool ? "checked" : ""}> 推薦池</label>
                    <button class="mini-button" data-action="edit-product" data-id="${escapeHtml(item.id)}">編輯</button>
                    <button class="danger-button" data-action="delete-product" data-id="${escapeHtml(item.id)}">刪除</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty">沒有產品。</div>`;
    },
    renderCustomerList() {
      const visibleCustomers = filterCustomers(DB.getCustomers());
      const selectedCount = state.selectedCustomerIds.size;
      const rowCountLabel = visibleCustomers.length === 1 ? "1 customer" : `${visibleCustomers.length} customers`;
      const selectedLabel = selectedCount ? ` / ${selectedCount} selected` : "";
      dom.customerList.innerHTML = visibleCustomers.length ? `
        <div class="customer-list-summary">
          <strong>Customer list</strong>
          <span>Showing ${rowCountLabel}${selectedLabel}. Use Search and filters above to narrow the list.</span>
        </div>
        <div class="customer-list-table" role="table" aria-label="Customer list">
          <div class="customer-list-head" role="row">
            <span>Select</span>
            <span>Company / Website</span>
            <span>Contact / Email</span>
            <span>Status</span>
            <span>Next</span>
            <span>Actions</span>
          </div>
          ${visibleCustomers.map((customer) => {
            const staleDays = daysSince(customer.lastAnalyzedAt);
            const manualIcon = customer.isManuallyReviewed ? " *" : "";
            const contacts = normalizeEmailContacts(customer.emailContacts);
            const primaryEmail = customer.contactEmail || contacts[0]?.email || "";
            const extraEmails = contacts
              .map((contact) => contact.email)
              .filter((email) => email && email !== primaryEmail)
              .slice(0, 2);
            const contactLine = [customer.contactName || "No contact", primaryEmail || "No email"].filter(Boolean).join(" / ");
            const locationLine = [customer.country, customer.city, customer.industry].filter(Boolean).join(" / ") || "No location";
            const websiteHtml = customer.website
              ? `<a href="${escapeHtml(customer.website)}" target="_blank" rel="noreferrer">${escapeHtml(customer.website)}</a>`
              : `<span class="muted-text">No website</span>`;
            const lastAnalyzed = customer.lastAnalyzedAt ? formatDateTime(customer.lastAnalyzedAt) : "Never";
            return `
              <article class="customer-card customer-list-row" role="row">
                <div class="customer-select-cell">
                  <input type="checkbox" data-action="select-customer" data-id="${escapeHtml(customer.id)}" ${state.selectedCustomerIds.has(customer.id) ? "checked" : ""} aria-label="Select ${escapeHtml(customer.companyName || "customer")}">
                </div>
                <div class="customer-main-cell">
                  <h4>${escapeHtml(customer.companyName || "Untitled")}${manualIcon}</h4>
                  ${websiteHtml}
                </div>
                <div class="customer-contact-cell">
                  <strong>${escapeHtml(contactLine)}</strong>
                  <span>${escapeHtml(extraEmails.length ? extraEmails.join(", ") : locationLine)}</span>
                </div>
                <div class="customer-status-cell">
                  <span class="status-pill rating-pill ${escapeHtml(ratingClass(customer.rating))}">${escapeHtml(customer.rating || "NR")} / ${escapeHtml(String(customer.scores?.priority || 0))}</span>
                  <span class="status-pill">${escapeHtml(customer.customerType || "prospect")}</span>
                  <span class="status-pill">${escapeHtml(customer.followUpStatus || "open")}</span>
                  <span class="status-pill">Group: ${escapeHtml(groupName(customer.groupId || customer.group_id))}</span>
                </div>
                <div class="customer-next-cell">
                  <strong>${escapeHtml(customer.nextFollowUpDate || "-")}</strong>
                  <span>Last: ${escapeHtml(lastAnalyzed)}${staleDays !== null && staleDays > 30 ? " / 30d+" : ""}</span>
                </div>
                <footer class="customer-actions-cell">
                  <button class="mini-button" data-action="load-customer" data-id="${escapeHtml(customer.id)}">Load</button>
                  <button class="mini-button" data-action="edit-customer" data-id="${escapeHtml(customer.id)}">Edit</button>
                  <button class="mini-button" data-action="manage-email-contacts" data-id="${escapeHtml(customer.id)}">Contacts</button>
                  <button class="mini-button" data-action="add-log" data-id="${escapeHtml(customer.id)}">Log</button>
                  <button class="danger-button" data-action="delete-customer" data-id="${escapeHtml(customer.id)}">Delete</button>
                </footer>
                <details class="customer-row-details">
                  <summary>More / Edit fields</summary>
                  <div class="customer-detail-grid">
                    <p><strong>Suggested Action:</strong> ${escapeHtml(suggestAction(customer))}</p>
                    <p><strong>Buyer Classification:</strong> ${escapeHtml(buyingRoleDisplay(customer.buyingRole))}${customer.isBuyingRoleManuallyReviewed ? " / Manual" : ""}</p>
                    <p><strong>Customer Score:</strong> ${escapeHtml(customer.customerScore ?? "-")}</p>
                  </div>
                  <div class="customer-role-edit">
                    <label>Buying Role
                      <select data-action="change-buying-role" data-id="${escapeHtml(customer.id)}">
                        ${buyingRoleOptionsHtml(customer.buyingRole)}
                      </select>
                    </label>
                    <label>Customer Score
                      <input data-action="change-customer-score" data-id="${escapeHtml(customer.id)}" type="number" min="1" max="100" step="1" value="${escapeHtml(customer.customerScore ?? "")}" placeholder="1-100">
                    </label>
                    <label>Group
                      <select data-action="change-customer-group" data-id="${escapeHtml(customer.id)}">
                        ${groupOptionsHtml(customer.groupId || customer.group_id)}
                      </select>
                    </label>
                  </div>
                </details>
              </article>
            `;
          }).join("")}
        </div>
      ` : `<div class="empty">No customers found. Try clearing Search or filters.</div>`;
      return;
      const customers = filterCustomers(DB.getCustomers());
      dom.customerList.innerHTML = customers.length ? customers.map((customer) => {
        const stale = daysSince(customer.lastAnalyzedAt);
        const manualIcon = customer.isManuallyReviewed ? " ✏️" : "";
        return `
          <article class="customer-card">
            <header>
              <div>
                <h4><input type="checkbox" data-action="select-customer" data-id="${escapeHtml(customer.id)}" ${state.selectedCustomerIds.has(customer.id) ? "checked" : ""}> ${escapeHtml(customer.companyName || "Untitled")}${manualIcon}</h4>
                <p>${customer.website ? `<a href="${escapeHtml(customer.website)}" target="_blank" rel="noreferrer">${escapeHtml(customer.website)}</a>` : "No website"}</p>
              </div>
              <span class="status-pill rating-pill ${escapeHtml(ratingClass(customer.rating))}">${escapeHtml(customer.rating || "NR")} / ${escapeHtml(String(customer.scores?.priority || 0))}</span>
            </header>
            <div class="customer-meta">
              <span class="status-pill">${escapeHtml(customer.customerType || "prospect")}</span>
              <span class="status-pill">Group: ${escapeHtml(groupName(customer.groupId || customer.group_id))}</span>
              <span class="status-pill">Buyer: ${escapeHtml(buyingRoleDisplay(customer.buyingRole))}${customer.isBuyingRoleManuallyReviewed ? " / Manual" : ""}</span>
              <span class="status-pill">Customer Score: ${escapeHtml(customer.customerScore ?? "—")}</span>
              <span class="status-pill">${escapeHtml(customer.followUpStatus || "open")}</span>
              <span class="status-pill">Next: ${escapeHtml(customer.nextFollowUpDate || "—")}</span>
            </div>
            <div class="customer-role-edit">
              <label>購買角色
                <select data-action="change-buying-role" data-id="${escapeHtml(customer.id)}">
                  ${buyingRoleOptionsHtml(customer.buyingRole)}
                </select>
              </label>
              <label>Customer Score
                <input data-action="change-customer-score" data-id="${escapeHtml(customer.id)}" type="number" min="1" max="100" step="1" value="${escapeHtml(customer.customerScore ?? "")}" placeholder="1-100">
              </label>
              <label>Group
                <select data-action="change-customer-group" data-id="${escapeHtml(customer.id)}">
                  ${groupOptionsHtml(customer.groupId || customer.group_id)}
                </select>
              </label>
            </div>
            <p>${escapeHtml([customer.contactName, customer.contactEmail, customer.country, customer.city, customer.industry].filter(Boolean).join(" · ") || "No contact info")}</p>
            <p><strong>Suggested Action:</strong> ${escapeHtml(suggestAction(customer))}</p>
            <p><strong>Last Analyzed:</strong> ${escapeHtml(customer.lastAnalyzedAt ? formatDateTime(customer.lastAnalyzedAt) : "Never")}${stale !== null && stale > 30 ? " · over 30 days" : ""}</p>
            <footer>
              <button class="mini-button" data-action="load-customer" data-id="${escapeHtml(customer.id)}">載入分析</button>
              <button class="mini-button" data-action="edit-customer" data-id="${escapeHtml(customer.id)}">編輯</button>
              <button class="mini-button" data-action="manage-email-contacts" data-id="${escapeHtml(customer.id)}">Contacts</button>
              <button class="mini-button" data-action="add-log" data-id="${escapeHtml(customer.id)}">新增跟進</button>
              <button class="danger-button" data-action="delete-customer" data-id="${escapeHtml(customer.id)}">刪除</button>
            </footer>
          </article>
        `;
      }).join("") : `<div class="empty">沒有客戶。</div>`;
    },
    renderAnalysisResult(customer, analysis) {
      dom.analysisPlaceholder?.classList.add("hidden");
      dom.analysisResult.classList.remove("hidden");
      const staleDays = daysSince(customer.lastAnalyzedAt);
      if (staleDays !== null && staleDays > 30) {
        dom.staleBanner.classList.remove("hidden");
        dom.staleBanner.textContent = `距離上次分析已 ${staleDays} 天，官網可能已更新，建議重新抓取。`;
      } else {
        dom.staleBanner.classList.add("hidden");
      }
      dom.companyInfoTable.innerHTML = renderInfoTable(customer);
      dom.ratingHero.innerHTML = `<div class="rating-big ${escapeHtml(ratingClass(analysis.rating))}"><strong>${escapeHtml(analysis.rating)}</strong><span>${escapeHtml(String(analysis.totalScore))} points</span></div>`;
      dom.fourScores.innerHTML = renderScoreBars(analysis.scores);
      dom.signalTags.innerHTML = analysis.businessSignals.length ? analysis.businessSignals.map((item) => `<span>${escapeHtml(item)}</span>`).join("") : `<span>未識別明確信號</span>`;
      dom.scoringBreakdown.innerHTML = renderScoringTable(analysis.details);
      dom.recommendedProducts.innerHTML = analysis.recommendedProducts.length ? analysis.recommendedProducts.map((product) => `
        <div class="recommend-card">
          <strong>${escapeHtml(product.name)}</strong>
          <p>${escapeHtml(product.category)}</p>
          ${product.targetPriorityCode ? `<p><strong>Matched target:</strong> ${escapeHtml(product.targetPriorityCode)}</p>` : ""}
          ${product.description ? `<p>${escapeHtml(product.description)}</p>` : ""}
          ${product.productUrl ? `<p><a href="${escapeHtml(product.productUrl)}" target="_blank" rel="noopener">Product link</a></p>` : ""}
          <p>${escapeHtml(product.reason)}</p>
        </div>
      `).join("") : `<div class="empty">推薦池沒有可用產品，請先在產品資料庫選入 Recommendation Pool。</div>`;
      dom.actionSuggestions.innerHTML = buildSuggestions(analysis).map((item) => `<div class="recommend-card">${escapeHtml(item)}</div>`).join("");
      if (dom.emailStrategyNote) {
        if (analysis.emailStrategy?.message) {
          dom.emailStrategyNote.classList.remove("hidden");
          dom.emailStrategyNote.textContent = `Internal suggested angle: ${analysis.emailStrategy.message}.`;
        } else {
          dom.emailStrategyNote.classList.add("hidden");
          dom.emailStrategyNote.textContent = "";
        }
      }
      state.emailAttachments = normalizeAttachments(customer.emailDraft?.emailAttachments || analysis.emailDraft.emailAttachments || state.emailAttachments);
      this.renderAttachmentList();
      this.renderTimeline(customer.id);
      this.renderAnalysisHistory(customer.id);
      this.toast(`${analysis.rating} / ${analysis.totalScore} analysis ready.`, "good");
    },
    renderTimeline(customerId) {
      const logs = Object.values(DB.getLogs())
        .filter((log) => log.customerId === customerId)
        .sort((a, b) => String(b.logDate).localeCompare(String(a.logDate)));
      dom.timeline.innerHTML = logs.length ? logs.map((log) => {
        const channelIcon = { Email: "📧", "電話": "📞", "社媒": "📱", "展會": "🤝", "其他": "📝" }[log.channel] || "📝";
        const responseIcon = { positive: "🟢", neutral: "🟡", negative: "🔴", no_response: "⚪" }[log.response] || "⚪";
        return `
          <div class="timeline-item">
            <header><strong>${channelIcon} ${escapeHtml(log.logDate)} · ${escapeHtml(log.subject || "No subject")}</strong><span>${responseIcon} ${escapeHtml(log.response || "")}</span></header>
            <p>${escapeHtml(log.summary || "")}</p>
            <p>${escapeHtml([log.contactPerson, log.nextAction, log.nextFollowUpDate].filter(Boolean).join(" · "))}</p>
            ${log.isDraft ? `<button class="mini-button" data-action="open-email-draft" data-id="${escapeHtml(log.logId)}" type="button">檢視並編輯草稿</button>` : ""}
            ${log.channel === "Email" && !log.isDraft ? `<button class="mini-button" data-action="copy-log-email" data-id="${escapeHtml(log.logId)}" type="button">從歷史郵件複製</button>` : ""}
          </div>
        `;
      }).join("") : `<div class="empty">沒有跟進記錄。</div>`;
    },
    renderAnalysisHistory(customerId) {
      if (!dom.analysisHistory) return;
      const history = DB.getAnalysisHistory()[customerId] || [];
      dom.analysisHistory.innerHTML = history.length
        ? history.slice(0, 8).map((item, index) => {
          const previous = history[index + 1];
          const change = previous && previous.rating !== item.rating ? ` · ${previous.rating} → ${item.rating}` : "";
          const products = (item.recommendedProducts || []).map((product) => product.name || product).slice(0, 3).join(", ");
          return `<div class="timeline-item"><header><strong>${escapeHtml(formatDateTime(item.analyzedAt))}${escapeHtml(change)}</strong><span>${escapeHtml(item.rating || "NR")}</span></header><p>${escapeHtml(products || "No products")}</p></div>`;
        }).join("")
        : `<div class="empty">沒有分析歷史。</div>`;
    },
    renderTemplateEditor(options = {}) {
      const previousValue = options.selectedValue || dom.templatePurpose.value || `default:${purposeKey("First Touch")}`;
      const defaultOptions = EMAIL_PURPOSES.map((purpose) => {
        const key = purposeKey(purpose);
        return `<option value="default:${escapeHtml(key)}">${escapeHtml(purpose)}</option>`;
      }).join("");
      const customOptions = state.customTemplates.length
        ? `<option disabled>──────── 自訂範本 / Custom Templates ────────</option>${state.customTemplates.map((template) => (
          `<option value="custom:${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`
        )).join("")}`
        : `<option disabled>──────── 自訂範本 / Custom Templates ────────</option><option disabled>No custom templates yet</option>`;
      dom.templatePurpose.innerHTML = `<option disabled>預設範本 / Default Templates</option>${defaultOptions}${customOptions}`;

      const selectedOption = Array.from(dom.templatePurpose.options)
        .find((option) => !option.disabled && option.value === previousValue)
        || Array.from(dom.templatePurpose.options).find((option) => !option.disabled);
      if (selectedOption) dom.templatePurpose.value = selectedOption.value;

      const [kind, id] = String(dom.templatePurpose.value || "").split(":");
      state.selectedTemplateKind = kind === "custom" ? "custom" : "default";
      state.selectedCustomTemplateId = state.selectedTemplateKind === "custom" ? id : "";
      syncEmailPurposeFromTemplate();
      const template = state.selectedTemplateKind === "custom"
        ? state.customTemplates.find((item) => item.id === id)
        : DB.getTemplates()[id] || DEFAULT_TEMPLATES[id] || DEFAULT_TEMPLATES.first_touch;

      if (!options.preserveContent) {
        dom.templateSubject.value = template?.subject || "";
        dom.templateBody.value = template?.body || "";
        state.emailAttachments = normalizeAttachments(template?.emailAttachments || []);
      }
      [dom.deleteTemplateBtn, dom.deleteTemplateTopBtn].forEach((button) => {
        button?.classList.toggle("hidden", state.selectedTemplateKind !== "custom");
      });
      this.renderAttachmentList();
      setEmailEditorMode("edit");
    },
    renderGroupControls() {
      const groupHeading = document.querySelector("#customersPage .group-management > div:first-child");
      if (dom.addGroupBtn && groupHeading && dom.addGroupBtn.parentElement !== groupHeading) {
        groupHeading.appendChild(dom.addGroupBtn);
      }
      const filterValue = dom.groupFilter?.value || "";
      const importValue = dom.customerImportGroupSelect?.value || "";
      const bulkValue = dom.bulkGroupSelect?.value || "";
      const groupOptions = state.groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join("");
      if (dom.groupFilter) {
        dom.groupFilter.innerHTML = `<option value="">全部組別</option><option value="__ungrouped__">未分組 / Ungrouped</option>${groupOptions}`;
        dom.groupFilter.value = Array.from(dom.groupFilter.options).some((option) => option.value === filterValue) ? filterValue : "";
      }
      if (dom.customerImportGroupSelect) {
        dom.customerImportGroupSelect.innerHTML = `<option value="">未分組 / Ungrouped</option>${groupOptions}`;
        dom.customerImportGroupSelect.value = Array.from(dom.customerImportGroupSelect.options).some((option) => option.value === importValue) ? importValue : "";
      }
      if (dom.bulkGroupSelect) {
        dom.bulkGroupSelect.innerHTML = `<option value="">移動到：未分組</option>${state.groups.map((group) => `<option value="${escapeHtml(group.id)}">移動到：${escapeHtml(group.name)}</option>`).join("")}`;
        dom.bulkGroupSelect.value = Array.from(dom.bulkGroupSelect.options).some((option) => option.value === bulkValue) ? bulkValue : "";
      }
      if (dom.dialogGroup) {
        const current = dom.dialogGroup.value;
        dom.dialogGroup.innerHTML = groupOptionsHtml(current);
      }
      if (dom.groupList) {
        if (!state.groups.length) {
          dom.groupList.innerHTML = `<span class="empty-inline">尚未建立組別</span>`;
        } else {
          dom.groupList.innerHTML = state.groups.map((group) => `
            <span class="group-chip">
              <strong>${escapeHtml(group.name)}</strong>
              ${state.isHostAdmin ? `
                ${renderGroupVisibilityControls(group)}
                <button data-action="edit-group" data-id="${escapeHtml(group.id)}" type="button">Edit</button>
                <button data-action="delete-group" data-id="${escapeHtml(group.id)}" type="button">Delete</button>
              ` : ""}
            </span>
          `).join("");
        }
      }
      if (dom.addGroupBtn) dom.addGroupBtn.classList.toggle("hidden", !state.isHostAdmin);
    },
    renderAttachmentList() {
      if (!dom.attachmentList) return;
      const attachments = normalizeAttachments(state.emailAttachments);
      state.emailAttachments = attachments;
      dom.attachmentList.innerHTML = attachments.length
        ? attachments.map((item) => `
          <div class="attachment-item">
            <span>
              <strong>${escapeHtml(item.isUploadedFile ? "File" : attachmentTypeLabel(item.type))}</strong>
              ${escapeHtml(item.originalName || item.name)}
              ${item.size ? `<small>${escapeHtml(formatFileSize(item.size))}</small>` : ""}
            </span>
            ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open</a>` : ""}
            ${item.isUploadedFile ? `<span class="attachment-badge">Ready</span>` : ""}
            <button class="mini-button" data-action="remove-attachment" data-id="${escapeHtml(item.id)}" type="button">移除</button>
          </div>
        `).join("")
        : `<div class="empty attachment-empty">No uploaded files or links yet. Click "Upload attachment" to add files for this email.</div>`;
    }
  };

  function renderInfoTable(customer) {
    const rows = [
      ["公司名", customer.companyName],
      ["官網", customer.website],
      ["聯絡人", customer.contactName],
      ["郵箱", customer.contactEmail],
      ["國家", customer.country],
      ["城市", customer.city],
      ["行業", customer.industry],
      ["Buyer Classification / 買家分類", `${buyingRoleDisplay(customer.buyingRole)}${customer.isBuyingRoleManuallyReviewed ? " (Manual)" : ""}`],
      ["Customer Score", customer.customerScore ?? ""],
      ["客戶類型", customer.customerType],
      ["Main Products / Website Main Products", customer.mainProducts],
      ["Instagram", customer.socialMedia?.instagram],
      ["Facebook", customer.socialMedia?.facebook],
      ["上次分析", customer.lastAnalyzedAt ? formatDateTime(customer.lastAnalyzedAt) : ""]
    ];
    return `<table><tbody>${rows.map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value || "—")}</td></tr>`).join("")}</tbody></table>`;
  }

  function renderScoreBars(scores) {
    const labels = {
      priority: "客戶優先級",
      productFit: "產品匹配度",
      confidence: "資料可信度",
      readiness: "開發準備度"
    };
    return Object.entries(labels).map(([key, label]) => {
      const value = Number(scores[key] || 0);
      return `<div class="score-row"><header><span>${escapeHtml(label)}</span><strong>${value}</strong></header><div class="bar"><span style="width:${Math.min(100, value)}%"></span></div></div>`;
    }).join("");
  }

  function renderScoringTable(details) {
    return `<table><thead><tr><th>規則名稱</th><th>命中條件</th><th>分數</th><th>命中狀態</th></tr></thead><tbody>${details.map((item) => `
      <tr>
        <td>${escapeHtml(item.ruleName)}</td>
        <td>${escapeHtml(item.condition)}</td>
        <td>+${escapeHtml(String(item.score))}</td>
        <td>${item.matched ? "✅" : "❌"}</td>
      </tr>
    `).join("")}</tbody></table>`;
  }

  function buildSuggestions(analysis) {
    if (analysis.rating === "A") return ["優先寄出 soft knock-door 開發信。", "確認採購或品牌引入窗口。", "可附 3-5 個推薦產品和簡短型錄。"];
    if (analysis.rating === "B") return ["先補充聯絡人或社媒資料。", "用簡短郵件測試對方是否願意接收產品資料。"];
    if (analysis.rating === "C") return ["低頻觸達，不要一次推太多產品。", "優先補官網 About Us、品牌頁或門店資訊。"];
    if (analysis.rating === "NR") return ["目前證據不足，先手動貼上網站摘要或重新抓取。"];
    return ["暫緩高頻開發。", "如果名單量大，可先放入低優先級池。"];
  }

  function normalizeKeys(row) {
    const out = {};
    Object.entries(row || {}).forEach(([key, value]) => {
      const normalized = key.toLowerCase().trim().replace(/[\s_-]+/g, "");
      out[normalized] = value;
      out[key.toLowerCase().trim()] = value;
    });
    return out;
  }

  function getAny(normalized, ...keys) {
    for (const key of keys) {
      const value = normalized[key.toLowerCase().replace(/[\s_-]+/g, "")] ?? normalized[key.toLowerCase()];
      if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
    }
    return "";
  }

  function parseBoolean(value, fallback = false) {
    const text = normalizeText(value).toLowerCase();
    if (!text) return fallback;
    if (/^(yes|y|true|1|是|係)$/i.test(text)) return true;
    if (/^(no|n|false|0|否|不是)$/i.test(text)) return false;
    return fallback;
  }

  function parseNumber(value, fallback = "") {
    const text = normalizeText(value).replace(/,/g, "");
    if (!text) return fallback;
    const num = Number(text);
    return Number.isFinite(num) ? num : fallback;
  }

  function normalizeCustomerType(value) {
    const text = normalizeText(value).toLowerCase();
    return CUSTOMER_TYPES.includes(text) ? text : "prospect";
  }

  function normalizeGroupId(value) {
    const text = normalizeText(value);
    return text && text !== "null" && text !== "__ungrouped__" ? text : "";
  }

  function isOldCustomerGroupValue(value) {
    const text = normalizeText(value).toLowerCase().replace(/[\s_-]+/g, "");
    return text.includes("oldcustomers") || text.includes("oldcustomer") || text.includes("旧客户") || text.includes("舊客戶");
  }

  function getOldCustomerGroupId() {
    return state.groups.find((group) => isOldCustomerGroupValue(group.name))?.id || OLD_CUSTOMER_GROUP_ID;
  }

  function isOldCustomerGroupId(value) {
    const id = normalizeGroupId(value);
    return id === OLD_CUSTOMER_GROUP_ID || state.groups.some((group) => group.id === id && isOldCustomerGroupValue(group.name));
  }

  function isOldCustomerImportRow(row = {}) {
    const normalized = normalizeKeys(row);
    const group = getAny(normalized, "Group ID", "group_id", "groupId", "Group", "group", "组别", "組別", "客户组别", "客戶組別");
    return isOldCustomerGroupValue(group);
  }

  function groupName(groupId) {
    const id = normalizeGroupId(groupId);
    if (!id) return "未分組 / Ungrouped";
    return state.groups.find((group) => group.id === id)?.name || "Unknown Group";
  }

  function resolveGroupId(value) {
    const text = normalizeGroupId(value);
    if (!text) return "";
    if (isOldCustomerGroupValue(text)) return getOldCustomerGroupId();
    return state.groups.find((group) => group.id === text || group.name.toLowerCase() === text.toLowerCase())?.id || text;
  }

  function groupOptionsHtml(selected = "", options = {}) {
    const selectedId = normalizeGroupId(selected);
    const firstLabel = options.firstLabel || "未分組 / Ungrouped";
    return [
      `<option value="" ${!selectedId ? "selected" : ""}>${escapeHtml(firstLabel)}</option>`,
      ...state.groups.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === selectedId ? "selected" : ""}>${escapeHtml(group.name)}</option>`)
    ].join("");
  }

  function normalizeImportedCustomer(row) {
    const n = normalizeKeys(row);
    const customerTypeText = getAny(n, "Customer Type", "customer_type", "客戶類型", "客户类型");
    const industry = getAny(n, "Industry", "industry", "行業類別", "行业类别", "行業", "行业");
    const contactEmail = getAny(n, "Contact Email", "contact_email", "email", "email address", "Primary Contact Email", "主要聯絡人郵箱", "主要联系人邮箱", "郵箱", "邮箱", "電子郵箱", "电子邮箱", "聯絡郵箱", "联系邮箱");
    const rawContactName = getAny(n, "Contact Name", "contact_name", "contact", "Primary Contact Name", "主要聯絡人名稱", "主要联系人名称", "聯絡人", "联系人", "联系人姓名");
    const contactName = normalizeContactName(rawContactName, contactEmail);
    const contactNote = contactNameNote(rawContactName, contactEmail);
    const buyingRole = normalizeBuyingRole(getAny(n, "Buying Role", "Buyer Classification", "Customer Category", "buying_role", "buyingRole", "購買角色", "购买角色", "買家分類", "买家分类"));
    const customerScore = normalizeCustomerScore(getAny(n, "Customer Score", "customer_score", "customerScore", "客戶價值分數", "客户价值分数", "客戶分數", "客户分数"));
    const groupId = resolveGroupId(getAny(n, "Group ID", "group_id", "groupId", "Group", "group", "組別", "组别", "客戶組別", "客户组别"));
    const country = getAny(n, "Country", "country", "國家", "国家", "地區", "地区", "國家地區名", "国家地区名", "國家地區名稱", "国家地区名称");
    const city = getAny(n, "City", "city", "城市", "城巿");
    const mainProducts = getAny(n, "Main Products", "main_products", "主營產品", "主营产品");
    const notes = [
      getAny(n, "Notes", "notes", "備註", "备注"),
      getAny(n, "Company Type", "company_type", "公司類型", "公司类型"),
      contactNote,
      industry ? `Industry: ${industry}` : ""
    ].filter(Boolean).join(" | ");
    return {
      id: getAny(n, "id", "Customer ID", "customer_id", "客戶ID", "客户ID") || uid("cust"),
      companyName: getAny(n, "Company Name", "company_name", "company", "name", "公司名稱", "公司名称"),
      website: normalizeUrl(getAny(n, "Website", "website", "domain", "url", "Company Website", "Company Homepage", "公司主頁", "公司主页", "官網", "官网", "官網域名", "官网域名")),
      contactName,
      contactNameOriginal: contactName ? "" : rawContactName,
      contactNameType: contactNameType(rawContactName, contactEmail),
      contactEmail,
      country,
      city,
      industry,
      mainProducts,
      groupId,
      group_id: groupId,
      buyingRole,
      isBuyingRoleManuallyReviewed: buyingRole !== "Unknown",
      customerScore,
      customerType: normalizeCustomerType(customerTypeText),
      rating: getAny(n, "Rating", "rating", "評級", "评级") || "NR",
      scores: { priority: 0, productFit: 0, confidence: 0, readiness: 0 },
      businessSignals: [],
      recommendedProducts: [],
      attachments: [],
      emailContacts: [],
      emailDraft: { subject: "", body: "", emailAttachments: [] },
      followUpStatus: FOLLOW_STATUSES.includes(getAny(n, "Follow-up Status", "follow_up_status").toLowerCase()) ? getAny(n, "Follow-up Status", "follow_up_status").toLowerCase() : "open",
      nextFollowUpDate: getAny(n, "Next Follow-up Date", "next_follow_up_date"),
      lastContactDate: getAny(n, "Last Contact Date", "last_contact_date"),
      lastAnalyzedAt: "",
      isManuallyReviewed: false,
      manualOverride: null,
      notes,
      socialMedia: { instagram: getAny(n, "Instagram"), facebook: getAny(n, "Facebook") },
      manualWebsiteSummary: "",
      websiteExtract: "",
      emailPurpose: getAny(n, "Email Purpose", "email_purpose", "郵件目的", "邮件目的") || "First Touch",
      createdAt: new Date().toISOString()
    };
  }

  function normalizeImportedProduct(row) {
    const n = normalizeKeys(row);
    const priorityValue = getAny(n, "Priority", "isPriority", "priority", "產品優先級", "产品优先级");
    const priorityNumber = parseNumber(priorityValue, "");
    const targetPriorities = normalizeTargetPriorities({
      A: getAny(n, "A=批發", "A", "Wholesaler Priority", "批發優先"),
      B: getAny(n, "B=實體零售", "B", "Physical Reseller Priority", "實體零售優先"),
      C: getAny(n, "C=網店零售", "C", "Online Reseller Priority", "網店零售優先"),
      D: getAny(n, "D=工作室", "D", "Studio Priority", "工作室優先"),
      All: getAny(n, "All= 全部", "All", "All Priority", "全部優先")
    });
    const primary = Object.entries(targetPriorities).sort((a, b) => Number(a[1]) - Number(b[1]))[0];
    const legacyTarget = primary?.[0] || normalizeRecommendedFor(getAny(n, "Recommended For", "recommended_for", "recommendedFor", "適合角色", "适合角色", "推薦對象", "推荐对象"));
    const legacyPriority = primary?.[1] ?? priorityNumber;
    return {
      id: uid("prod"),
      name: getAny(n, "Product Name", "product_name", "name", "product", "Items", "Item", "產品名稱", "产品名称", "產品", "产品"),
      category: getAny(n, "Category", "category", "分類", "分类") || "Uncategorized",
      inRecommendationPool: Object.keys(targetPriorities).length > 0 || parseBoolean(getAny(n, "In Recommendation Pool", "in_recommendation_pool", "recommendation pool", "納入推薦池", "纳入推荐池"), false),
      targetPriorities,
      recommendedFor: legacyTarget,
      priority: legacyPriority,
      isPriority: Object.values(targetPriorities).some((value) => Number(value) <= 3) || (priorityNumber !== "" ? Number(priorityNumber) <= 3 : parseBoolean(priorityValue, false)),
      sku: getAny(n, "SKU", "sku", "No.", "No", "產品編號", "产品编号"),
      description: getAny(n, "Description", "description", "產品描述", "产品描述"),
      price: parseNumber(getAny(n, "Price", "price", "價格", "价格"), ""),
      productUrl: normalizeUrl(getAny(n, "Product URL", "product_url", "url", "產品連結", "产品链接", "產品網址", "产品网址")),
      launchDate: getAny(n, "Launch Date", "launch_date", "上市日期"),
      createdAt: new Date().toISOString()
    };
  }

  function mergeProductTargetData(existing = {}, incoming = {}) {
    const targetPriorities = {};
    [existing, incoming].forEach((product) => {
      Object.entries(normalizeTargetPriorities(product.targetPriorities)).forEach(([target, priority]) => {
        if (targetPriorities[target] === undefined || Number(priority) < Number(targetPriorities[target])) {
          targetPriorities[target] = priority;
        }
      });
    });
    const primary = Object.keys(targetPriorities).length ? primaryTargetPriority({ targetPriorities }) : null;
    return {
      ...existing,
      ...incoming,
      id: existing.id || incoming.id,
      name: existing.name || incoming.name,
      sku: existing.sku || incoming.sku || "",
      targetPriorities,
      inRecommendationPool: Object.keys(targetPriorities).length > 0 || Boolean(existing.inRecommendationPool) || Boolean(incoming.inRecommendationPool),
      isPriority: Object.values(targetPriorities).some((value) => Number(value) <= 3) || Boolean(existing.isPriority) || Boolean(incoming.isPriority),
      priority: primary ? primary[1] : "",
      recommendedFor: primary ? primary[0] : "All"
    };
  }

  function removeEmpty(record) {
    return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== "" && value !== null && value !== undefined));
  }

  function stripTransientCustomerFields(customer) {
    const { _normalizedDomain, ...clean } = customer;
    return clean;
  }

  function customerKey(customer) {
    const company = normalizeText(customer.companyName).toLowerCase();
    const website = normalizeDomain(customer.website);
    return `${company}|${website}`;
  }

  function normalizeDomain(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) return "";
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      return url.hostname.replace(/^www\./i, "");
    } catch {
      return text.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
    }
  }

  function websiteDomain(customer) {
    return customer._normalizedDomain || normalizeDomain(customer.website);
  }

  function importedRowDomain(row) {
    return normalizeDomain(getAny(normalizeKeys(row), "_normalizedDomain", "_normalized_domain", "normalizedDomain"));
  }

  function isDuplicateCustomer(a, b) {
    const companyA = normalizeText(a.companyName).toLowerCase();
    const companyB = normalizeText(b.companyName).toLowerCase();
    if (companyA && companyB && companyA === companyB) return true;
    const domainA = websiteDomain(a);
    const domainB = websiteDomain(b);
    return Boolean(domainA && domainB && domainA === domainB);
  }

  function isForceUpdateRow(row) {
    const n = normalizeKeys(row);
    return /^(yes|1)$/i.test(getAny(n, "Force_Update", "Force Update", "force_update"));
  }

  function customerSearchText(customer = {}) {
    const emailContacts = normalizeEmailContacts(customer.emailContacts)
      .map((contact) => contact.email);
    return [
      customer.companyName,
      customer.website,
      customer.contactName,
      customer.contactEmail,
      customer.country,
      customer.city,
      customer.industry,
      customer.address,
      customer.notes,
      customer.mainProducts,
      customer.groupId,
      customer.group_id,
      normalizeBuyingRole(customer.buyingRole),
      buyingRoleDisplay(customer.buyingRole),
      groupName(customer.groupId || customer.group_id),
      ...emailContacts
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function filterCustomers(customers) {
    const type = dom.customerTypeFilter.value;
    const rating = dom.ratingFilter.value;
    const status = dom.followStatusFilter.value;
    const buyingRole = dom.buyingRoleFilter?.value || "";
    const groupFilter = dom.groupFilter?.value || "";
    const sent = dom.sentEmailFilter?.value || "";
    const replied = dom.repliedFilter?.value || "";
    const topic = dom.followUpTopicFilter?.value || "";
    const nextRange = dom.nextFollowUpRangeFilter?.value || "";
    const query = normalizeText(dom.customerSearch.value).toLowerCase();
    return customers.filter((customer) => {
      if (type && customer.customerType !== type) return false;
      if (rating && customer.rating !== rating) return false;
      if (status && customer.followUpStatus !== status) return false;
      if (buyingRole && normalizeBuyingRole(customer.buyingRole) !== buyingRole) return false;
      const sentCount = Number(customer.sentEmailCount || 0);
      if (sent === "yes" && !sentCount) return false;
      if (sent === "no" && sentCount) return false;
      if (replied === "yes" && !customer.replied) return false;
      if (replied === "no" && customer.replied) return false;
      if (topic && customer.lastFollowUpTopic !== topic) return false;
      const nextDate = String(customer.nextFollowUpDate || "");
      if (nextRange === "today" && nextDate !== TODAY) return false;
      if (nextRange === "due" && (!nextDate || nextDate > TODAY)) return false;
      const customerGroupId = normalizeGroupId(customer.groupId || customer.group_id);
      if (groupFilter === "__ungrouped__" && customerGroupId) return false;
      if (groupFilter && groupFilter !== "__ungrouped__" && customerGroupId !== groupFilter) return false;
      if (query && !customerSearchText(customer).includes(query)) return false;
      return true;
    });
  }

  function formCustomer() {
    const existing = state.currentCustomerId ? DB.getCustomers().find((item) => item.id === state.currentCustomerId) : null;
    const contactEmail = normalizeText(dom.contactEmail.value);
    const rawContactName = normalizeText(dom.contactName.value);
    const contactName = normalizeContactName(rawContactName, contactEmail);
    const contactNote = contactNameNote(rawContactName, contactEmail);
    return {
      id: state.currentCustomerId || uid("cust"),
      companyName: normalizeText(dom.companyName.value),
      website: normalizeUrl(dom.website.value),
      contactName,
      contactNameOriginal: contactName ? "" : rawContactName || existing?.contactNameOriginal || "",
      contactNameType: contactNameType(rawContactName, contactEmail) || existing?.contactNameType || "",
      contactEmail,
      country: normalizeText(dom.country.value),
      city: normalizeText(dom.city.value),
      industry: normalizeText(dom.industry.value),
      mainProducts: normalizeText(dom.mainProducts.value),
      groupId: normalizeGroupId(existing?.groupId || existing?.group_id),
      group_id: normalizeGroupId(existing?.group_id || existing?.groupId),
      buyingRole: normalizeBuyingRole(dom.buyingRole?.value || existing?.buyingRole),
      isBuyingRoleManuallyReviewed: Boolean(existing?.isBuyingRoleManuallyReviewed || state.buyingRoleManualDirty),
      customerScore: normalizeCustomerScore(existing?.customerScore),
      customerType: existing?.customerType || "prospect",
      rating: existing?.rating || "NR",
      scores: existing?.scores || { priority: 0, productFit: 0, confidence: 0, readiness: 0 },
      businessSignals: existing?.businessSignals || [],
      recommendedProducts: existing?.recommendedProducts || [],
      attachments: existing?.attachments || [],
      emailContacts: normalizeEmailContacts(existing?.emailContacts),
      emailDraft: {
        ...(existing?.emailDraft || { subject: "", body: "" }),
        emailAttachments: persistableAttachments(state.emailAttachments.length ? state.emailAttachments : existing?.emailDraft?.emailAttachments)
      },
      followUpStatus: existing?.followUpStatus || "open",
      nextFollowUpDate: existing?.nextFollowUpDate || "",
      lastContactDate: existing?.lastContactDate || "",
      lastAnalyzedAt: existing?.lastAnalyzedAt || "",
      isManuallyReviewed: Boolean(existing?.isManuallyReviewed),
      manualOverride: existing?.manualOverride || null,
      notes: [normalizeText(dom.businessNotes.value), contactNote].filter(Boolean).join(" | "),
      socialMedia: { instagram: normalizeUrl(dom.instagram.value), facebook: normalizeUrl(dom.facebook.value) },
      manualWebsiteSummary: normalizeText(dom.manualWebsiteSummary.value),
      websiteExtract: cleanWebsiteExtract(dom.websiteExtract.value),
      emailPurpose: dom.emailPurpose.value,
      createdAt: existing?.createdAt || new Date().toISOString()
    };
  }

  function fillEmailRecipientFields(customer = {}, options = {}) {
    const contacts = normalizeEmailContacts(customer.emailContacts);
    const isExisting = normalizeCustomerType(customer.customerType) === "existing";
    const setRecipientValue = (input, value) => {
      if (!input) return;
      if (options.preserveManual && normalizeText(input.value)) return;
      input.value = value || "";
    };
    const fallbackTo = displayRecipient(customer.contactEmail || dom.contactEmail?.value, customer.contactName || dom.contactName?.value);
    setRecipientValue(dom.emailTo, isExisting && contacts.length ? contactsByRole(contacts, "to") : fallbackTo);
    setRecipientValue(dom.emailCc, isExisting && contacts.length ? contactsByRole(contacts, "cc") : "");
    setRecipientValue(dom.emailBcc, isExisting && contacts.length ? contactsByRole(contacts, "bcc") : "");
    renderQuickEmailContactsPanel();
  }

  function currentQuickEmailContacts() {
    const customer = DB.getCustomers().find((item) => item.id === state.currentCustomerId);
    return normalizeEmailContacts(customer?.emailContacts);
  }

  function emailRoleInput(role) {
    const normalized = normalizeEmailRole(role);
    if (normalized === "cc") return dom.emailCc;
    if (normalized === "bcc") return dom.emailBcc;
    return dom.emailTo;
  }

  function appendEmailToInput(input, email) {
    if (!input || !email) return;
    const next = splitEmailList(input.value);
    if (!next.some((item) => item.toLowerCase() === email.toLowerCase())) next.push(email);
    input.value = next.join(", ");
  }

  function closeQuickEmailContactsPanel() {
    dom.emailContactQuickPanel?.classList.add("hidden");
    dom.quickEmailContactsBtn?.setAttribute("aria-expanded", "false");
  }

  function renderQuickEmailContactsPanel() {
    if (!dom.emailContactQuickPanel) return;
    const contacts = currentQuickEmailContacts();
    dom.emailContactQuickPanel.innerHTML = contacts.length
      ? contacts.map((contact, index) => `
        <button class="email-contact-quick-item" data-action="quick-email-contact" data-id="${index}" type="button">
          <strong>${escapeHtml(contact.role.toUpperCase())}</strong>
          <span>${escapeHtml(contact.email)}</span>
        </button>
      `).join("")
      : `<div class="email-contact-quick-empty">No saved contacts. Use Contacts to add one.</div>`;
  }

  function toggleQuickEmailContactsPanel() {
    if (!dom.emailContactQuickPanel) return;
    renderQuickEmailContactsPanel();
    const willOpen = dom.emailContactQuickPanel.classList.contains("hidden");
    dom.emailContactQuickPanel.classList.toggle("hidden", !willOpen);
    dom.quickEmailContactsBtn?.setAttribute("aria-expanded", String(willOpen));
  }

  function applyQuickEmailContact(index) {
    const contact = currentQuickEmailContacts()[Number(index)];
    if (!contact) return;
    appendEmailToInput(emailRoleInput(contact.role), contact.email);
    closeQuickEmailContactsPanel();
    UI.toast(`Added ${contact.email} to ${contact.role.toUpperCase()}.`, "good");
  }

  function fillAnalysisForm(customer) {
    state.currentCustomerId = customer.id || "";
    state.buyingRoleManualDirty = false;
    dom.companyName.value = customer.companyName || "";
    dom.website.value = customer.website || "";
    dom.contactName.value = customer.contactName || "";
    dom.contactEmail.value = customer.contactEmail || "";
    dom.country.value = customer.country || "";
    dom.city.value = customer.city || "";
    dom.industry.value = customer.industry || "";
    dom.mainProducts.value = customer.mainProducts || "";
    if (dom.buyingRole) dom.buyingRole.value = normalizeBuyingRole(customer.buyingRole);
    if (dom.buyingRoleManualStatus) {
      dom.buyingRoleManualStatus.textContent = customer.isBuyingRoleManuallyReviewed
        ? "Manual value saved. Auto detection will not overwrite it."
        : "Auto detection will update this after analysis.";
    }
    dom.instagram.value = customer.socialMedia?.instagram || "";
    dom.facebook.value = customer.socialMedia?.facebook || "";
    dom.businessNotes.value = customer.notes || "";
    dom.manualWebsiteSummary.value = customer.manualWebsiteSummary || "";
    dom.websiteExtract.value = cleanWebsiteExtract(customer.websiteExtract || "");
    dom.emailPurpose.value = customer.emailPurpose || (customer.customerType === "existing" ? "Existing Customer Update" : "First Touch");
    UI.renderTemplateEditor({ selectedValue: `default:${purposeKey(dom.emailPurpose.value || "First Touch")}` });
    fillEmailRecipientFields(customer);
    state.emailAttachments = normalizeAttachments(customer.emailDraft?.emailAttachments || []);
    UI.renderAttachmentList();
    const stale = daysSince(customer.lastAnalyzedAt);
    if (stale !== null && stale > 30) {
      dom.staleBanner.classList.remove("hidden");
      dom.staleBanner.textContent = `距離上次分析已 ${stale} 天，官網可能已更新。`;
    } else {
      dom.staleBanner.classList.add("hidden");
    }
  }

  async function fetchWebsite(urlOverride = "") {
    const url = normalizeUrl(urlOverride || dom.website.value);
    if (!url) {
      UI.toast("Please enter a website URL first.", "warn");
      return "";
    }
    UI.toast("Fetching website...", "warn");
    const response = await fetch(`${API_BASE}/api/fetch-website`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      DB.addErrorLog("抓取官網", new Error(payload.error || "Website fetch failed."), { id: state.currentCustomerId, companyName: dom.companyName.value });
      UI.renderErrorLogs();
      UI.toast(payload.error || "Website fetch failed.", "bad");
      return "";
    }
    const content = cleanWebsiteExtract(payload.content || "") || normalizeText(payload.content || "");
    if (!urlOverride || normalizeUrl(dom.website.value) === url) {
      dom.websiteExtract.value = content;
    }
    UI.toast("Website fetched and extract cleaned.", "good");
    return content;
  }

  async function runAnalysis({ autoFetch = true, save = false, customerOverride = null } = {}) {
    let customer = customerOverride || formCustomer();
    if (!customer.companyName && customer.website) customer.companyName = customer.website.replace(/^https?:\/\/(www\.)?/i, "").split(/[/.]/)[0];
    if (!customer.companyName && !customer.website && !customer.manualWebsiteSummary && !customer.websiteExtract) {
      UI.toast("Please enter company, website, or evidence text.", "warn");
      return null;
    }
    if (autoFetch && customer.website && !customer.websiteExtract && !customer.manualWebsiteSummary) {
      const content = await fetchWebsite(customer.website).catch((error) => {
        DB.addErrorLog("抓取官網", error, customer);
        UI.renderErrorLogs();
        return "";
      });
      customer.websiteExtract = content || customer.websiteExtract;
    }
    customer.websiteExtract = cleanWebsiteExtract(customer.websiteExtract);
    if (!customerOverride && dom.websiteExtract) dom.websiteExtract.value = customer.websiteExtract;
    const roleEvidence = [
      customer.websiteExtract,
      customer.manualWebsiteSummary,
      customer.notes,
      customer.industry,
      customer.website
    ].filter(Boolean).join("\n");
    if (!customer.isBuyingRoleManuallyReviewed) {
      customer.buyingRole = determineBuyingRole(roleEvidence, customer);
      if (!customerOverride && dom.buyingRole) dom.buyingRole.value = customer.buyingRole;
      if (!customerOverride && dom.buyingRoleManualStatus) {
        dom.buyingRoleManualStatus.textContent = `Auto detected: ${buyingRoleDisplay(customer.buyingRole)}`;
      }
    } else {
      customer.buyingRole = normalizeBuyingRole(customer.buyingRole);
    }
    const scoring = ScoringEngine.calculate({
      ...customer,
      businessNotes: customer.notes,
      instagram: customer.socialMedia?.instagram,
      facebook: customer.socialMedia?.facebook
    });
    const recommendedProducts = RecommendationEngine.recommend(customer, scoring);
    const analysis = {
      ...scoring,
      recommendedProducts
    };
    const emailDraft = EmailEngine.generate({ ...customer, emailPurpose: customer.emailPurpose || dom.emailPurpose.value }, analysis);
    analysis.emailDraft = emailDraft;
    analysis.emailRecommendedProducts = emailDraft.emailRecommendedProducts || recommendedProducts;
    analysis.emailStrategy = emailDraft.emailStrategy || null;
    customer = {
      ...customer,
      rating: analysis.rating,
      scores: analysis.scores,
      businessSignals: analysis.businessSignals,
      recommendedProducts,
      emailDraft: { ...emailDraft, emailAttachments: persistableAttachments(customer.emailDraft?.emailAttachments || state.emailAttachments) },
      lastAnalyzedAt: new Date().toISOString(),
      suggestedAction: suggestAction({ ...customer, ...analysis }),
      websiteExtract: customer.websiteExtract || cleanWebsiteExtract(dom.websiteExtract.value)
    };
    if (customer.manualOverride) {
      customer.rating = customer.manualOverride.rating;
      customer.isManuallyReviewed = true;
    }
    DB.addAnalysisHistory(customer.id, customer);
    state.currentAnalysis = analysis;
    state.currentCustomerId = customer.id;
    UI.renderAnalysisResult(customer, analysis);
    if (!customerOverride) fillEmailRecipientFields(customer, { preserveManual: true });
    if (save) upsertCustomer(customer);
    return customer;
  }

  function upsertCustomer(customer) {
    const customers = DB.getCustomers();
    const index = customers.findIndex((item) => item.id === customer.id || isDuplicateCustomer(item, customer));
    if (index >= 0) customers[index] = { ...customers[index], ...customer, id: customers[index].id };
    else customers.unshift(customer);
    DB.setCustomers(customers);
    UI.refreshAll();
    UI.toast("Customer saved.", "good");
  }

  function openProductDialog(product = null) {
    if (!canManageProducts()) {
      UI.toast("Product editing is not allowed for this role.", "warn");
      return;
    }
    dom.productDialogTitle.textContent = product ? "編輯產品" : "新增產品";
    dom.productId.value = product?.id || "";
    dom.productName.value = product?.name || "";
    dom.productCategory.value = product?.category || "";
    dom.productInPool.checked = Boolean(product?.inRecommendationPool);
    const targetPriorities = editableTargetPriorities(product || {});
    ["A", "B", "C", "D", "All"].forEach((target) => {
      const input = dom[`productPriority${target}`];
      if (input) input.value = targetPriorities[target] ?? "";
    });
    dom.productPriority.checked = Object.keys(targetPriorities).length > 0;
    dom.productPriorityNumber.value = primaryTargetPriority({ targetPriorities })[1] || "";
    dom.productRecommendedFor.value = Object.keys(targetPriorities).length ? primaryTargetPriority({ targetPriorities })[0] : "All";
    dom.productSku.value = product?.sku || "";
    dom.productDescription.value = product?.description || "";
    dom.productPrice.value = product?.price ?? "";
    dom.productUrl.value = product?.productUrl || "";
    dom.productLaunchDate.value = product?.launchDate || "";
    dom.productDialog.showModal();
  }

  function saveProductFromDialog() {
    if (!canManageProducts()) {
      UI.toast("Product editing is not allowed for this role.", "warn");
      return;
    }
    const products = DB.getProducts();
    const targetPriorities = {};
    TARGET_PRIORITY_DISPLAY_ORDER.forEach((target) => {
      const value = parseNumber(dom[`productPriority${target}`]?.value, "");
      if (value !== "") targetPriorities[target] = value;
    });
    const primary = Object.keys(targetPriorities).length ? primaryTargetPriority({ targetPriorities }) : null;
    const product = {
      id: dom.productId.value || uid("prod"),
      name: normalizeText(dom.productName.value),
      category: normalizeText(dom.productCategory.value),
      inRecommendationPool: dom.productInPool.checked,
      targetPriorities,
      isPriority: dom.productPriority.checked || Object.values(targetPriorities).some((value) => Number(value) <= 3),
      priority: primary ? primary[1] : "",
      recommendedFor: primary ? primary[0] : "All",
      sku: normalizeText(dom.productSku.value),
      description: normalizeText(dom.productDescription.value),
      price: parseNumber(dom.productPrice.value, ""),
      productUrl: normalizeUrl(dom.productUrl.value),
      launchDate: dom.productLaunchDate.value,
      createdAt: new Date().toISOString()
    };
    if (!product.name) return;
    const index = products.findIndex((item) => item.id === product.id);
    if (index >= 0) products[index] = { ...products[index], ...product };
    else products.unshift(product);
    DB.setProducts(products);
    UI.renderProductList();
    UI.toast("Product saved.", "good");
  }

  function openCustomerDialog(customer = null) {
    if (!canManageCustomers()) {
      UI.toast("Customer editing is not allowed for this role.", "warn");
      return;
    }
    dom.customerDialogTitle.textContent = customer ? "編輯客戶" : "新增客戶";
    dom.customerId.value = customer?.id || "";
    dom.dialogCompanyName.value = customer?.companyName || "";
    dom.dialogWebsite.value = customer?.website || "";
    dom.dialogContactName.value = customer?.contactName || "";
    dom.dialogContactEmail.value = customer?.contactEmail || "";
    dom.dialogCountry.value = customer?.country || "";
    dom.dialogMainProducts.value = customer?.mainProducts || "";
    if (dom.dialogGroup) {
      dom.dialogGroup.innerHTML = groupOptionsHtml(customer?.groupId || customer?.group_id);
      dom.dialogGroup.value = normalizeGroupId(customer?.groupId || customer?.group_id);
    }
    dom.dialogCustomerScore.value = customer?.customerScore ?? "";
    dom.dialogBuyingRole.value = normalizeBuyingRole(customer?.buyingRole);
    dom.dialogCustomerType.value = customer?.customerType || "prospect";
    dom.dialogFollowStatus.value = customer?.followUpStatus || "open";
    dom.dialogNextFollowDate.value = customer?.nextFollowUpDate || "";
    dom.customerDialog.showModal();
  }

  function saveCustomerFromDialog() {
    if (!canManageCustomers()) {
      UI.toast("Customer editing is not allowed for this role.", "warn");
      return;
    }
    const existing = DB.getCustomers().find((item) => item.id === dom.customerId.value);
    const selectedBuyingRole = normalizeBuyingRole(dom.dialogBuyingRole.value);
    const buyingRoleWasChanged = selectedBuyingRole !== normalizeBuyingRole(existing?.buyingRole);
    const contactEmail = normalizeText(dom.dialogContactEmail.value);
    const rawContactName = normalizeText(dom.dialogContactName.value);
    const contactName = normalizeContactName(rawContactName, contactEmail);
    const customer = {
      ...(existing || normalizeImportedCustomer({})),
      id: dom.customerId.value || uid("cust"),
      companyName: normalizeText(dom.dialogCompanyName.value),
      website: normalizeUrl(dom.dialogWebsite.value),
      contactName,
      contactNameOriginal: contactName ? "" : rawContactName || existing?.contactNameOriginal || "",
      contactNameType: contactNameType(rawContactName, contactEmail) || existing?.contactNameType || "",
      contactEmail,
      country: normalizeText(dom.dialogCountry.value),
      mainProducts: normalizeText(dom.dialogMainProducts.value),
      groupId: normalizeGroupId(dom.dialogGroup?.value),
      group_id: normalizeGroupId(dom.dialogGroup?.value),
      customerScore: normalizeCustomerScore(dom.dialogCustomerScore.value),
      emailContacts: normalizeEmailContacts(existing?.emailContacts),
      buyingRole: selectedBuyingRole,
      isBuyingRoleManuallyReviewed: Boolean(existing?.isBuyingRoleManuallyReviewed || buyingRoleWasChanged && selectedBuyingRole !== "Unknown"),
      customerType: dom.dialogCustomerType.value,
      followUpStatus: dom.dialogFollowStatus.value,
      nextFollowUpDate: dom.dialogNextFollowDate.value,
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    upsertCustomer(customer);
  }

  function renderEmailContactsDialog() {
    const contacts = normalizeEmailContacts(state.emailContactsDraft);
    state.emailContactsDraft = contacts;
    dom.emailContactsList.innerHTML = contacts.length
      ? contacts.map((contact, index) => `
        <div class="email-contact-row">
          <input data-action="edit-email-contact-email" data-id="${index}" type="email" value="${escapeHtml(contact.email)}">
          <select data-action="edit-email-contact-role" data-id="${index}">
            <option value="to" ${contact.role === "to" ? "selected" : ""}>To</option>
            <option value="cc" ${contact.role === "cc" ? "selected" : ""}>CC</option>
            <option value="bcc" ${contact.role === "bcc" ? "selected" : ""}>BCC</option>
          </select>
          <button class="danger-button" data-action="remove-email-contact" data-id="${index}" type="button">Delete</button>
        </div>
      `).join("")
      : `<div class="empty">No email contacts yet.</div>`;
  }

  function openEmailContactsDialog(customerId = state.currentCustomerId) {
    const customer = DB.getCustomers().find((item) => item.id === customerId);
    if (!customer) {
      UI.toast("Please load or save a customer first.", "warn");
      return;
    }
    dom.emailContactsCustomerId.value = customer.id;
    state.emailContactsDraft = normalizeEmailContacts(customer.emailContacts);
    if (!state.emailContactsDraft.length && customer.contactEmail) {
      state.emailContactsDraft = [{ email: customer.contactEmail, role: "to" }];
    }
    dom.emailContactAddress.value = "";
    dom.emailContactRole.value = "to";
    renderEmailContactsDialog();
    dom.emailContactsDialog.showModal();
  }

  function addEmailContactFromDialog() {
    const email = normalizeText(dom.emailContactAddress.value);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      UI.toast("Please enter a valid email address.", "warn");
      return;
    }
    state.emailContactsDraft = normalizeEmailContacts([
      ...state.emailContactsDraft,
      { email, role: normalizeEmailRole(dom.emailContactRole.value) }
    ]);
    dom.emailContactAddress.value = "";
    dom.emailContactRole.value = "to";
    renderEmailContactsDialog();
  }

  function saveEmailContactsFromDialog() {
    const customerId = dom.emailContactsCustomerId.value;
    const contacts = normalizeEmailContacts(state.emailContactsDraft);
    const customers = DB.getCustomers().map((item) => item.id === customerId
      ? { ...item, emailContacts: contacts }
      : item);
    DB.setCustomers(customers);
    const current = customers.find((item) => item.id === customerId);
    if (current && state.currentCustomerId === customerId) {
      fillEmailRecipientFields(current);
    }
    UI.refreshAll();
    UI.toast("Email contacts saved.", "good");
  }

  function openLogDialog(customerId = state.currentCustomerId) {
    if (!customerId) {
      UI.toast("Please load or save a customer first.", "warn");
      return;
    }
    dom.logCustomerId.value = customerId;
    dom.logDate.value = todayString();
    dom.logChannel.value = "Email";
    dom.logContactPerson.value = "";
    dom.logSubject.value = "";
    dom.logSummary.value = "";
    dom.logResponse.value = "neutral";
    dom.logNextAction.value = "";
    dom.logNextFollowDate.value = "";
    dom.logDialog.showModal();
  }

  function saveLogFromDialog() {
    const logs = DB.getLogs();
    const logId = uid("log");
    const log = {
      logId,
      customerId: dom.logCustomerId.value,
      logDate: dom.logDate.value,
      channel: dom.logChannel.value,
      contactPerson: normalizeText(dom.logContactPerson.value),
      subject: normalizeText(dom.logSubject.value),
      summary: normalizeText(dom.logSummary.value),
      response: dom.logResponse.value,
      nextAction: normalizeText(dom.logNextAction.value),
      nextFollowUpDate: dom.logNextFollowDate.value,
      status: "open",
      createdAt: new Date().toISOString()
    };
    logs[logId] = log;
    DB.setLogs(logs);
    const customers = DB.getCustomers();
    const index = customers.findIndex((item) => item.id === log.customerId);
    if (index >= 0) {
      customers[index].lastContactDate = log.logDate;
      if (log.nextFollowUpDate) customers[index].nextFollowUpDate = log.nextFollowUpDate;
      if (log.channel === "Email") {
        customers[index].emailHistory = customers[index].emailHistory || [];
        customers[index].emailHistory.unshift({ subject: log.subject, summary: log.summary, emailAttachments: [], createdAt: log.createdAt });
        customers[index].emailHistory = customers[index].emailHistory.slice(0, 10);
      }
      DB.setCustomers(customers);
    }
    UI.renderTimeline(log.customerId);
    UI.refreshAll();
    UI.toast("Follow-up log saved.", "good");
  }

  function addEmailSentLog(customer, subject, messageId, attachments = []) {
    if (!customer?.id) return;
    const logs = DB.getLogs();
    const logId = uid("log");
    const log = {
      logId,
      customerId: customer.id,
      logDate: todayString(),
      channel: "Email",
      contactPerson: customer.contactName || "",
      subject,
      summary: `郵件已發送給 ${customer.companyName || customer.contactEmail || "client"}${messageId ? ` (${messageId})` : ""}`,
      response: "no_response",
      nextAction: "",
      nextFollowUpDate: customer.nextFollowUpDate || "",
      status: "open",
      createdAt: new Date().toISOString()
    };
    logs[logId] = log;
    DB.setLogs(logs);

    const customers = DB.getCustomers();
    const index = customers.findIndex((item) => item.id === customer.id);
    if (index >= 0) {
      const sentAt = log.createdAt;
      const nextFollowUp = new Date(sentAt);
      nextFollowUp.setDate(nextFollowUp.getDate() + 14);
      customers[index].lastContactDate = log.logDate;
      customers[index].lastSentAt = sentAt;
      customers[index].lastEmailSubject = subject;
      customers[index].sentEmailCount = Number(customers[index].sentEmailCount || 0) + 1;
      customers[index].lastFollowUpTopic = dom.templatePurpose?.selectedOptions?.[0]?.textContent || customers[index].emailPurpose || "";
      customers[index].nextFollowUpDate = nextFollowUp.toISOString().slice(0, 10);
      customers[index].emailHistory = customers[index].emailHistory || [];
      customers[index].emailHistory.unshift({ subject: log.subject, summary: log.summary, emailAttachments: persistableAttachments(attachments), createdAt: log.createdAt });
      customers[index].emailHistory = customers[index].emailHistory.slice(0, 10);
      DB.setCustomers(customers);
    }
  }

  function textToHtml(text) {
    const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!normalized) return "";
    return normalized
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function addAttachmentFromEditor() {
    const type = dom.attachmentType?.value || "hyperlink";
    const name = normalizeText(dom.attachmentName?.value);
    const url = normalizeText(dom.attachmentUrl?.value);
    if (!name && !url) {
      UI.toast("Please enter an attachment name or link.", "warn");
      return;
    }
    if (url && !/^https?:\/\//i.test(url)) {
      UI.toast("Please use a full URL starting with http:// or https://.", "warn");
      return;
    }
    state.emailAttachments = normalizeAttachments([
      ...state.emailAttachments,
      { type, name: name || url, url }
    ]);
    if (dom.attachmentName) dom.attachmentName.value = "";
    if (dom.attachmentUrl) dom.attachmentUrl.value = "";
    UI.renderAttachmentList();
    UI.toast("Attachment/link added.", "good");
  }

  async function uploadAttachments(files) {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;
    if (selectedFiles.length > MAX_ATTACHMENT_COUNT) {
      const message = `Too many files. Please select up to ${MAX_ATTACHMENT_COUNT} files at once.`;
      if (dom.attachmentUploadStatus) {
        dom.attachmentUploadStatus.textContent = message;
        dom.attachmentUploadStatus.className = "attachment-upload-status bad";
      }
      if (dom.attachmentFileInput) dom.attachmentFileInput.value = "";
      UI.toast(message, "bad");
      return;
    }
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("attachments", file));
    if (dom.attachmentUploadStatus) {
      dom.attachmentUploadStatus.textContent = `Uploading ${selectedFiles.length} file(s)...`;
      dom.attachmentUploadStatus.className = "attachment-upload-status warn";
    }

    const originalText = dom.uploadAttachmentBtn?.textContent || "";
    if (dom.uploadAttachmentBtn) {
      dom.uploadAttachmentBtn.disabled = true;
      dom.uploadAttachmentBtn.textContent = "Uploading...";
    }

    try {
      const response = await fetch(`${API_BASE}/api/upload-attachments`, {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        const names = selectedFiles.map((file) => file.name).filter(Boolean).join(", ");
        throw new Error(`${payload.error || "Attachment upload failed."}${names ? ` Files: ${names}` : ""}`);
      }
      state.emailAttachments = normalizeAttachments([
        ...state.emailAttachments,
        ...(payload.files || []).map((file) => ({ ...file, isUploadedFile: true }))
      ]);
      UI.renderAttachmentList();
      previewTemplate();
      if (dom.attachmentUploadStatus) {
        dom.attachmentUploadStatus.textContent = `Uploaded ${payload.files?.length || 0} file(s).`;
        dom.attachmentUploadStatus.className = "attachment-upload-status good";
      }
      UI.toast(`Uploaded ${payload.files?.length || 0} attachment(s).`, "good");
    } catch (error) {
      if (dom.attachmentUploadStatus) {
        dom.attachmentUploadStatus.textContent = `Upload failed: ${error.message}`;
        dom.attachmentUploadStatus.className = "attachment-upload-status bad";
      }
      throw error;
    } finally {
      if (dom.uploadAttachmentBtn) {
        dom.uploadAttachmentBtn.disabled = false;
        dom.uploadAttachmentBtn.textContent = originalText;
      }
      if (dom.attachmentFileInput) dom.attachmentFileInput.value = "";
    }
  }

  async function sendCurrentEmail() {
    const customer = DB.getCustomers().find((item) => item.id === state.currentCustomerId) || formCustomer();
    const to = normalizeText(dom.emailTo?.value || customer.contactEmail || dom.contactEmail.value);
    const cc = normalizeText(dom.emailCc?.value || "");
    const bcc = normalizeText(dom.emailBcc?.value || "");
    const senderId = normalizeText(dom.senderSelect?.value);
    const attachments = normalizeAttachments(state.emailAttachments);
    const analysis = state.currentAnalysis || {
      recommendedProducts: customer.recommendedProducts || [],
      businessSignals: customer.businessSignals || [],
      rating: customer.rating || "NR",
      totalScore: customer.totalScore || 0
    };
    const emailAnalysis = {
      ...analysis,
      emailStrategy: EmailEngine.strategy(customer, analysis),
      emailRecommendedProducts: EmailEngine.recommendedProductsForEmail(customer, analysis)
    };
    const rendered = EmailEngine.renderTemplate(
      {
        subject: dom.templateSubject.value || state.currentAnalysis?.emailDraft?.subject || "",
        body: dom.templateBody.value || state.currentAnalysis?.emailDraft?.body || ""
      },
      EmailEngine.variables(customer, emailAnalysis)
    );
    const subject = normalizeText(rendered.subject);
    const body = String(rendered.body || "").trim();

    if (!senderId) throw new Error("Please select sender.");
    if (!to) throw new Error("Missing customer email.");
    if (!subject || !body) throw new Error("Missing email subject or body.");
    if (hasUnresolvedTemplateVariables(`${subject}\n${body}`)) {
      throw new Error("Email still contains unresolved {{variables}}. Please preview or fill customer data before sending.");
    }

    const sendButtons = [dom.sendEmailTopBtn].filter(Boolean);
    const originalTexts = new Map(sendButtons.map((button) => [button, button.textContent]));
    sendButtons.forEach((button) => {
      button.disabled = true;
      button.textContent = "發送中...";
    });

    try {
      const response = await fetch(`${API_BASE}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          cc,
          bcc,
          subject,
          senderId,
          html: textToHtml(renderEmailBody(body, attachments)),
          attachments: uploadedMailAttachments(attachments)
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Send email failed.");

      addEmailSentLog(customer, subject, payload.messageId || "", attachments);
      state.emailAttachments = persistableAttachments(state.emailAttachments);
      UI.renderAttachmentList();
      previewTemplate();
      UI.renderTimeline(customer.id);
      UI.refreshAll();
      UI.toast("✅ 郵件已成功發送！", "good");
    } finally {
      sendButtons.forEach((button) => {
        button.textContent = originalTexts.get(button) || "發送郵件";
        button.disabled = false;
      });
    }
  }

  async function bulkAnalyze(customers) {
    if (!canManageCustomers()) {
      UI.toast("Bulk customer analysis is not allowed for this role.", "warn");
      return;
    }
    DB.backup("before_bulk_analyze");
    const list = customers.filter((customer) => !customer.isManuallyReviewed);
    if (!list.length) {
      UI.toast("No customers to analyze. Manually reviewed customers are skipped.", "warn");
      return;
    }
    let done = 0;
    let success = 0;
    let failed = 0;
    const all = DB.getCustomers();
    for (const customer of list) {
      dom.bulkProgressText.textContent = `Analyzing ${done + 1}/${list.length}: ${customer.companyName}`;
      dom.bulkProgressBar.style.width = `${Math.round((done / list.length) * 100)}%`;
      try {
        const analyzed = await runAnalysis({ autoFetch: true, save: false, customerOverride: customer });
        const index = all.findIndex((item) => item.id === customer.id);
        if (index >= 0 && analyzed) all[index] = analyzed;
        if (analyzed) success += 1;
      } catch (error) {
        console.error(error);
        DB.addErrorLog("批量分析", error, customer);
        failed += 1;
      }
      done += 1;
      dom.bulkProgressBar.style.width = `${Math.round((done / list.length) * 100)}%`;
    }
    DB.setCustomers(all);
    UI.refreshAll();
    dom.bulkProgressText.textContent = `Completed ${done}/${list.length}. Success: ${success}. Failed: ${failed}.`;
    UI.toast(`Bulk analysis completed. Success: ${success}. Failed: ${failed}.`, failed ? "warn" : "good");
  }

  function selectedCustomers() {
    return DB.getCustomers().filter((item) => state.selectedCustomerIds.has(item.id));
  }

  function batchTemplateOptions() {
    const defaults = Object.entries(DB.getTemplates() || {}).map(([id, template]) => ({
      value: `default:${id}`,
      label: `預設 / ${template?.name || id}`
    }));
    const customs = state.customTemplates.map((template) => ({ value: `custom:${template.id}`, label: `自訂 / ${template.name}` }));
    return [...defaults, ...customs];
  }

  function openBatchEmailDialog() {
    const customers = selectedCustomers();
    if (!customers.length) {
      UI.toast("請先勾選至少一位客戶。", "warn");
      return;
    }
    if (!dom.batchEmailDialog?.showModal) {
      UI.toast("此瀏覽器不支援批次草稿對話框。", "bad");
      return;
    }
    dom.batchEmailSelectedCount.textContent = `已選取 ${customers.length} 位客戶`;
    dom.batchEmailTemplate.innerHTML = batchTemplateOptions().map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("");
    dom.batchEmailSender.innerHTML = state.senders.filter((sender) => sender.isActive && sender.canUse !== false)
      .map((sender) => `<option value="${escapeHtml(sender.id)}">${escapeHtml(sender.name || sender.email)} - ${escapeHtml(sender.email)}</option>`).join("");
    dom.batchEmailProducts.innerHTML = DB.getProducts().filter((product) => product.inRecommendationPool !== false)
      .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml([product.sku, product.name || product.productName].filter(Boolean).join(" - "))}</option>`).join("");
    dom.batchEmailProgress.textContent = "";
    dom.batchEmailDialog.showModal();
  }

  async function generateBatchEmailDrafts() {
    const customers = selectedCustomers();
    if (!customers.length) throw new Error("請先勾選至少一位客戶。");
    const templateId = dom.batchEmailTemplate.value;
    const senderId = dom.batchEmailSender.value;
    if (!templateId || !senderId) throw new Error("請選擇郵件範本和寄件者。");
    const productIds = [...dom.batchEmailProducts.selectedOptions].map((option) => option.value).filter(Boolean);
    dom.confirmBatchEmailBtn.disabled = true;
    dom.batchEmailProgress.textContent = `正在產生：0 / ${customers.length}`;
    try {
      const response = await fetch(`${API_BASE}/api/batch-generate-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: customers.map((customer) => customer.id), templateId, senderId, productIds })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "批次郵件草稿產生失敗。");
      await DB.initSharedStore();
      const failed = payload.summary?.failed || 0;
      dom.batchEmailProgress.textContent = `完成：成功 ${payload.summary?.success || 0} 封；失敗 ${failed} 封${failed ? "（缺少有效收件人或客戶不可用）" : ""}`;
      UI.refreshAll();
      UI.toast(`已產生 ${payload.summary?.success || 0} 封郵件草稿。`, failed ? "warn" : "good");
      if (!failed) setTimeout(() => dom.batchEmailDialog.close(), 700);
    } finally {
      dom.confirmBatchEmailBtn.disabled = false;
    }
  }

  function openEmailDraft(logId) {
    const log = DB.getLogs()[logId];
    const customer = DB.getCustomers().find((item) => item.id === log?.customerId);
    if (!log?.isDraft || !customer) {
      UI.toast("找不到此郵件草稿。", "warn");
      return;
    }
    fillAnalysisForm(customer);
    state.currentCustomerId = customer.id;
    dom.templateSubject.value = log.subject || "";
    dom.templateBody.value = log.body || "";
    dom.emailTo.value = log.to || customer.contactEmail || "";
    if (log.senderId) dom.senderSelect.value = log.senderId;
    UI.showPage("analysisPage");
    UI.renderTimeline(customer.id);
    UI.toast("草稿已載入，可檢查、修改後發送。", "good");
  }

  function bulkDeleteSelected() {
    if (!canBatchManageCustomers()) {
      UI.toast("Batch customer deletion is not allowed for this role.", "warn");
      return;
    }
    const selected = selectedCustomers();
    if (!selected.length) {
      UI.toast("Please select customers first.", "warn");
      return;
    }
    if (!confirm(`Delete ${selected.length} selected customers?`)) return;
    DB.backup("before_bulk_delete");
    const ids = new Set(selected.map((item) => item.id));
    DB.setCustomers(DB.getCustomers().filter((item) => !ids.has(item.id)));
    state.selectedCustomerIds.clear();
    UI.refreshAll();
    UI.toast(`Deleted ${selected.length} customers.`, "good");
  }

  function bulkConvertSelected() {
    if (!state.isHostAdmin) {
      UI.toast("Batch customer conversion is admin-only.", "warn");
      return;
    }
    const selected = selectedCustomers();
    if (!selected.length) {
      UI.toast("Please select customers first.", "warn");
      return;
    }
    DB.backup("before_bulk_convert_existing");
    const ids = new Set(selected.map((item) => item.id));
    DB.setCustomers(DB.getCustomers().map((item) => ids.has(item.id) ? { ...item, customerType: "existing" } : item));
    UI.refreshAll();
    UI.toast(`Converted ${selected.length} customers to Existing.`, "good");
  }

  function bulkUpdateFollowUpSelected() {
    const selected = selectedCustomers();
    if (!selected.length) return;
    const status = dom.bulkFollowStatus.value;
    const date = dom.bulkNextFollowDate.value;
    if (!status && !date) return;
    DB.backup("before_bulk_followup_update");
    const ids = new Set(selected.map((item) => item.id));
    DB.setCustomers(DB.getCustomers().map((item) => {
      if (!ids.has(item.id)) return item;
      return {
        ...item,
        followUpStatus: status || item.followUpStatus,
        nextFollowUpDate: date || item.nextFollowUpDate
      };
    }));
    UI.refreshAll();
    UI.toast(`Updated follow-up fields for ${selected.length} customers.`, "good");
  }

  function bulkMoveSelectedToGroup() {
    if (!canBatchManageCustomers()) {
      UI.toast("Batch customer group changes are not allowed for this role.", "warn");
      return;
    }
    const selected = selectedCustomers();
    if (!selected.length) {
      UI.toast("Please select customers first.", "warn");
      return;
    }
    const groupId = normalizeGroupId(dom.bulkGroupSelect?.value);
    if (!confirm(`Move ${selected.length} selected customers to ${groupName(groupId)}?`)) return;
    GroupApi.batchMove(selected.map((item) => item.id), groupId).catch((error) => {
      DB.addErrorLog("批量移動組別", error);
      UI.refreshAll();
      UI.toast(error.message, "bad");
    });
  }

  function purgeDeprecatedProductStatus() {
    const rawProducts = DB.read(STORAGE.products, []);
    const deprecatedKeys = ["status", "Status", "productStatus"];
    if (!rawProducts.some((product) => deprecatedKeys.some((key) => Object.prototype.hasOwnProperty.call(product || {}, key)))) return;
    DB.setProducts(rawProducts.map((product) => DB.normalizeProduct(product)));
  }

  function openSaveTemplateDialog() {
    if (!String(dom.templateSubject.value || "").trim() || !String(dom.templateBody.value || "").trim()) {
      UI.toast("Subject and Body are required before saving a template.", "warn");
      return;
    }
    const selected = state.selectedTemplateKind === "custom"
      ? state.customTemplates.find((item) => item.id === state.selectedCustomTemplateId)
      : null;
    dom.customTemplateName.value = selected?.name || "";
    dom.customTemplateDialog.showModal();
    setTimeout(() => dom.customTemplateName.focus(), 0);
  }

  async function saveCustomTemplateFromDialog() {
    await CustomTemplateApi.save(dom.customTemplateName.value, { preserveCurrentEditor: true });
    dom.customTemplateDialog.close();
  }

  function openBlankTemplateDialog() {
    dom.blankTemplateName.value = "";
    dom.blankTemplateSubject.value = "";
    dom.blankTemplateBody.value = "";
    dom.blankTemplateDialog.showModal();
    setTimeout(() => dom.blankTemplateName.focus(), 0);
  }

  async function saveBlankTemplateFromDialog() {
    await CustomTemplateApi.save(dom.blankTemplateName.value, {
      subject: dom.blankTemplateSubject.value,
      body: dom.blankTemplateBody.value
    });
    dom.blankTemplateDialog.close();
  }

  async function deleteSelectedCustomTemplate() {
    if (state.selectedTemplateKind !== "custom" || !state.selectedCustomTemplateId) {
      UI.toast("Please select a custom template first.", "warn");
      return;
    }
    const template = state.customTemplates.find((item) => item.id === state.selectedCustomTemplateId);
    if (!template) {
      UI.toast("Custom template not found.", "warn");
      return;
    }
    if (!confirm(`Delete custom template "${template.name}"?`)) return;
    await CustomTemplateApi.remove(template.id);
  }

  function previewTemplate() {
    const customer = formCustomer();
    const analysis = state.currentAnalysis || { recommendedProducts: [], businessSignals: [], rating: "NR", totalScore: 0 };
    const emailAnalysis = {
      ...analysis,
      emailStrategy: EmailEngine.strategy(customer, analysis),
      emailRecommendedProducts: EmailEngine.recommendedProductsForEmail(customer, analysis)
    };
    const rendered = EmailEngine.renderTemplate(
      { subject: dom.templateSubject.value, body: dom.templateBody.value },
      EmailEngine.variables(customer, emailAnalysis)
    );
    const attachments = normalizeAttachments(state.emailAttachments);
    if (state.currentAnalysis) {
      state.currentAnalysis.emailDraft = { ...rendered, emailAttachments: attachments };
      state.currentAnalysis.emailRecommendedProducts = emailAnalysis.emailRecommendedProducts;
      state.currentAnalysis.emailStrategy = emailAnalysis.emailStrategy;
    }
    UI.toast("Template preview rendered.", "good");
  }

  function renderTemplatePreviewPane() {
    if (!dom.templatePreviewPane) return;
    const customer = formCustomer();
    const analysis = state.currentAnalysis || { recommendedProducts: [], businessSignals: [], rating: "NR", totalScore: 0 };
    const emailAnalysis = {
      ...analysis,
      emailStrategy: EmailEngine.strategy(customer, analysis),
      emailRecommendedProducts: EmailEngine.recommendedProductsForEmail(customer, analysis)
    };
    const rendered = EmailEngine.renderTemplate(
      { subject: dom.templateSubject.value, body: dom.templateBody.value },
      EmailEngine.variables(customer, emailAnalysis)
    );
    const attachments = normalizeAttachments(state.emailAttachments);
    dom.templatePreviewPane.innerHTML = escapeHtml(renderEmailText(rendered.subject, rendered.body, attachments))
      .replace(/(\{\{[^}]+\}\})/g, `<span class="variable-inline">$1</span>`);
  }

  function setEmailEditorMode(mode) {
    const previewMode = mode === "preview";
    if (previewMode) renderTemplatePreviewPane();
    dom.templatePreviewPane?.classList.toggle("hidden", !previewMode);
    dom.templateBody?.classList.toggle("hidden", previewMode);
    document.querySelector(".rich-toolbar")?.classList.toggle("hidden", previewMode);
    dom.emailPreviewModeBtn?.classList.toggle("active", previewMode);
    dom.emailEditModeBtn?.classList.toggle("active", !previewMode);
  }

  function insertIntoTemplateBody(text) {
    const textarea = dom.templateBody;
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
  }

  function exportBackup() {
    if (!isLocalEnvironment()) {
      UI.toast("JSON backup is local-only. Please use it on 127.0.0.1.", "bad");
      return;
    }
    const snapshot = DB.backup("manual_export");
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    downloadBlob(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }), `phottix_backup_${stamp}.json`);
    UI.toast("Backup JSON exported.", "good");
  }

  async function importBackup(file) {
    if (!isLocalEnvironment()) {
      UI.toast("JSON restore is local-only. Please use it on 127.0.0.1.", "bad");
      return;
    }
    const text = await file.text();
    const snapshot = JSON.parse(text);
    const summary = [
      `Customers: ${snapshot.phottix_customers?.length || 0}`,
      `Products: ${snapshot.phottix_products?.length || 0}`,
      `Logs: ${Object.keys(snapshot.phottix_followup_logs || {}).length}`,
      `Analysis history: ${Object.keys(snapshot.phottix_analysis_history || {}).length}`,
      `Error logs: ${(snapshot.phottix_error_logs || []).length}`
    ].join("\n");
    if (!confirm(`Restore this backup and overwrite current local data?\n\n${summary}`)) return;
    DB.backup("before_restore");
    DB.restore(snapshot);
    UI.refreshAll();
    UI.toast("Backup restored.", "good");
  }

  async function syncLiveSnapshot() {
    if (!isLocalEnvironment()) {
      UI.toast("Live sync is local-only. Please use it on 127.0.0.1.", "bad");
      return;
    }
    const originalText = dom.pullLiveSnapshotBtn?.textContent || "從線上同步";
    if (dom.pullLiveSnapshotBtn) {
      dom.pullLiveSnapshotBtn.disabled = true;
      dom.pullLiveSnapshotBtn.textContent = "同步中... / Syncing...";
    }
    try {
      const confirmed = confirm(
        "這會把 agent.phottix.cn 的共享資料同步到本機工作版。\n\n" +
        "會先備份目前本機資料，然後用線上 snapshot 覆蓋本機共享資料。\n" +
        "這不會影響線上站點本身。\n\n" +
        "要繼續嗎？"
      );
      if (!confirmed) return;
      DB.backup("before_live_sync");
      const response = await fetch(`${API_BASE}/api/sync-live-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: LIVE_SYNC_SOURCE })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Live sync failed.");
      await DB.initSharedStore();
      UI.refreshAll();
      UI.toast(
        `Synced from live site. Customers: ${payload.counts?.customers || 0}, Products: ${payload.counts?.products || 0}.`,
        "good"
      );
    } finally {
      if (dom.pullLiveSnapshotBtn) {
        dom.pullLiveSnapshotBtn.disabled = false;
        dom.pullLiveSnapshotBtn.textContent = originalText;
      }
    }
  }

  function getLiveSyncCheckboxMap() {
    return {
      customers: dom.syncCustomersSection,
      products: dom.syncProductsSection,
      logs: dom.syncLogsSection,
      templates: dom.syncTemplatesSection,
      settings: dom.syncSettingsSection,
      analysisHistory: dom.syncAnalysisHistorySection,
      errorLogs: dom.syncErrorLogsSection
    };
  }

  function getLocalSyncSummary() {
    return {
      customers: DB.getCustomers().length,
      products: DB.getProducts().length,
      logs: Object.keys(DB.getLogs() || {}).length,
      templates: Object.keys(DB.getTemplates() || {}).length,
      settings: DB.getSettings() ? 1 : 0,
      analysisHistory: Object.keys(DB.getAnalysisHistory() || {}).length,
      errorLogs: DB.getErrorLogs().length
    };
  }

  function formatSyncSummary(counts = {}) {
    return LIVE_SYNC_SECTION_DEFS
      .map((section) => `${section.short}: ${Number(counts[section.key] || 0)}`)
      .join("\n");
  }

  function formatSelectedSyncSummary(counts = {}, sections = []) {
    return sections
      .map((key) => `${LIVE_SYNC_SECTION_LABELS[key] || key}: ${Number(counts[key] || 0)}`)
      .join(" / ");
  }

  function getSelectedLiveSyncSections() {
    const checkboxes = getLiveSyncCheckboxMap();
    const selected = LIVE_SYNC_SECTION_DEFS
      .filter((section) => dom.syncAllSections?.checked || checkboxes[section.key]?.checked)
      .map((section) => section.key);
    return selected.length ? selected : LIVE_SYNC_SECTION_DEFS.filter((section) => section.defaultChecked).map((section) => section.key);
  }

  function updateLiveSyncScopeSummary() {
    if (!dom.liveSyncScopeSummary) return;
    const selected = getSelectedLiveSyncSections();
    dom.liveSyncScopeSummary.textContent = dom.syncAllSections?.checked
      ? "目前將同步：全部共享資料"
      : `目前將同步：${selected.map((key) => LIVE_SYNC_SECTION_LABELS[key] || key).join("、")}`;
  }

  function renderLiveSyncLocalSummary() {
    if (!dom.liveSyncLocalSummary) return;
    dom.liveSyncLocalSummary.textContent = formatSyncSummary(getLocalSyncSummary());
  }

  function renderLiveSyncPreview(counts = {}, sourceUrl = "") {
    if (!dom.liveSyncLiveSummary) return;
    const summary = formatSyncSummary(counts);
    dom.liveSyncLiveSummary.textContent = sourceUrl ? `${summary}\nSource: ${sourceUrl}` : summary;
  }

  function resetLiveSyncSelection() {
    const checkboxes = getLiveSyncCheckboxMap();
    if (dom.syncAllSections) dom.syncAllSections.checked = false;
    LIVE_SYNC_SECTION_DEFS.forEach((section) => {
      const checkbox = checkboxes[section.key];
      if (checkbox) checkbox.checked = section.defaultChecked;
    });
    updateLiveSyncScopeSummary();
  }

  function handleLiveSyncSelectionChange() {
    const checkboxes = getLiveSyncCheckboxMap();
    if (dom.syncAllSections?.checked) {
      LIVE_SYNC_SECTION_DEFS.forEach((section) => {
        if (checkboxes[section.key]) checkboxes[section.key].checked = true;
      });
    } else {
      const anyChecked = LIVE_SYNC_SECTION_DEFS.some((section) => checkboxes[section.key]?.checked);
      if (!anyChecked) {
        LIVE_SYNC_SECTION_DEFS.forEach((section) => {
          if (checkboxes[section.key]) checkboxes[section.key].checked = section.defaultChecked;
        });
      }
    }
    const allChecked = LIVE_SYNC_SECTION_DEFS.every((section) => Boolean(checkboxes[section.key]?.checked));
    if (dom.syncAllSections) dom.syncAllSections.checked = allChecked;
    updateLiveSyncScopeSummary();
  }

  function openLiveSyncDialog() {
    if (!isLocalEnvironment()) {
      UI.toast("Live sync is local-only. Please use it on 127.0.0.1.", "bad");
      return;
    }
    if (!dom.liveSyncDialog) return;
    resetLiveSyncSelection();
    renderLiveSyncLocalSummary();
    renderLiveSyncPreview({}, "");
    dom.liveSyncDialog.showModal();
  }

  async function previewLiveSync() {
    const originalText = dom.previewLiveSyncBtn?.textContent || "預覽線上摘要";
    if (dom.previewLiveSyncBtn) {
      dom.previewLiveSyncBtn.disabled = true;
      dom.previewLiveSyncBtn.textContent = "預覽中...";
    }
    try {
      const response = await fetch(`${API_BASE}/api/sync-live-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: LIVE_SYNC_SOURCE,
          sections: getSelectedLiveSyncSections(),
          previewOnly: true
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Live preview failed.");
      renderLiveSyncPreview(payload.previewCounts || {}, payload.sourceUrl || LIVE_SYNC_SOURCE);
      UI.toast("Live preview loaded.", "good");
    } finally {
      if (dom.previewLiveSyncBtn) {
        dom.previewLiveSyncBtn.disabled = false;
        dom.previewLiveSyncBtn.textContent = originalText;
      }
    }
  }

  async function runLiveSync() {
    const sections = getSelectedLiveSyncSections();
    const sectionLabels = sections.map((key) => LIVE_SYNC_SECTION_LABELS[key] || key);
    const originalText = dom.syncLiveSnapshotBtn?.textContent || "開始同步";
    if (dom.syncLiveSnapshotBtn) {
      dom.syncLiveSnapshotBtn.disabled = true;
      dom.syncLiveSnapshotBtn.textContent = "同步中...";
    }
    try {
      DB.backup("before_live_sync");
      const response = await fetch(`${API_BASE}/api/sync-live-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: LIVE_SYNC_SOURCE,
          sections
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Live sync failed.");
      await DB.initSharedStore();
      UI.refreshAll();
      renderLiveSyncLocalSummary();
      if (payload.previewCounts) renderLiveSyncPreview(payload.previewCounts, payload.sourceUrl || LIVE_SYNC_SOURCE);
      const beforeText = formatSelectedSyncSummary(payload.beforeCounts || {}, sections);
      const afterText = formatSelectedSyncSummary(payload.afterCounts || {}, sections);
      UI.toast(`Synced: ${sectionLabels.join("、")}. ${beforeText} -> ${afterText}`, "good");
      if (dom.liveSyncDialog?.open) dom.liveSyncDialog.close();
    } finally {
      if (dom.syncLiveSnapshotBtn) {
        dom.syncLiveSnapshotBtn.disabled = false;
        dom.syncLiveSnapshotBtn.textContent = originalText;
      }
    }
  }

    function renderExcelFileOptions(files = [], target = "customer") {
      const emptyLabel = target === "customer"
        ? "No customer list Excel files found. Rename the file with Customer/Client/Contact, then refresh."
        : "No product Excel files found.";
      const options = files.length
        ? files.map((file, index) => `<option value="${escapeHtml(file)}">${index + 1}. ${escapeHtml(file)}</option>`).join("")
        : `<option value="">${escapeHtml(emptyLabel)}</option>`;
      const listHtml = files.length
        ? files.map((file, index) => `<button class="excel-file-item" type="button" data-file-index="${index + 1}">${index + 1}. ${escapeHtml(file)}</button>`).join("")
        : `<div class="empty">${escapeHtml(emptyLabel)}</div>`;
      return { options, listHtml };
    }

    async function refreshImportFiles(options = {}) {
      const payload = await ExcelHandler.listImportFiles();
      const files = payload.files || [];
      const customerFiles = files.filter((file) => ExcelHandler.isCustomerFile(file));
      const customerRendered = renderExcelFileOptions(customerFiles, "customer");

      if (dom.customerImportFileSelect) dom.customerImportFileSelect.innerHTML = customerRendered.options;
      if (dom.excelFileList) dom.excelFileList.innerHTML = customerRendered.listHtml;
      if (customerFiles.length && dom.customerImportIndex) dom.customerImportIndex.value = "1";
      if (!options.silent) {
        UI.toast(`Customer Excel files: ${customerFiles.length}`, customerFiles.length ? "good" : "warn");
      }
  }

  async function refreshSenders() {
    await SenderApi.list();
    UI.renderSenderSelector();
    UI.renderSenderList();
  }

  async function syncInboxReplies() {
    const originalText = dom.syncInboxBtn?.textContent || "📥 同步回信";
    if (dom.syncInboxBtn) {
      dom.syncInboxBtn.disabled = true;
      dom.syncInboxBtn.textContent = "同步中...";
    }
    try {
      const response = await fetch(`${API_BASE}/api/sync-inbox`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Inbox sync failed.");
      await DB.initSharedStore();
      UI.refreshAll();
      if (payload.newReplies > 0) {
        UI.toast(`成功同步 ${payload.newReplies} 封新回信，${payload.markedCustomers} 位客戶已標記為高潛力`, "good");
      } else {
        UI.toast("目前沒有新的客戶回信", "warn");
      }
      if (payload.failed) {
        DB.addErrorLog("同步回信", new Error(`Some inbox messages failed: ${payload.failed}`), payload);
        UI.renderErrorLogs();
      }
    } finally {
      if (dom.syncInboxBtn) {
        dom.syncInboxBtn.textContent = originalText;
        dom.syncInboxBtn.disabled = false;
      }
    }
  }

  function clearSenderForm() {
    if (!dom.senderId) return;
    dom.senderId.value = "";
    dom.senderName.value = "";
    dom.senderEmail.value = "";
    dom.senderAppPassword.value = "";
    dom.senderAppPassword.placeholder = "16 位 Gmail App Password";
    if (dom.saveSenderBtn) dom.saveSenderBtn.textContent = "新增寄件者 / Save Sender";
  }

  function editSender(id) {
    const sender = state.senders.find((item) => item.id === id);
    if (!sender) return;
    dom.senderId.value = sender.id;
    dom.senderName.value = sender.name || "";
    dom.senderEmail.value = sender.email || "";
    dom.senderAppPassword.value = "";
    dom.senderAppPassword.placeholder = "留空則不更新密碼";
    if (dom.saveSenderBtn) dom.saveSenderBtn.textContent = "新增寄件者 / Save Sender";
    UI.showPage("sendersPage");
  }

  function clearUserForm() {
    if (!dom.managedUserId) return;
    dom.managedUserId.value = "";
    dom.managedUsername.value = "";
    dom.managedUsername.disabled = false;
    dom.managedPassword.value = "";
    dom.managedPassword.placeholder = "Required for new users";
    dom.managedDisplayName.value = "";
    dom.managedEmail.value = "";
    dom.managedRole.value = "sales";
    dom.managedPosition.value = state.userRole === "marketing_manager" ? "小红书管理员" : "";
    dom.managedSenderEmails.value = "";
    dom.managedIsActive.checked = true;
    if (dom.saveUserBtn) dom.saveUserBtn.textContent = "Save User";
  }

  function editUser(id) {
    const user = state.users.find((item) => item.id === id);
    if (!user || user.source === "env") {
      UI.toast("This login is managed by .env and cannot be edited here.", "warn");
      return;
    }
    dom.managedUserId.value = user.id;
    dom.managedUsername.value = user.username || "";
    dom.managedUsername.disabled = true;
    dom.managedPassword.value = "";
    dom.managedPassword.placeholder = "Leave blank to keep current password";
    dom.managedDisplayName.value = user.displayName || "";
    dom.managedEmail.value = user.email || "";
    dom.managedRole.value = user.role || "sales";
    dom.managedPosition.value = user.position || "";
    dom.managedSenderEmails.value = Array.isArray(user.senderEmails) ? user.senderEmails.join(", ") : "";
    dom.managedIsActive.checked = user.isActive !== false;
    if (dom.saveUserBtn) dom.saveUserBtn.textContent = "Update User";
    UI.showPage("usersPage");
  }

  function applyThemePreference() {
    const preferredTheme = localStorage.getItem("theme") === "light" ? "light" : "dark";
    document.body.classList.toggle("light-mode", preferredTheme === "light");
    if (dom.themeToggle) {
      dom.themeToggle.textContent = preferredTheme === "light" ? "🌙" : "☀️";
      dom.themeToggle.setAttribute("aria-pressed", preferredTheme === "light" ? "true" : "false");
    }
  }

  function toggleThemePreference() {
    const nextTheme = document.body.classList.contains("light-mode") ? "dark" : "light";
    localStorage.setItem("theme", nextTheme);
    applyThemePreference();
  }

  function bindDom() {
    [
      "todayFollowCount", "todayFollowList", "toast", "pageTitle", "pageSubtitle", "environmentBanner",
      "overdueFollowCount", "dueTodayFollowCount", "statsSummary", "errorLogList", "clearErrorLogsBtn",
      "loadCustomerSelect", "companyName", "website", "contactName", "contactEmail", "country", "city", "industry",
      "buyingRole", "buyingRoleManualStatus", "instagram", "facebook", "emailPurpose", "businessNotes", "manualWebsiteSummary", "mainProducts", "websiteExtract",
      "fetchWebsiteBtn", "runAnalysisBtn", "saveCustomerBtn", "clearAnalysisBtn", "staleBanner",
      "templatePurpose", "newBlankTemplateBtn", "templateSubject", "emailTo", "emailCc", "emailBcc", "quickEmailContactsBtn", "manageEmailContactsBtn", "emailContactQuickPanel", "templateBody", "templatePreviewPane", "emailEditModeBtn", "emailPreviewModeBtn",
      "senderAvatar", "senderSelect", "senderStatus", "attachmentType", "attachmentName", "attachmentUrl",
      "addAttachmentBtn", "uploadAttachmentBtn", "attachmentFileInput", "attachmentUploadStatus", "attachmentList", "previewTemplateBtn", "saveTemplateBtn", "saveTemplateTopBtn", "deleteTemplateBtn", "deleteTemplateTopBtn", "sendEmailTopBtn",
      "analysisPlaceholder", "runAnalysisSideBtn", "analysisResult", "manualOverrideBtn", "companyInfoTable", "ratingHero", "fourScores", "signalTags",
      "scoringBreakdown", "recommendedProducts", "actionSuggestions",
      "emailStrategyNote",
      "addLogBtn", "timeline", "analysisHistory", "addProductBtn", "importProductsBtn", "productExcelFileInput", "productSearch",
      "productView", "productTable", "addCustomerBtn", "importCustomersBtn", "syncInboxBtn", "importUpdateBtn",
      "exportCustomersBtn", "exportCurrentGroupBtn", "exportFilteredCustomersBtn", "customerImportFileSelect", "customerImportIndex", "importCustomersConfigBtn", "uploadCustomerExcelBtn", "customerExcelFileInput", "customerImportGroupSelect", "customerImportResult", "excelFileList", "addGroupBtn", "groupList", "customerTypeFilter", "ratingFilter",
      "followStatusFilter", "buyingRoleFilter", "groupFilter", "customerSearch", "sentEmailFilter", "repliedFilter", "followUpTopicFilter", "lastFollowUpRangeFilter", "nextFollowUpRangeFilter", "repliedCustomersNav", "dueFollowUpsNav", "selectAllCustomers", "batchGenerateEmailBtn", "bulkAnalyzeSelectedBtn",
      "bulkAnalyzeAllBtn", "bulkDeleteBtn", "bulkConvertBtn", "bulkGroupSelect", "bulkMoveGroupBtn", "bulkFollowStatus", "bulkNextFollowDate", "bulkProgressBar", "bulkProgressText", "customerList", "backupExportBtn",
      "backupImportBtn", "pullLiveSnapshotBtn", "backupFileInput", "liveSyncDialog", "liveSyncForm", "liveSyncLocalSummary", "liveSyncLiveSummary", "liveSyncScopeSummary", "syncAllSections", "syncCustomersSection", "syncProductsSection", "syncLogsSection", "syncTemplatesSection", "syncSettingsSection", "syncAnalysisHistorySection", "syncErrorLogsSection", "previewLiveSyncBtn", "syncLiveSnapshotBtn", "productDialog", "productForm", "productDialogTitle",
      "productId", "productName", "productCategory", "productInPool", "productPriority",
      "productPriorityNumber", "productRecommendedFor", "productPriorityA", "productPriorityB", "productPriorityC", "productPriorityD", "productPriorityAll", "productSku", "productDescription", "productPrice", "productUrl", "productLaunchDate",
      "saveProductDialogBtn", "customerDialog", "customerForm", "customerDialogTitle", "customerId",
      "dialogCompanyName", "dialogWebsite", "dialogContactName", "dialogContactEmail", "dialogCountry", "dialogMainProducts", "dialogGroup", "dialogCustomerScore",
      "dialogBuyingRole", "dialogCustomerType", "dialogFollowStatus", "dialogNextFollowDate", "saveCustomerDialogBtn",
      "overrideDialog", "overrideForm", "overrideRating", "overrideReason", "saveOverrideBtn",
      "logDialog", "logForm", "logCustomerId", "logDate", "logChannel", "logContactPerson", "logSubject",
      "logSummary", "logResponse", "logNextAction", "logNextFollowDate", "saveLogBtn",
      "sendersNavBtn", "usersNavBtn", "systemNavBtn", "themeToggle", "refreshSendersBtn", "senderForm", "senderId", "senderName", "senderEmail",
      "senderAppPassword", "saveSenderBtn", "resetSenderFormBtn", "senderList",
      "refreshUsersBtn", "userForm", "managedUserId", "managedUsername", "managedPassword", "managedDisplayName",
      "managedEmail", "managedPosition", "managedRole", "managedSenderEmails", "managedIsActive", "saveUserBtn", "resetUserFormBtn", "userList",
      "emailContactsDialog", "emailContactsForm", "emailContactsCustomerId", "emailContactsList",
      "emailContactAddress", "emailContactRole", "addEmailContactBtn", "saveEmailContactsBtn",
      "customTemplateDialog", "customTemplateForm", "customTemplateName", "saveCustomTemplateDialogBtn",
      "blankTemplateDialog", "blankTemplateForm", "blankTemplateName", "blankTemplateSubject", "blankTemplateBody", "saveBlankTemplateBtn",
      "batchEmailDialog", "batchEmailForm", "batchEmailSelectedCount", "batchEmailTemplate", "batchEmailSender", "batchEmailProducts", "batchEmailProgress", "confirmBatchEmailBtn",
      "manualSqliteBackupBtn", "refreshSystemLogsBtn", "systemLastBackup", "systemBackupDir", "systemRetentionDays",
      "systemAuditCount", "systemBackupStatus", "backupFileList", "auditLogTableBody",
      "assetsNavBtn", "assetsPage", "refreshAssetsBtn", "assetCategoryFilter", "assetSkuFilter", "assetSearch",
      "assetUploadForm", "assetUploadCategory", "assetUploadSku", "assetFileInput", "uploadAssetBtn", "assetReplaceFileInput",
      "assetUploadStatus", "assetList"
    ].forEach((id) => { dom[id] = $(id); });
  }

  async function uploadAssetsFromForm(event) {
    event.preventDefault();
    if (!canManageAssets()) {
      UI.toast("Only Admin or Product Manager can upload shared files.", "warn");
      return;
    }
    const files = dom.assetFileInput?.files;
    if (!files?.length) {
      UI.toast("Choose at least one file first.", "warn");
      return;
    }
    const button = dom.uploadAssetBtn;
    const originalText = button?.textContent || "Upload";
    try {
      if (button) {
        button.disabled = true;
        button.textContent = "Uploading...";
      }
      if (dom.assetUploadStatus) dom.assetUploadStatus.textContent = `Uploading ${files.length} file(s)...`;
      await AssetApi.upload(files, dom.assetUploadCategory?.value, dom.assetUploadSku?.value);
      dom.assetUploadForm.reset();
      if (dom.assetUploadStatus) dom.assetUploadStatus.textContent = "Upload complete. Local storage test mode.";
      UI.toast("Files uploaded to the local library.", "good");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  function addAssetToEmail(id) {
    const asset = state.assets.find((item) => item.id === id);
    if (!asset) return UI.toast("Asset not found.", "warn");
    if (state.emailAttachments.some((item) => item.assetId === asset.id)) {
      return UI.toast("This file is already attached.", "warn");
    }
    state.emailAttachments = normalizeAttachments([...state.emailAttachments, {
      assetId: asset.id,
      name: asset.originalName,
      originalName: asset.originalName,
      type: asset.fileType,
      mimetype: asset.mimeType,
      size: asset.fileSize,
      category: asset.category,
      version: asset.version,
      storageProvider: asset.storageProvider,
      isUploadedFile: true
    }]);
    UI.renderAttachmentList();
    previewTemplate();
    UI.toast(`${asset.originalName} added to the email.`, "good");
  }

  async function replaceAssetFromInput(event) {
    const file = event.target.files?.[0];
    const id = event.target.dataset.assetId;
    event.target.value = "";
    delete event.target.dataset.assetId;
    if (!file || !id) return;
    if (!canManageAssets()) {
      UI.toast("Only Admin or Product Manager can replace shared files.", "warn");
      return;
    }
    try {
      await AssetApi.replace(id, file);
      UI.toast("New version saved. Older versions remain available for historical emails.", "good");
    } catch (error) {
      UI.toast(error.message, "bad");
    }
  }

  function bindEvents() {
    document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => UI.showPage(button.dataset.page)));
    dom.fetchWebsiteBtn.addEventListener("click", () => fetchWebsite().catch((error) => UI.toast(error.message, "bad")));
    dom.runAnalysisBtn.addEventListener("click", () => runAnalysis().catch((error) => UI.toast(error.message, "bad")));
    dom.runAnalysisSideBtn?.addEventListener("click", () => runAnalysis().catch((error) => UI.toast(error.message, "bad")));
    dom.saveCustomerBtn.addEventListener("click", async () => {
      const analyzed = await runAnalysis({ autoFetch: false }).catch((error) => {
        DB.addErrorLog("保存客戶", error, formCustomer());
        UI.refreshAll();
        UI.toast(error.message, "bad");
        return null;
      });
      if (analyzed) upsertCustomer(analyzed);
    });
    dom.clearAnalysisBtn.addEventListener("click", () => {
      state.currentAnalysis = null;
      state.currentCustomerId = "";
      state.buyingRoleManualDirty = false;
      document.getElementById("analysisForm").reset();
      if (dom.buyingRole) dom.buyingRole.value = "Unknown";
      if (dom.buyingRoleManualStatus) dom.buyingRoleManualStatus.textContent = "Auto detection will update this after analysis.";
      if (dom.emailTo) dom.emailTo.value = "";
      if (dom.emailCc) dom.emailCc.value = "";
      if (dom.emailBcc) dom.emailBcc.value = "";
      closeQuickEmailContactsPanel();
      dom.analysisResult.classList.add("hidden");
      dom.analysisPlaceholder?.classList.remove("hidden");
      UI.toast("Form cleared.", "good");
    });
    dom.loadCustomerSelect.addEventListener("change", () => {
      const customer = DB.getCustomers().find((item) => item.id === dom.loadCustomerSelect.value);
      if (customer) {
        fillAnalysisForm(customer);
        UI.renderTimeline(customer.id);
        UI.toast("Customer loaded.", "good");
      }
    });
    dom.buyingRole?.addEventListener("change", () => {
      state.buyingRoleManualDirty = true;
      if (dom.buyingRoleManualStatus) {
        dom.buyingRoleManualStatus.textContent = "Manual value selected. Save customer to keep it.";
      }
    });
    dom.sendEmailTopBtn?.addEventListener("click", () => sendCurrentEmail().catch((error) => {
      DB.addErrorLog("發送郵件", error, formCustomer());
      UI.refreshAll();
      UI.toast(`❌ 發送失敗：${error.message}`, "bad");
    }));
    dom.senderSelect?.addEventListener("change", () => UI.updateSenderAvatar());
    dom.themeToggle?.addEventListener("click", toggleThemePreference);
    dom.manualOverrideBtn.addEventListener("click", () => {
      if (!state.currentCustomerId && !state.currentAnalysis) return UI.toast("Run analysis first.", "warn");
      dom.overrideReason.value = "";
      dom.overrideRating.value = state.currentAnalysis?.rating || "B";
      dom.overrideDialog.showModal();
    });
    dom.batchGenerateEmailBtn?.addEventListener("click", openBatchEmailDialog);
    dom.confirmBatchEmailBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      generateBatchEmailDrafts().catch((error) => {
        if (dom.batchEmailProgress) dom.batchEmailProgress.textContent = error.message;
        UI.toast(error.message, "bad");
      });
    });
    dom.saveOverrideBtn.addEventListener("click", () => {
      const rating = dom.overrideRating.value;
      const reason = normalizeText(dom.overrideReason.value);
      if (!reason) return;
      const customers = DB.getCustomers();
      const index = customers.findIndex((item) => item.id === state.currentCustomerId);
      if (index >= 0) {
        customers[index].rating = rating;
        customers[index].isManuallyReviewed = true;
        customers[index].manualOverride = { rating, reason, updatedAt: new Date().toISOString() };
        DB.setCustomers(customers);
      }
      if (state.currentAnalysis) {
        state.currentAnalysis.rating = rating;
        dom.ratingHero.innerHTML = `<div class="rating-big"><strong>${escapeHtml(rating)}</strong><span>manual override</span></div>`;
      }
      UI.refreshAll();
      UI.toast("Manual override saved.", "good");
    });
    dom.addLogBtn.addEventListener("click", () => openLogDialog());
    dom.saveLogBtn.addEventListener("click", saveLogFromDialog);
    dom.templatePurpose.addEventListener("change", () => UI.renderTemplateEditor());
    dom.newBlankTemplateBtn?.addEventListener("click", openBlankTemplateDialog);
    dom.saveTemplateBtn.addEventListener("click", openSaveTemplateDialog);
    dom.saveTemplateTopBtn?.addEventListener("click", openSaveTemplateDialog);
    dom.deleteTemplateBtn?.addEventListener("click", () => deleteSelectedCustomTemplate().catch((error) => UI.toast(error.message, "bad")));
    dom.deleteTemplateTopBtn?.addEventListener("click", () => deleteSelectedCustomTemplate().catch((error) => UI.toast(error.message, "bad")));
    dom.saveCustomTemplateDialogBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      saveCustomTemplateFromDialog().catch((error) => UI.toast(error.message, "bad"));
    });
    dom.customTemplateName?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      saveCustomTemplateFromDialog().catch((error) => UI.toast(error.message, "bad"));
    });
    dom.saveBlankTemplateBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      saveBlankTemplateFromDialog().catch((error) => UI.toast(error.message, "bad"));
    });
    dom.previewTemplateBtn.addEventListener("click", previewTemplate);
    dom.emailEditModeBtn?.addEventListener("click", () => setEmailEditorMode("edit"));
    dom.emailPreviewModeBtn?.addEventListener("click", () => setEmailEditorMode("preview"));
    document.querySelectorAll(".rich-toolbar [data-insert]").forEach((button) => {
      button.addEventListener("click", () => insertIntoTemplateBody(button.dataset.insert || ""));
    });
    dom.addAttachmentBtn?.addEventListener("click", addAttachmentFromEditor);
    dom.uploadAttachmentBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      if (dom.attachmentUploadStatus) {
        dom.attachmentUploadStatus.textContent = "Choose PDF, Word, Excel, JPG, PNG, GIF, HEIC, or HEIF files.";
        dom.attachmentUploadStatus.className = "attachment-upload-status";
      }
      dom.attachmentFileInput?.click();
    });
    dom.uploadAttachmentBtn?.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      dom.attachmentFileInput?.click();
    });
    dom.attachmentFileInput?.addEventListener("change", (event) => uploadAttachments(event.target.files).catch((error) => {
      DB.addErrorLog("上傳附件", error, formCustomer());
      UI.refreshAll();
      UI.toast(`Upload failed: ${error.message}`, "bad");
    }));
    dom.quickEmailContactsBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleQuickEmailContactsPanel();
    });
    dom.manageEmailContactsBtn?.addEventListener("click", () => openEmailContactsDialog());
    dom.addEmailContactBtn?.addEventListener("click", addEmailContactFromDialog);
    dom.saveEmailContactsBtn?.addEventListener("click", saveEmailContactsFromDialog);
    dom.emailContactAddress?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addEmailContactFromDialog();
    });
    document.addEventListener("click", (event) => {
      if (dom.emailContactQuickPanel?.classList.contains("hidden")) return;
      if (event.target.closest(".email-copy-fields")) return;
      closeQuickEmailContactsPanel();
    });
    dom.refreshSendersBtn?.addEventListener("click", () => refreshSenders().catch((error) => UI.toast(error.message, "bad")));
    dom.saveSenderBtn?.addEventListener("click", () => SenderApi.save().catch((error) => UI.toast(error.message, "bad")));
    dom.resetSenderFormBtn?.addEventListener("click", clearSenderForm);
    dom.refreshAssetsBtn?.addEventListener("click", () => AssetApi.list().then(() => UI.renderAssetList()).catch((error) => UI.toast(error.message, "bad")));
    [dom.assetCategoryFilter, dom.assetSkuFilter, dom.assetSearch].forEach((input) => input?.addEventListener("input", () => UI.renderAssetList()));
    dom.assetUploadForm?.addEventListener("submit", uploadAssetsFromForm);
    dom.assetReplaceFileInput?.addEventListener("change", replaceAssetFromInput);
    dom.refreshUsersBtn?.addEventListener("click", () => UserApi.list().then(() => UI.renderUserList()).catch((error) => UI.toast(error.message, "bad")));
    dom.saveUserBtn?.addEventListener("click", () => UserApi.save().catch((error) => UI.toast(error.message, "bad")));
    dom.resetUserFormBtn?.addEventListener("click", clearUserForm);
    [dom.attachmentName, dom.attachmentUrl].forEach((input) => input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addAttachmentFromEditor();
    }));
    dom.addProductBtn.addEventListener("click", () => openProductDialog());
    dom.saveProductDialogBtn.addEventListener("click", saveProductFromDialog);
    dom.importProductsBtn.addEventListener("click", () => {
      if (!canManageProducts()) {
        UI.toast("Product import is not allowed for this role.", "warn");
        return;
      }
      dom.productExcelFileInput?.click();
    });
    dom.productExcelFileInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const originalText = dom.importProductsBtn?.textContent || "";
      try {
        if (dom.importProductsBtn) {
          dom.importProductsBtn.disabled = true;
          dom.importProductsBtn.textContent = "導入中... / Importing...";
        }
        await ExcelHandler.importProductsFromUpload(file);
      } catch (error) {
        DB.addErrorLog("上傳導入產品 Excel", error);
        UI.refreshAll();
        UI.toast(error.message, "bad");
      } finally {
        if (dom.importProductsBtn) {
          dom.importProductsBtn.disabled = false;
          dom.importProductsBtn.textContent = originalText || "導入產品 Excel";
        }
        event.target.value = "";
      }
    });
    dom.productSearch.addEventListener("input", () => UI.renderProductList());
    dom.productView.addEventListener("change", () => UI.renderProductList());
    dom.addCustomerBtn.addEventListener("click", () => openCustomerDialog());
    dom.saveCustomerDialogBtn.addEventListener("click", saveCustomerFromDialog);
    dom.addGroupBtn?.addEventListener("click", () => {
      const name = prompt("Group name / 組別名稱");
      if (!name) return;
      GroupApi.create(name).catch((error) => UI.toast(error.message, "bad"));
    });
    dom.importCustomersBtn.addEventListener("click", () => refreshImportFiles().catch((error) => {
      DB.addErrorLog("列出導入文件", error);
      UI.refreshAll();
      UI.toast(error.message, "bad");
    }));
    dom.syncInboxBtn?.addEventListener("click", () => syncInboxReplies().catch((error) => {
      DB.addErrorLog("同步回信", error);
      UI.refreshAll();
      UI.toast(error.message, "bad");
    }));
    dom.customerImportFileSelect?.addEventListener("change", () => {
      dom.customerImportIndex.value = String(dom.customerImportFileSelect.selectedIndex + 1);
    });
    dom.excelFileList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-file-index]");
      if (!button) return;
      if (!dom.customerImportIndex || !dom.customerImportFileSelect) return;
      dom.customerImportIndex.value = button.dataset.fileIndex;
      dom.customerImportFileSelect.selectedIndex = Number(button.dataset.fileIndex) - 1;
    });
    dom.importCustomersConfigBtn?.addEventListener("click", () => ExcelHandler.importCustomersFromConfig().catch((error) => {
      DB.addErrorLog("導入 config Excel", error);
      UI.refreshAll();
      UI.toast(error.message, "bad");
    }));
    dom.uploadCustomerExcelBtn?.addEventListener("click", () => {
      dom.customerExcelFileInput?.click();
    });
    dom.customerExcelFileInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const originalText = dom.uploadCustomerExcelBtn?.textContent || "";
      try {
        if (dom.uploadCustomerExcelBtn) {
          dom.uploadCustomerExcelBtn.disabled = true;
          dom.uploadCustomerExcelBtn.textContent = "導入中... / Importing...";
        }
        await ExcelHandler.importCustomersFromUpload(file);
      } catch (error) {
        DB.addErrorLog("上傳導入客戶 Excel", error);
        UI.refreshAll();
        UI.toast(error.message, "bad");
      } finally {
        if (dom.uploadCustomerExcelBtn) {
          dom.uploadCustomerExcelBtn.disabled = false;
          dom.uploadCustomerExcelBtn.textContent = originalText || "選擇本機 Excel / Choose Excel from computer";
        }
        event.target.value = "";
      }
    });
    dom.importUpdateBtn.addEventListener("click", () => ExcelHandler.importUpdateFromConfig().catch((error) => {
      DB.addErrorLog("匯入 config 更新 Excel", error);
      UI.refreshAll();
      UI.toast(error.message, "bad");
    }));
    function exportCustomerScope(scope) {
      return () => ExcelHandler.exportCustomers(scope).catch((error) => {
        DB.addErrorLog("Export Excel", error);
        UI.refreshAll();
        UI.toast(error.message, "bad");
      });
    }
    dom.exportCustomersBtn.addEventListener("click", exportCustomerScope("all"));
    dom.exportCurrentGroupBtn.addEventListener("click", exportCustomerScope("group"));
    dom.exportFilteredCustomersBtn.addEventListener("click", exportCustomerScope("filtered"));
    [dom.customerTypeFilter, dom.ratingFilter, dom.followStatusFilter, dom.buyingRoleFilter, dom.groupFilter, dom.customerSearch, dom.sentEmailFilter, dom.repliedFilter, dom.followUpTopicFilter, dom.lastFollowUpRangeFilter, dom.nextFollowUpRangeFilter].forEach((item) => item?.addEventListener("input", () => UI.renderCustomerList()));
    dom.repliedCustomersNav?.addEventListener("click", () => { dom.repliedFilter.value = "yes"; UI.showPage("customersPage"); UI.renderCustomerList(); });
    dom.dueFollowUpsNav?.addEventListener("click", () => { dom.nextFollowUpRangeFilter.value = "due"; UI.showPage("customersPage"); UI.renderCustomerList(); });
    dom.selectAllCustomers.addEventListener("change", () => {
      filterCustomers(DB.getCustomers()).forEach((customer) => {
        if (dom.selectAllCustomers.checked) state.selectedCustomerIds.add(customer.id);
        else state.selectedCustomerIds.delete(customer.id);
      });
      UI.renderCustomerList();
    });
    dom.bulkAnalyzeSelectedBtn.addEventListener("click", () => bulkAnalyze(DB.getCustomers().filter((item) => state.selectedCustomerIds.has(item.id))));
    dom.bulkAnalyzeAllBtn.addEventListener("click", () => bulkAnalyze(DB.getCustomers()));
    dom.bulkDeleteBtn.addEventListener("click", bulkDeleteSelected);
    dom.bulkConvertBtn.addEventListener("click", bulkConvertSelected);
    dom.bulkMoveGroupBtn?.addEventListener("click", bulkMoveSelectedToGroup);
    dom.bulkFollowStatus.addEventListener("change", bulkUpdateFollowUpSelected);
    dom.bulkNextFollowDate.addEventListener("change", bulkUpdateFollowUpSelected);
    dom.backupExportBtn.addEventListener("click", exportBackup);
    dom.backupImportBtn.addEventListener("click", () => dom.backupFileInput.click());
    dom.manualSqliteBackupBtn?.addEventListener("click", () => UI.runManualSqliteBackup().catch((error) => UI.toast(error.message, "bad")));
    dom.refreshSystemLogsBtn?.addEventListener("click", () => UI.loadSystemPage().catch((error) => UI.toast(error.message, "bad")));
    dom.pullLiveSnapshotBtn?.addEventListener("click", () => openLiveSyncDialog());
    dom.previewLiveSyncBtn?.addEventListener("click", () => previewLiveSync().catch((error) => UI.toast(error.message, "bad")));
    dom.syncLiveSnapshotBtn?.addEventListener("click", () => runLiveSync().catch((error) => UI.toast(error.message, "bad")));
    dom.syncAllSections?.addEventListener("change", handleLiveSyncSelectionChange);
    [dom.syncCustomersSection, dom.syncProductsSection, dom.syncLogsSection, dom.syncTemplatesSection, dom.syncSettingsSection, dom.syncAnalysisHistorySection, dom.syncErrorLogsSection]
      .forEach((checkbox) => checkbox?.addEventListener("change", handleLiveSyncSelectionChange));
    dom.backupFileInput.addEventListener("change", () => dom.backupFileInput.files[0] && importBackup(dom.backupFileInput.files[0]).catch((error) => UI.toast(error.message, "bad")));
    dom.clearErrorLogsBtn.addEventListener("click", () => {
      DB.clearErrorLogs();
      UI.renderErrorLogs();
      UI.toast("Error logs cleared.", "good");
    });

    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (action === "download-customer-review") {
        downloadCustomerImportReview(target.dataset.status);
        return;
      }
      if (action === "download-asset") {
        AssetApi.download(id).catch((error) => UI.toast(error.message, "bad"));
        return;
      }
      if (action === "add-asset-attachment") {
        addAssetToEmail(id);
        return;
      }
      if (action === "replace-asset") {
        if (!canManageAssets()) {
          UI.toast("Only Admin or Product Manager can replace shared files.", "warn");
          return;
        }
        if (dom.assetReplaceFileInput) {
          dom.assetReplaceFileInput.dataset.assetId = id;
          dom.assetReplaceFileInput.click();
        }
        return;
      }
      if (action === "delete-asset") {
        if (!canManageAssets()) {
          UI.toast("Only Admin or Product Manager can delete shared files.", "warn");
          return;
        }
        if (confirm("Delete this current asset? Historical email attachments will remain available.")) {
          AssetApi.remove(id).then(() => UI.toast("Asset deleted.", "good")).catch((error) => UI.toast(error.message, "bad"));
        }
        return;
      }
      if (["edit-product", "delete-product"].includes(action) && !canManageProducts()) {
        UI.toast("Product editing is not allowed for this role.", "warn");
        return;
      }
      if (["edit-customer"].includes(action) && !canManageCustomers()) {
        UI.toast("Customer editing is not allowed for this role.", "warn");
        return;
      }
      if (["delete-customer"].includes(action) && !canDeleteCustomers()) {
        UI.toast("Customer deletion is admin-only.", "warn");
        return;
      }
      if (["edit-sender", "toggle-sender", "delete-sender"].includes(action) && !hasPermission("canManageSenders")) {
        UI.toast("Sender management is admin-only.", "warn");
        return;
      }
      if (["edit-user", "delete-user"].includes(action) && !canManageUsers()) {
        UI.toast("User management is admin-only.", "warn");
        return;
      }
      if (["edit-group", "delete-group", "save-group-visibility"].includes(action) && !state.isHostAdmin) {
        UI.toast("Customer group management is admin-only.", "warn");
        return;
      }
      if (["change-buying-role", "change-customer-score", "change-customer-group"].includes(action) && !canManageCustomers()) {
        UI.toast("Customer editing is not allowed for this role.", "warn");
        return;
      }
      if (action === "change-customer-group" && !state.isHostAdmin) {
        UI.toast("Customer group changes are admin-only.", "warn");
        return;
      }
      if (action === "edit-product") openProductDialog(DB.getProducts().find((item) => item.id === id));
      if (action === "delete-product" && confirm("Delete this product?")) {
        DB.setProducts(DB.getProducts().filter((item) => item.id !== id));
        UI.renderProductList();
      }
      if (action === "edit-customer") openCustomerDialog(DB.getCustomers().find((item) => item.id === id));
      if (action === "delete-customer" && confirm("Delete this customer?")) {
        DB.setCustomers(DB.getCustomers().filter((item) => item.id !== id));
        UI.refreshAll();
      }
      if (action === "load-customer") {
        const customer = DB.getCustomers().find((item) => item.id === id);
        if (customer) {
          fillAnalysisForm(customer);
          UI.showPage("analysisPage");
        }
      }
      if (action === "manage-email-contacts") openEmailContactsDialog(id);
      if (action === "quick-email-contact") applyQuickEmailContact(id);
      if (action === "add-log") openLogDialog(id);
      if (action === "copy-log-email") {
        const log = DB.getLogs()[id];
        if (log) {
          navigator.clipboard.writeText(`Subject: ${log.subject || ""}\n\n${log.summary || ""}`);
          UI.toast("Historical email copied.", "good");
        }
      }
      if (action === "open-email-draft") openEmailDraft(id);
      if (action === "remove-attachment") {
        state.emailAttachments = normalizeAttachments(state.emailAttachments).filter((item) => item.id !== id);
        UI.renderAttachmentList();
        previewTemplate();
      }
      if (action === "edit-sender") editSender(id);
      if (action === "toggle-sender") {
        SenderApi.toggle(id).catch((error) => UI.toast(error.message, "bad"));
      }
      if (action === "delete-sender" && confirm("Delete this sender?")) {
        SenderApi.remove(id).catch((error) => UI.toast(error.message, "bad"));
      }
      if (action === "edit-user") editUser(id);
      if (action === "delete-user" && confirm("Delete this user?")) {
        UserApi.remove(id).catch((error) => UI.toast(error.message, "bad"));
      }
      if (action === "save-group-visibility") {
        const group = state.groups.find((item) => item.id === id);
        const permissions = Array.from(dom.groupList?.querySelectorAll(".group-role-permissions") || []).find((item) => item.dataset.groupId === id);
        if (!group || !permissions) return;
        const visibleRoles = Array.from(permissions.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
        GroupApi.update(id, group.name, visibleRoles).catch((error) => UI.toast(error.message, "bad"));
      }
      if (action === "edit-group") {
        const group = state.groups.find((item) => item.id === id);
        if (!group) return;
        const name = prompt("Edit group name / 編輯組別名稱", group.name);
        if (!name || normalizeText(name) === group.name) return;
        GroupApi.update(id, name).catch((error) => UI.toast(error.message, "bad"));
      }
      if (action === "delete-group") {
        const group = state.groups.find((item) => item.id === id);
        if (!group) return;
        if (!confirm(`Delete group "${group.name}"? Customers in this group will move to Ungrouped.`)) return;
        GroupApi.remove(id).catch((error) => UI.toast(error.message, "bad"));
      }
      if (action === "remove-email-contact") {
        state.emailContactsDraft = normalizeEmailContacts(state.emailContactsDraft).filter((_, index) => String(index) !== String(id));
        renderEmailContactsDialog();
      }
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      const action = target.dataset?.action;
      const id = target.dataset?.id;
      if (!action || !id) return;
      if (["toggle-product-pool", "toggle-product-priority", "change-product-recommended-for"].includes(action) && !canManageProducts()) {
        UI.toast("Product editing is not allowed for this role.", "warn");
        target.checked = !target.checked;
        UI.renderProductList();
        return;
      }
      if (["change-buying-role", "change-customer-score"].includes(action) && !canManageCustomers()) {
        UI.toast("Customer editing is not allowed for this role.", "warn");
        UI.renderCustomerList();
        return;
      }
      if (action === "change-customer-group" && !state.isHostAdmin) {
        UI.toast("Customer group changes are admin-only.", "warn");
        UI.renderCustomerList();
        return;
      }
      if (action === "toggle-product-pool" || action === "toggle-product-priority") {
        const products = DB.getProducts().map((item) => {
          if (item.id !== id) return item;
          if (action === "toggle-product-pool") return { ...item, inRecommendationPool: target.checked };
          return { ...item, isPriority: target.checked, priority: target.checked && !item.priority ? 1 : item.priority };
        });
        DB.setProducts(products);
        UI.renderProductList();
      }
      if (action === "change-product-recommended-for") {
        const nextRecommendedFor = normalizeRecommendedFor(target.value);
        const products = DB.getProducts().map((item) => item.id === id
          ? { ...item, recommendedFor: nextRecommendedFor }
          : item);
        DB.setProducts(products);
        UI.renderProductList();
        UI.toast(`Recommended For saved: ${nextRecommendedFor}`, "good");
      }
      if (action === "select-customer") {
        if (target.checked) state.selectedCustomerIds.add(id);
        else state.selectedCustomerIds.delete(id);
      }
      if (action === "change-buying-role") {
        const nextRole = normalizeBuyingRole(target.value);
        const customers = DB.getCustomers().map((item) => item.id === id
          ? { ...item, buyingRole: nextRole, isBuyingRoleManuallyReviewed: true }
          : item);
        DB.setCustomers(customers);
        if (state.currentCustomerId === id) {
          const current = customers.find((item) => item.id === id);
          if (current) fillAnalysisForm(current);
        }
        UI.renderCustomerList();
        UI.toast(`Buyer classification saved: ${buyingRoleDisplay(nextRole)}`, "good");
      }
      if (action === "change-customer-score") {
        const nextScore = normalizeCustomerScore(target.value);
        const customers = DB.getCustomers().map((item) => item.id === id
          ? { ...item, customerScore: nextScore }
          : item);
        DB.setCustomers(customers);
        UI.renderCustomerList();
        UI.toast(`Customer Score saved: ${nextScore ?? "empty"}`, "good");
      }
      if (action === "change-customer-group") {
        GroupApi.moveCustomer(id, target.value).catch((error) => UI.toast(error.message, "bad"));
      }
      if (action === "edit-email-contact-email" || action === "edit-email-contact-role") {
        const index = Number(id);
        const contacts = normalizeEmailContacts(state.emailContactsDraft);
        if (!Number.isInteger(index) || !contacts[index]) return;
        if (action === "edit-email-contact-email") contacts[index].email = normalizeText(target.value);
        if (action === "edit-email-contact-role") contacts[index].role = normalizeEmailRole(target.value);
        state.emailContactsDraft = normalizeEmailContacts(contacts);
        renderEmailContactsDialog();
      }
    });
    document.addEventListener("keydown", (event) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const typing = ["input", "textarea", "select"].includes(activeTag);
      if (event.key === "Escape") {
        document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        const visibleSearch = document.querySelector(".page.active input[type='search']");
        visibleSearch?.focus();
      }
      if (!event.ctrlKey) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        dom.saveCustomerBtn.click();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        dom.runAnalysisBtn.click();
      }
      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        dom.fetchWebsiteBtn.click();
      }
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        ExcelHandler.exportCustomers().catch((error) => UI.toast(error.message, "bad"));
      }
    });
  }

  async function init() {
    bindDom();
    applyThemePreference();
    UI.toast("Loading shared database...", "warn");
    await AuthApi.me().catch((error) => {
      DB.addErrorLog("Load current user", error);
      state.userRole = isLocalEnvironment() ? "admin" : "sales";
      state.permissions = { isAdmin: isLocalEnvironment() };
      state.isHostAdmin = isLocalEnvironment();
    });
    await DB.initSharedStore();
    purgeDeprecatedProductStatus();
    DB.getProducts();
    DB.getTemplates();
    await CustomTemplateApi.list().catch((error) => {
      DB.addErrorLog("載入自訂範本", error);
      state.customTemplates = [];
    });
    await GroupApi.list().catch((error) => {
      DB.addErrorLog("載入客戶組別", error);
      state.groups = [];
    });
    await AssetApi.list().catch((error) => {
      DB.addErrorLog("Load asset library", error);
      state.assets = [];
    });
    await refreshSenders().catch((error) => {
      DB.addErrorLog("載入寄件者", error);
      UI.renderSenderSelector();
      UI.renderSenderList();
    });
    if (canManageUsers()) {
      await UserApi.list().catch((error) => {
        DB.addErrorLog("Load users", error);
        state.users = [];
      });
    }
    bindEvents();
    UI.refreshAll();
    refreshImportFiles({ silent: true }).catch((error) => {
      if (error.hostOnly) {
        UI.toast("Excel import is host-only. Colleagues can use shared data directly.", "warn");
        return;
      }
      DB.addErrorLog("列出導入文件", error);
      UI.renderErrorLogs();
    });
    UI.showPage("analysisPage");
    UI.toast(DB.sharedReady ? "Ready - SQLite shared database connected." : `Ready - local fallback (${DB.sharedWarning})`, DB.sharedReady ? "good" : "warn");
  }

  init().catch((error) => {
    console.error(error);
    UI.toast(error.message || "Startup failed.", "bad");
  });
})();

(function () {
  "use strict";

  const API_BASE = location.protocol === "file:" ? "http://127.0.0.1:8787" : location.origin;
  const TODAY = new Date().toISOString().slice(0, 10);

  const STORAGE = {
    customers: "phottix_customers",
    products: "phottix_products",
    logs: "phottix_followup_logs",
    templates: "phottix_email_templates",
    settings: "phottix_settings",
    autoBackups: "phottix_auto_backups",
    analysisHistory: "phottix_analysis_history",
    errorLogs: "phottix_error_logs"
  };
  const SHARED_STORAGE_KEYS = Object.values(STORAGE);
  const SQLITE_SYNC_KEY = "phottix_sqlite_shared_sync";

  const PRODUCT_STATUSES = ["Active", "New", "Phase-Out", "Do Not Recommend"];
  const CUSTOMER_TYPES = ["prospect", "existing"];
  const INDUSTRY_TYPES = ["", "Wholesale", "Retail", "Studio", "Events", "Creator", "Camera Store", "Online Shop", "Physical Store", "Services", "Other"];
  const FOLLOW_STATUSES = ["open", "completed", "pending", "cancelled", "deferred"];
  const EMAIL_PURPOSES = [
    "First Touch",
    "Product Follow-up",
    "New Product Promotion",
    "Event Invitation",
    "Existing Customer Update",
    "Reactivation",
    "Holiday Greeting"
  ];

  const DEFAULT_PRODUCTS = [
    { name: "Phottix Kali50Ra RGB LED Light", category: "Lighting", status: "Active", inRecommendationPool: true, isPriority: true },
    { name: "Phottix X160 COB LED Light", category: "Lighting", status: "Active", inRecommendationPool: true, isPriority: true },
    { name: "Phottix X600 COB LED Light", category: "Lighting", status: "Active", inRecommendationPool: true, isPriority: false },
    { name: "Phottix M200R RGB Panel", category: "Lighting", status: "New", inRecommendationPool: true, isPriority: true },
    { name: "Phottix M500R RGB Panel", category: "Lighting", status: "New", inRecommendationPool: true, isPriority: false },
    { name: "Phottix G-Capsule Softbox 85cm", category: "Modifiers", status: "Active", inRecommendationPool: true, isPriority: true },
    { name: "Phottix G-Capsule Softbox 105cm", category: "Modifiers", status: "Active", inRecommendationPool: true, isPriority: false },
    { name: "Phottix Odin II TTL Flash Trigger", category: "Flash & Trigger", status: "Active", inRecommendationPool: true, isPriority: false },
    { name: "Phottix Juno Flash", category: "Flash & Trigger", status: "Phase-Out", inRecommendationPool: false, isPriority: false },
    { name: "Phottix Light Stand", category: "Support & Accessories", status: "Active", inRecommendationPool: true, isPriority: false }
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
    { key: "cameraStore", label: "Camera Store", weight: 25, terms: [/camera store|camera shop|photo store|camera center|camera centre|camera|lens|lenses|photography equipment|相機店|攝影器材/i] },
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
    emailAttachments: []
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

  function normalizeUrl(value) {
    const text = normalizeText(value);
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    if (/^www\./i.test(text)) return `https://${text}`;
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) return `https://${text}`;
    return text;
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

  function purposeKey(purpose) {
    return normalizeText(purpose).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
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

  function normalizeAttachment(item = {}) {
    const type = normalizeText(item.type || "hyperlink").toLowerCase();
    const url = normalizeText(item.url || item.href || "");
    const name = normalizeText(item.name || item.label || url || "Attachment");
    return {
      id: item.id || uid("att"),
      type,
      name,
      url,
      size: item.size || "",
      createdAt: item.createdAt || new Date().toISOString()
    };
  }

  function normalizeAttachments(items) {
    return Array.isArray(items)
      ? items.map(normalizeAttachment).filter((item) => item.name || item.url)
      : [];
  }

  function attachmentTypeLabel(type) {
    return {
      pdf: "PDF",
      word: "Word",
      excel: "Excel",
      image: "Image",
      video: "Video",
      hyperlink: "Hyper Link",
      other: "Other"
    }[String(type || "").toLowerCase()] || "Attachment";
  }

  function formatAttachmentText(items = []) {
    const attachments = normalizeAttachments(items);
    if (!attachments.length) return "";
    return attachments.map((item) => `- [${attachmentTypeLabel(item.type)}] ${item.name}${item.url ? `: ${item.url}` : ""}`).join("\n");
  }

  function renderEmailText(subject, body, attachments = []) {
    const attachmentText = formatAttachmentText(attachments);
    const renderedBody = String(body || "").split("{{emailAttachments}}").join(attachmentText || "No attachments or links.");
    const shouldAppend = attachmentText && !/Attachments \/ Links:/i.test(renderedBody);
    return `Subject: ${subject || ""}\n\n${renderedBody}${shouldAppend ? `\n\nAttachments / Links:\n${attachmentText}` : ""}`;
  }

  function renderEmailBody(body, attachments = []) {
    const attachmentText = formatAttachmentText(attachments);
    const renderedBody = String(body || "").split("{{emailAttachments}}").join(attachmentText || "No attachments or links.");
    const shouldAppend = attachmentText && !/Attachments \/ Links:/i.test(renderedBody);
    return `${renderedBody}${shouldAppend ? `\n\nAttachments / Links:\n${attachmentText}` : ""}`;
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
        [STORAGE.errorLogs]: this.read(STORAGE.errorLogs, [])
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
      return customers.length > 0 || products.length > 0 || Object.keys(logs || {}).length > 0;
    },
    snapshotHasBusinessData(data = {}) {
      return Array.isArray(data[STORAGE.customers]) && data[STORAGE.customers].length > 0
        || Array.isArray(data[STORAGE.products]) && data[STORAGE.products].length > 0
        || data[STORAGE.logs] && typeof data[STORAGE.logs] === "object" && Object.keys(data[STORAGE.logs]).length > 0;
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
        emailPurpose: customer.emailPurpose || "First Touch",
        attachments: customer.attachments || [],
        emailDraft: {
          ...(customer.emailDraft || { subject: "", body: "" }),
          emailAttachments: normalizeAttachments(customer.emailDraft?.emailAttachments)
        },
        emailHistory: Array.isArray(customer.emailHistory)
          ? customer.emailHistory.map((item) => ({ ...item, emailAttachments: normalizeAttachments(item.emailAttachments) }))
          : customer.emailHistory
      }));
    },
    setCustomers(customers) {
      this.write(STORAGE.customers, customers);
    },
    getProducts() {
      const products = this.read(STORAGE.products, []).map((product) => ({
        ...product,
        priority: product.priority ?? "",
        sku: product.sku || "",
        description: product.description || "",
        price: product.price ?? "",
        productUrl: product.productUrl || "",
        launchDate: product.launchDate || ""
      }));
      if (products.length) return products;
      const seeded = DEFAULT_PRODUCTS.map((item) => ({
        id: uid("prod"),
        createdAt: new Date().toISOString(),
        ...item
      }));
      this.setProducts(seeded);
      return seeded;
    },
    setProducts(products) {
      this.write(STORAGE.products, products);
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
        phottix_error_logs: this.getErrorLogs()
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
      return ["A", "B", "C"].includes(scoring?.rating) && Boolean(scoring?.businessSignals?.length);
    },
    recommend(customer, scoring) {
      if (!this.isProductReadyLead(scoring)) return [];
      const products = DB.getProducts()
        .filter((product) => product.status !== "Do Not Recommend" && product.inRecommendationPool);
      const signals = scoring.businessSignals.join(" ").toLowerCase();
      const scored = products.map((product) => {
        const text = `${product.name} ${product.category}`.toLowerCase();
        let score = product.isPriority ? 20 : 0;
        if (product.status === "New") score += 8;
        if (product.status === "Phase-Out") score -= 10;
        if (/wholesale|retail|camera store|online shop/.test(signals) && /lighting|modifier|flash|trigger|accessor/i.test(text)) score += 20;
        if (/studio|creator|events/.test(signals) && /lighting|softbox|panel|stand|modifier/i.test(text)) score += 18;
        if (/services/.test(signals) && /support|accessor|stand|trigger/i.test(text)) score += 10;
        if (/lighting|led|rgb|cob|softbox/i.test(text)) score += 8;
        return { ...product, matchScore: score };
      }).filter((item) => item.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore || Number(a.priority || 999) - Number(b.priority || 999) || a.name.localeCompare(b.name))
        .slice(0, 5);
      return scored.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        status: product.status,
        sku: product.sku || "",
        description: product.description || "",
        productUrl: product.productUrl || "",
        reason: this.reason(product, scoring)
      }));
    },
    reason(product, scoring) {
      const signals = scoring.businessSignals;
      if (product.status === "New") return `New product suitable for ${signals.slice(0, 2).join(" / ") || "current channel"} discussions.`;
      if (product.status === "Phase-Out") return `Phase-out item. Use only as availability or last-chance angle.`;
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
    variables(customer, analysis) {
      const products = analysis?.recommendedProducts || customer.recommendedProducts || [];
      const signals = analysis?.businessSignals || customer.businessSignals || [];
      return {
        "{{公司名}}": customer.companyName || "your team",
        "{{聯絡人}}": customer.contactName || "there",
        "{{官網}}": customer.website || "",
        "{{客戶類型}}": customer.customerType || "prospect",
        "{{官網發現的產品線}}": this.describeSignals(signals),
        "{{推薦產品}}": this.describeProducts(products),
        "{{評分}}": `${analysis?.rating || customer.rating || "NR"} / ${analysis?.totalScore || ""}`,
        "{{郵件目的}}": customer.emailPurpose || dom.emailPurpose?.value || "First Touch",
        "{{emailAttachments}}": formatAttachmentText(state.emailAttachments) || "No attachments or links."
      };
    },
    renderTemplate(template, variables) {
      let subject = template.subject || "";
      let body = template.body || "";
      for (const [key, value] of Object.entries(variables)) {
        subject = subject.split(key).join(value || "");
        body = body.split(key).join(value || "");
      }
      return { subject, body };
    },
    generate(customer, analysis) {
      if (!analysis?.recommendedProducts?.length && !["A", "B", "C"].includes(analysis?.rating)) {
        const company = customer.companyName || "your team";
        const greeting = customer.contactName || "there";
        return {
          subject: `Quick Phottix introduction for ${company}`,
          body: [
            `Hi ${greeting},`,
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
        const greeting = customer.contactName || "there";
        const products = this.describeProducts(analysis?.recommendedProducts || customer.recommendedProducts || []);
        const isExisting = customer.customerType === "existing";
        return {
          subject: isExisting
            ? `New Phottix product update for ${company}`
            : `New Phottix products for ${company}`,
          body: isExisting ? [
            `Hi ${greeting},`,
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
          ].join("\n") : [
            `Hi ${greeting},`,
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
          ].join("\n")
        };
      }
      const templates = DB.getTemplates();
      const key = purposeKey(customer.emailPurpose || "First Touch");
      const template = templates[key] || templates.first_touch || DEFAULT_TEMPLATES.first_touch;
      const rendered = this.renderTemplate(template, this.variables(customer, analysis));
      return rendered;
    }
  };

  const ExcelHandler = {
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
    selectedImportFilename(selectEl = dom.customerImportFileSelect, indexEl = dom.customerImportIndex) {
      const files = Array.from(selectEl.options).map((option) => option.value).filter(Boolean);
      const index = Number(indexEl.value || selectEl.selectedIndex + 1);
      if (!Number.isInteger(index) || index < 1 || index > files.length) {
        throw new Error(`Please enter a file number from 1 to ${files.length || 0}.`);
      }
      return files[index - 1];
    },
    importCustomerRows(rows) {
      DB.backup("before_customer_import");
      const customers = DB.getCustomers();
      let added = 0;
      let skipped = 0;
      let forceUpdated = 0;
      for (const row of rows) {
        const incoming = normalizeImportedCustomer(row);
        incoming._normalizedDomain = importedRowDomain(row) || normalizeDomain(incoming.website);
        if (!incoming.companyName && !incoming.website && !incoming.contactEmail) continue;
        const index = customers.findIndex((item) => isDuplicateCustomer(item, incoming));
        if (index >= 0) {
          if (isForceUpdateRow(row)) {
            customers[index] = { ...customers[index], ...removeEmpty(stripTransientCustomerFields(incoming)), id: customers[index].id };
            forceUpdated += 1;
          } else {
            skipped += 1;
          }
        } else {
          customers.push(stripTransientCustomerFields(incoming));
          added += 1;
        }
      }
      DB.setCustomers(customers);
      UI.refreshAll();
      UI.toast(`新增：${added} 筆，跳過：${skipped} 筆（重複客戶），強制更新：${forceUpdated} 筆。`, "good");
    },
    async importCustomersFromConfig(filename) {
      const cleanName = normalizeText(filename || this.selectedImportFilename()).replace(/^["']|["']$/g, "");
      if (!cleanName) throw new Error("Please type or select an Excel filename first.");
      this.importCustomerRows(await this.parseConfigFile(cleanName));
    },
    importProductRows(rows) {
      DB.backup("before_product_import");
      const products = DB.getProducts();
      let added = 0;
      let overwritten = 0;
      let skipped = 0;
      for (const row of rows) {
        const incoming = normalizeImportedProduct(row);
        if (!incoming.name) continue;
        const index = products.findIndex((item) => item.name.toLowerCase() === incoming.name.toLowerCase());
        if (index >= 0) {
          const ok = confirm(`Duplicate product found: ${incoming.name}. Overwrite it? Cancel will skip.`);
          if (ok) {
            products[index] = { ...products[index], ...incoming, id: products[index].id };
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
    async importProductsFromConfig(filename) {
      const cleanName = normalizeText(filename || this.selectedImportFilename(dom.productImportFileSelect, dom.productImportIndex)).replace(/^["']|["']$/g, "");
      if (!cleanName) throw new Error("Please type or select an Excel filename first.");
      this.importProductRows(await this.parseConfigFile(cleanName));
    },
    async exportCustomers() {
      const customers = DB.getCustomers().map((customer) => ({
        id: customer.id,
        company_name: customer.companyName,
        contact_name: customer.contactName,
        contact_email: customer.contactEmail,
        country: customer.country,
        city: customer.city,
        industry: customer.industry,
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
        body: JSON.stringify({ data: customers })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Export failed.");
      }
      downloadBlob(await response.blob(), `phottix_decision_table_${Date.now()}.xlsx`);
      UI.toast("Excel exported.", "good");
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
          notes: [customers[index].notes, normalized.notes].filter(Boolean).join(" | ")
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

  const UI = {
    toast(message, tone = "") {
      dom.toast.textContent = message;
      dom.toast.className = `toast ${tone}`.trim();
    },
    showPage(pageId) {
      document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === pageId));
      document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.page === pageId));
      const titles = {
        analysisPage: ["客戶分析 / Customer Analysis", "抓取官網、提取業務信號、評分、推薦產品並生成英文開發信。"],
        productsPage: ["產品資料庫 / Product Database", "管理完整目錄、推薦池、產品狀態與 Priority。"],
        customersPage: ["客戶池 / Customer Pool", "管理 Prospect / Existing、批量分析、跟進狀態和 Excel 決策表。"]
      };
      dom.pageTitle.textContent = titles[pageId]?.[0] || "Phottix Customer Agent";
      dom.pageSubtitle.textContent = titles[pageId]?.[1] || "";
    },
    refreshAll() {
      this.renderTodayFollowUps();
      this.renderStats();
      this.renderErrorLogs();
      this.renderLoadCustomerSelect();
      this.renderProductList();
      this.renderCustomerList();
      this.renderTemplateEditor();
    },
    renderTodayFollowUps() {
      const active = DB.getCustomers().filter((item) => ["open", "pending"].includes(item.followUpStatus));
      const dueToday = active.filter((item) => item.nextFollowUpDate === TODAY);
      const overdue = active.filter((item) => item.nextFollowUpDate && item.nextFollowUpDate < TODAY);
      const customers = [...overdue, ...dueToday];
      dom.todayFollowCount.textContent = customers.length;
      if (dom.overdueFollowCount) dom.overdueFollowCount.textContent = `逾期 ${overdue.length}`;
      if (dom.dueTodayFollowCount) dom.dueTodayFollowCount.textContent = `今日 ${dueToday.length}`;
      dom.todayFollowList.innerHTML = customers.length
        ? customers.slice(0, 8).map((item) => {
          const label = item.nextFollowUpDate < TODAY ? `逾期 ${Math.max(1, Math.floor((new Date(TODAY) - new Date(item.nextFollowUpDate)) / 86400000))} 天` : "今日到期";
          const dueClass = item.nextFollowUpDate < TODAY ? "overdue" : "due-today";
          return `<button class="today-item ${dueClass}" data-action="load-customer" data-id="${escapeHtml(item.id)}" type="button"><strong>${escapeHtml(item.companyName)}</strong><br>${escapeHtml(label)}</button>`;
        }).join("")
        : `<div class="empty">今天沒有待跟進客戶。</div>`;
    },
    renderStats() {
      if (!dom.statsSummary) return;
      const customers = DB.getCustomers();
      const logs = Object.values(DB.getLogs());
      const monthKey = new Date().toISOString().slice(0, 7);
      const ratingCounts = ["A", "B", "C", "D", "NR"].map((rating) => `${rating}:${customers.filter((item) => (item.rating || "NR") === rating).length}`).join(" ");
      const activeLogs = logs.filter((log) => ["positive", "neutral", "negative", "no_response"].includes(log.response));
      const positive = activeLogs.filter((log) => log.response === "positive").length;
      const responseRate = activeLogs.length ? Math.round((positive / activeLogs.length) * 100) : 0;
      const cards = [
        [`${customers.filter((item) => item.customerType === "prospect").length}/${customers.filter((item) => item.customerType === "existing").length}`, "Prospect / Existing"],
        [ratingCounts, "評級分布"],
        [customers.filter((item) => item.nextFollowUpDate === TODAY && ["open", "pending"].includes(item.followUpStatus)).length, "今日待跟進"],
        [customers.filter((item) => item.nextFollowUpDate && item.nextFollowUpDate < TODAY && ["open", "pending"].includes(item.followUpStatus)).length, "逾期跟進"],
        [customers.filter((item) => String(item.createdAt || "").slice(0, 7) === monthKey).length, "本月新增"],
        [`${responseRate}%`, "正面回應率"]
      ];
      dom.statsSummary.innerHTML = cards.map(([value, label]) => `<div class="stat-card"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`).join("");
    },
    renderErrorLogs() {
      if (!dom.errorLogList) return;
      const logs = DB.getErrorLogs().slice(0, 5);
      dom.errorLogList.innerHTML = logs.length
        ? logs.map((log) => `<div class="today-item"><strong>${escapeHtml(log.operation)}</strong><br>${escapeHtml(log.message)}<br><small>${escapeHtml(formatDateTime(log.timestamp))}</small></div>`).join("")
        : `<div class="empty">沒有錯誤日誌。</div>`;
    },
    renderLoadCustomerSelect() {
      const customers = DB.getCustomers();
      dom.loadCustomerSelect.innerHTML = `<option value="">從客戶池載入 / Load from Customer Pool</option>${customers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.companyName || item.website || item.contactEmail)}</option>`).join("")}`;
    },
    renderProductList() {
      const query = normalizeText(dom.productSearch.value).toLowerCase();
      const view = dom.productView.value;
      let products = DB.getProducts();
      if (view === "pool") products = products.filter((item) => item.inRecommendationPool);
      if (query) products = products.filter((item) => `${item.name} ${item.category} ${item.status} ${item.sku || ""} ${item.description || ""}`.toLowerCase().includes(query));
      dom.productTable.innerHTML = products.length ? `
        <table>
          <thead><tr><th>產品名稱</th><th>分類</th><th>狀態</th><th>SKU</th><th>Price</th><th>URL</th><th>推薦池</th><th>Priority</th><th>操作</th></tr></thead>
          <tbody>
            ${products.map((item) => `
              <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.category)}</td>
                <td>${escapeHtml(item.status)}</td>
                <td>${escapeHtml(item.sku || "—")}</td>
                <td>${escapeHtml(item.price !== "" && item.price !== undefined ? String(item.price) : "—")}</td>
                <td>${item.productUrl ? `<a href="${escapeHtml(item.productUrl)}" target="_blank" rel="noopener">Link</a>` : "—"}</td>
                <td><input type="checkbox" data-action="toggle-product-pool" data-id="${escapeHtml(item.id)}" ${item.inRecommendationPool ? "checked" : ""}></td>
                <td><input type="checkbox" data-action="toggle-product-priority" data-id="${escapeHtml(item.id)}" ${item.isPriority ? "checked" : ""}> ${escapeHtml(item.priority !== "" && item.priority !== undefined ? String(item.priority) : "")}</td>
                <td>
                  <button class="mini-button" data-action="edit-product" data-id="${escapeHtml(item.id)}">編輯</button>
                  <button class="danger-button" data-action="delete-product" data-id="${escapeHtml(item.id)}">刪除</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty">沒有產品。</div>`;
    },
    renderCustomerList() {
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
              <span class="status-pill">${escapeHtml(customer.followUpStatus || "open")}</span>
              <span class="status-pill">Next: ${escapeHtml(customer.nextFollowUpDate || "—")}</span>
            </div>
            <p>${escapeHtml([customer.contactName, customer.contactEmail, customer.country, customer.city, customer.industry].filter(Boolean).join(" · ") || "No contact info")}</p>
            <p><strong>Suggested Action:</strong> ${escapeHtml(suggestAction(customer))}</p>
            <p><strong>Last Analyzed:</strong> ${escapeHtml(customer.lastAnalyzedAt ? formatDateTime(customer.lastAnalyzedAt) : "Never")}${stale !== null && stale > 30 ? " · over 30 days" : ""}</p>
            <footer>
              <button class="mini-button" data-action="load-customer" data-id="${escapeHtml(customer.id)}">載入分析</button>
              <button class="mini-button" data-action="edit-customer" data-id="${escapeHtml(customer.id)}">編輯</button>
              <button class="mini-button" data-action="add-log" data-id="${escapeHtml(customer.id)}">新增跟進</button>
              <button class="danger-button" data-action="delete-customer" data-id="${escapeHtml(customer.id)}">刪除</button>
            </footer>
          </article>
        `;
      }).join("") : `<div class="empty">沒有客戶。</div>`;
    },
    renderAnalysisResult(customer, analysis) {
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
          <p>${escapeHtml(product.category)} · ${escapeHtml(product.status)}</p>
          ${product.description ? `<p>${escapeHtml(product.description)}</p>` : ""}
          ${product.productUrl ? `<p><a href="${escapeHtml(product.productUrl)}" target="_blank" rel="noopener">Product link</a></p>` : ""}
          <p>${escapeHtml(product.reason)}</p>
        </div>
      `).join("") : `<div class="empty">推薦池沒有可用產品，請先在產品資料庫選入 Recommendation Pool。</div>`;
      dom.actionSuggestions.innerHTML = buildSuggestions(analysis).map((item) => `<div class="recommend-card">${escapeHtml(item)}</div>`).join("");
      state.emailAttachments = normalizeAttachments(customer.emailDraft?.emailAttachments || analysis.emailDraft.emailAttachments || state.emailAttachments);
      this.renderAttachmentList();
      dom.emailPreview.textContent = renderEmailText(analysis.emailDraft.subject, analysis.emailDraft.body, state.emailAttachments);
      dom.sendEmailBtn.disabled = false;
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
            ${log.channel === "Email" ? `<button class="mini-button" data-action="copy-log-email" data-id="${escapeHtml(log.logId)}" type="button">從歷史郵件複製</button>` : ""}
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
    renderTemplateEditor() {
      const current = dom.templatePurpose.value || "First Touch";
      dom.templatePurpose.innerHTML = EMAIL_PURPOSES.map((purpose) => `<option ${purpose === current ? "selected" : ""}>${purpose}</option>`).join("");
      const template = DB.getTemplates()[purposeKey(current)] || DEFAULT_TEMPLATES[purposeKey(current)] || DEFAULT_TEMPLATES.first_touch;
      dom.templateSubject.value = template.subject || "";
      dom.templateBody.value = template.body || "";
      state.emailAttachments = normalizeAttachments(template.emailAttachments || []);
      this.renderAttachmentList();
    },
    renderAttachmentList() {
      if (!dom.attachmentList) return;
      const attachments = normalizeAttachments(state.emailAttachments);
      state.emailAttachments = attachments;
      dom.attachmentList.innerHTML = attachments.length
        ? attachments.map((item) => `
          <div class="attachment-item">
            <span><strong>${escapeHtml(attachmentTypeLabel(item.type))}</strong> ${escapeHtml(item.name)}</span>
            ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open</a>` : ""}
            <button class="mini-button" data-action="remove-attachment" data-id="${escapeHtml(item.id)}" type="button">移除</button>
          </div>
        `).join("")
        : `<div class="empty">No attachments or links added.</div>`;
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
      ["客戶類型", customer.customerType],
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

  function normalizeStatus(value) {
    const text = normalizeText(value);
    const found = PRODUCT_STATUSES.find((status) => status.toLowerCase() === text.toLowerCase());
    return found || "Active";
  }

  function normalizeCustomerType(value) {
    const text = normalizeText(value).toLowerCase();
    return CUSTOMER_TYPES.includes(text) ? text : "prospect";
  }

  function normalizeImportedCustomer(row) {
    const n = normalizeKeys(row);
    const customerTypeText = getAny(n, "Customer Type", "customer_type", "客戶類型", "客户类型");
    const industry = getAny(n, "Industry", "industry", "行業類別", "行业类别", "行業", "行业");
    const country = getAny(n, "Country", "country", "國家", "国家", "地區", "地区", "國家地區名", "国家地区名", "國家地區名稱", "国家地区名称");
    const city = getAny(n, "City", "city", "城市", "城巿");
    const notes = [
      getAny(n, "Notes", "notes", "備註", "备注"),
      getAny(n, "Company Type", "company_type", "公司類型", "公司类型"),
      getAny(n, "Main Products", "main_products", "主營產品", "主营产品"),
      industry ? `Industry: ${industry}` : ""
    ].filter(Boolean).join(" | ");
    return {
      id: getAny(n, "id", "Customer ID", "customer_id", "客戶ID", "客户ID") || uid("cust"),
      companyName: getAny(n, "Company Name", "company_name", "company", "name", "公司名稱", "公司名称"),
      website: normalizeUrl(getAny(n, "Website", "website", "domain", "url", "Company Website", "Company Homepage", "公司主頁", "公司主页", "官網", "官网", "官網域名", "官网域名")),
      contactName: getAny(n, "Contact Name", "contact_name", "contact", "Primary Contact Name", "主要聯絡人名稱", "主要联系人名称", "聯絡人", "联系人", "联系人姓名"),
      contactEmail: getAny(n, "Contact Email", "contact_email", "email", "email address", "Primary Contact Email", "主要聯絡人郵箱", "主要联系人邮箱", "郵箱", "邮箱", "電子郵箱", "电子邮箱", "聯絡郵箱", "联系邮箱"),
      country,
      city,
      industry,
      customerType: normalizeCustomerType(customerTypeText),
      rating: getAny(n, "Rating", "rating", "評級", "评级") || "NR",
      scores: { priority: 0, productFit: 0, confidence: 0, readiness: 0 },
      businessSignals: [],
      recommendedProducts: [],
      attachments: [],
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
    return {
      id: uid("prod"),
      name: getAny(n, "Product Name", "product_name", "name", "product", "產品名稱", "产品名称"),
      category: getAny(n, "Category", "category", "分類", "分类") || "Uncategorized",
      status: normalizeStatus(getAny(n, "Status", "status", "產品狀態", "产品状态")),
      inRecommendationPool: parseBoolean(getAny(n, "In Recommendation Pool", "in_recommendation_pool", "recommendation pool", "納入推薦池", "纳入推荐池"), false),
      priority: priorityNumber,
      isPriority: priorityNumber !== "" ? Number(priorityNumber) <= 3 : parseBoolean(priorityValue, false),
      sku: getAny(n, "SKU", "sku", "產品編號", "产品编号"),
      description: getAny(n, "Description", "description", "產品描述", "产品描述"),
      price: parseNumber(getAny(n, "Price", "price", "價格", "价格"), ""),
      productUrl: normalizeUrl(getAny(n, "Product URL", "product_url", "url", "產品連結", "产品链接", "產品網址", "产品网址")),
      launchDate: getAny(n, "Launch Date", "launch_date", "上市日期"),
      createdAt: new Date().toISOString()
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

  function filterCustomers(customers) {
    const type = dom.customerTypeFilter.value;
    const rating = dom.ratingFilter.value;
    const status = dom.followStatusFilter.value;
    const query = normalizeText(dom.customerSearch.value).toLowerCase();
    return customers.filter((customer) => {
      if (type && customer.customerType !== type) return false;
      if (rating && customer.rating !== rating) return false;
      if (status && customer.followUpStatus !== status) return false;
      if (query && !`${customer.companyName} ${customer.website} ${customer.contactEmail}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function formCustomer() {
    const existing = state.currentCustomerId ? DB.getCustomers().find((item) => item.id === state.currentCustomerId) : null;
    return {
      id: state.currentCustomerId || uid("cust"),
      companyName: normalizeText(dom.companyName.value),
      website: normalizeUrl(dom.website.value),
      contactName: normalizeText(dom.contactName.value),
      contactEmail: normalizeText(dom.contactEmail.value),
      country: normalizeText(dom.country.value),
      city: normalizeText(dom.city.value),
      industry: normalizeText(dom.industry.value),
      customerType: existing?.customerType || "prospect",
      rating: existing?.rating || "NR",
      scores: existing?.scores || { priority: 0, productFit: 0, confidence: 0, readiness: 0 },
      businessSignals: existing?.businessSignals || [],
      recommendedProducts: existing?.recommendedProducts || [],
      attachments: existing?.attachments || [],
      emailDraft: {
        ...(existing?.emailDraft || { subject: "", body: "" }),
        emailAttachments: normalizeAttachments(state.emailAttachments.length ? state.emailAttachments : existing?.emailDraft?.emailAttachments)
      },
      followUpStatus: existing?.followUpStatus || "open",
      nextFollowUpDate: existing?.nextFollowUpDate || "",
      lastContactDate: existing?.lastContactDate || "",
      lastAnalyzedAt: existing?.lastAnalyzedAt || "",
      isManuallyReviewed: Boolean(existing?.isManuallyReviewed),
      manualOverride: existing?.manualOverride || null,
      notes: normalizeText(dom.businessNotes.value),
      socialMedia: { instagram: normalizeUrl(dom.instagram.value), facebook: normalizeUrl(dom.facebook.value) },
      manualWebsiteSummary: normalizeText(dom.manualWebsiteSummary.value),
      websiteExtract: normalizeText(dom.websiteExtract.value),
      emailPurpose: dom.emailPurpose.value,
      createdAt: existing?.createdAt || new Date().toISOString()
    };
  }

  function fillAnalysisForm(customer) {
    state.currentCustomerId = customer.id || "";
    dom.companyName.value = customer.companyName || "";
    dom.website.value = customer.website || "";
    dom.contactName.value = customer.contactName || "";
    dom.contactEmail.value = customer.contactEmail || "";
    dom.country.value = customer.country || "";
    dom.city.value = customer.city || "";
    dom.industry.value = customer.industry || "";
    dom.instagram.value = customer.socialMedia?.instagram || "";
    dom.facebook.value = customer.socialMedia?.facebook || "";
    dom.businessNotes.value = customer.notes || "";
    dom.manualWebsiteSummary.value = customer.manualWebsiteSummary || "";
    dom.websiteExtract.value = customer.websiteExtract || "";
    dom.emailPurpose.value = customer.emailPurpose || (customer.customerType === "existing" ? "Existing Customer Update" : "First Touch");
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

  async function fetchWebsite() {
    const url = normalizeUrl(dom.website.value);
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
    dom.websiteExtract.value = payload.content || "";
    UI.toast("Website fetched and extract filled.", "good");
    return payload.content || "";
  }

  async function runAnalysis({ autoFetch = true, save = false, customerOverride = null } = {}) {
    let customer = customerOverride || formCustomer();
    if (!customer.companyName && customer.website) customer.companyName = customer.website.replace(/^https?:\/\/(www\.)?/i, "").split(/[/.]/)[0];
    if (!customer.companyName && !customer.website && !customer.manualWebsiteSummary && !customer.websiteExtract) {
      UI.toast("Please enter company, website, or evidence text.", "warn");
      return null;
    }
    if (autoFetch && customer.website && !customer.websiteExtract && !customer.manualWebsiteSummary) {
      const content = await fetchWebsite().catch((error) => {
        DB.addErrorLog("抓取官網", error, customer);
        UI.renderErrorLogs();
        return "";
      });
      customer.websiteExtract = content || customer.websiteExtract;
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
    customer = {
      ...customer,
      rating: analysis.rating,
      scores: analysis.scores,
      businessSignals: analysis.businessSignals,
      recommendedProducts,
      emailDraft: { ...emailDraft, emailAttachments: normalizeAttachments(customer.emailDraft?.emailAttachments || state.emailAttachments) },
      lastAnalyzedAt: new Date().toISOString(),
      suggestedAction: suggestAction({ ...customer, ...analysis }),
      websiteExtract: customer.websiteExtract || dom.websiteExtract.value
    };
    if (customer.manualOverride) {
      customer.rating = customer.manualOverride.rating;
      customer.isManuallyReviewed = true;
    }
    DB.addAnalysisHistory(customer.id, customer);
    state.currentAnalysis = analysis;
    state.currentCustomerId = customer.id;
    UI.renderAnalysisResult(customer, analysis);
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
    dom.productDialogTitle.textContent = product ? "編輯產品" : "新增產品";
    dom.productId.value = product?.id || "";
    dom.productName.value = product?.name || "";
    dom.productCategory.value = product?.category || "";
    dom.productStatus.value = product?.status || "Active";
    dom.productInPool.checked = Boolean(product?.inRecommendationPool);
    dom.productPriority.checked = Boolean(product?.isPriority);
    dom.productPriorityNumber.value = product?.priority ?? "";
    dom.productSku.value = product?.sku || "";
    dom.productDescription.value = product?.description || "";
    dom.productPrice.value = product?.price ?? "";
    dom.productUrl.value = product?.productUrl || "";
    dom.productLaunchDate.value = product?.launchDate || "";
    dom.productDialog.showModal();
  }

  function saveProductFromDialog() {
    const products = DB.getProducts();
    const product = {
      id: dom.productId.value || uid("prod"),
      name: normalizeText(dom.productName.value),
      category: normalizeText(dom.productCategory.value),
      status: dom.productStatus.value,
      inRecommendationPool: dom.productInPool.checked,
      isPriority: dom.productPriority.checked,
      priority: parseNumber(dom.productPriorityNumber.value, ""),
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
    dom.customerDialogTitle.textContent = customer ? "編輯客戶" : "新增客戶";
    dom.customerId.value = customer?.id || "";
    dom.dialogCompanyName.value = customer?.companyName || "";
    dom.dialogWebsite.value = customer?.website || "";
    dom.dialogContactName.value = customer?.contactName || "";
    dom.dialogContactEmail.value = customer?.contactEmail || "";
    dom.dialogCountry.value = customer?.country || "";
    dom.dialogCustomerType.value = customer?.customerType || "prospect";
    dom.dialogFollowStatus.value = customer?.followUpStatus || "open";
    dom.dialogNextFollowDate.value = customer?.nextFollowUpDate || "";
    dom.customerDialog.showModal();
  }

  function saveCustomerFromDialog() {
    const existing = DB.getCustomers().find((item) => item.id === dom.customerId.value);
    const customer = {
      ...(existing || normalizeImportedCustomer({})),
      id: dom.customerId.value || uid("cust"),
      companyName: normalizeText(dom.dialogCompanyName.value),
      website: normalizeUrl(dom.dialogWebsite.value),
      contactName: normalizeText(dom.dialogContactName.value),
      contactEmail: normalizeText(dom.dialogContactEmail.value),
      country: normalizeText(dom.dialogCountry.value),
      customerType: dom.dialogCustomerType.value,
      followUpStatus: dom.dialogFollowStatus.value,
      nextFollowUpDate: dom.dialogNextFollowDate.value,
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    upsertCustomer(customer);
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
      customers[index].lastContactDate = log.logDate;
      customers[index].emailHistory = customers[index].emailHistory || [];
      customers[index].emailHistory.unshift({ subject: log.subject, summary: log.summary, emailAttachments: normalizeAttachments(attachments), createdAt: log.createdAt });
      customers[index].emailHistory = customers[index].emailHistory.slice(0, 10);
      DB.setCustomers(customers);
    }
  }

  function textToHtml(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
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

  async function sendCurrentEmail() {
    if (!state.currentAnalysis && !state.currentCustomerId) {
      UI.toast("Run analysis first.", "warn");
      return;
    }

    const customer = DB.getCustomers().find((item) => item.id === state.currentCustomerId) || formCustomer();
    const to = normalizeText(customer.contactEmail || dom.contactEmail.value);
    const subject = normalizeText(dom.templateSubject.value || state.currentAnalysis?.emailDraft?.subject || "");
    const attachments = normalizeAttachments(state.emailAttachments);
    const rawBody = normalizeText(dom.templateBody.value || state.currentAnalysis?.emailDraft?.body || "");
    const body = rawBody.split("{{emailAttachments}}").join(formatAttachmentText(attachments) || "No attachments or links.");

    if (!to) throw new Error("Missing customer email.");
    if (!subject || !body) throw new Error("Missing email subject or body.");

    const originalText = dom.sendEmailBtn.textContent;
    dom.sendEmailBtn.disabled = true;
    dom.sendEmailBtn.textContent = "發送中...";

    try {
      const response = await fetch(`${API_BASE}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          html: textToHtml(renderEmailBody(body, attachments)),
          attachments: []
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Send email failed.");

      addEmailSentLog(customer, subject, payload.messageId || "", attachments);
      UI.renderTimeline(customer.id);
      UI.refreshAll();
      UI.toast("✅ 郵件已成功發送！", "good");
    } finally {
      dom.sendEmailBtn.textContent = originalText;
      dom.sendEmailBtn.disabled = false;
    }
  }

  async function bulkAnalyze(customers) {
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

  function bulkDeleteSelected() {
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

  function saveTemplate() {
    const templates = DB.getTemplates();
    const purpose = dom.templatePurpose.value;
    templates[purposeKey(purpose)] = {
      purpose,
      subject: dom.templateSubject.value,
      body: dom.templateBody.value,
      emailAttachments: normalizeAttachments(state.emailAttachments)
    };
    DB.setTemplates(templates);
    UI.toast("Template saved.", "good");
  }

  function previewTemplate() {
    const customer = formCustomer();
    const analysis = state.currentAnalysis || { recommendedProducts: [], businessSignals: [], rating: "NR", totalScore: 0 };
    const rendered = EmailEngine.renderTemplate(
      { subject: dom.templateSubject.value, body: dom.templateBody.value },
      EmailEngine.variables(customer, analysis)
    );
    const attachments = normalizeAttachments(state.emailAttachments);
    dom.emailPreview.textContent = renderEmailText(rendered.subject, rendered.body, attachments);
    if (state.currentAnalysis) state.currentAnalysis.emailDraft = { ...rendered, emailAttachments: attachments };
    UI.toast("Template preview rendered.", "good");
  }

  function exportBackup() {
    const snapshot = DB.backup("manual_export");
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    downloadBlob(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }), `phottix_backup_${stamp}.json`);
    UI.toast("Backup JSON exported.", "good");
  }

  async function importBackup(file) {
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

    async function refreshImportFiles() {
      const payload = await ExcelHandler.listImportFiles();
      const files = payload.files || [];
      const options = files.length
        ? files.map((file, index) => `<option value="${escapeHtml(file)}">${index + 1}. ${escapeHtml(file)}</option>`).join("")
        : `<option value="">No Excel files found</option>`;
      const listHtml = files.length
        ? files.map((file, index) => `<button class="excel-file-item" type="button" data-file-index="${index + 1}">${index + 1}. ${escapeHtml(file)}</button>`).join("")
        : `<div class="empty">No Excel files found.</div>`;
      dom.customerImportFileSelect.innerHTML = options;
      dom.productImportFileSelect.innerHTML = options;
      if (dom.excelFileList) dom.excelFileList.innerHTML = listHtml;
      if (dom.productExcelFileList) dom.productExcelFileList.innerHTML = listHtml;
      if (files.length && !dom.customerImportIndex.value) dom.customerImportIndex.value = "1";
      if (files.length && !dom.productImportIndex.value) dom.productImportIndex.value = "1";
      UI.toast(`Excel files: ${files.length}`, files.length ? "good" : "warn");
  }

  function bindDom() {
    [
      "todayFollowCount", "todayFollowList", "toast", "pageTitle", "pageSubtitle",
      "overdueFollowCount", "dueTodayFollowCount", "statsSummary", "errorLogList", "clearErrorLogsBtn",
      "loadCustomerSelect", "companyName", "website", "contactName", "contactEmail", "country", "city", "industry",
      "instagram", "facebook", "emailPurpose", "businessNotes", "manualWebsiteSummary", "websiteExtract",
      "fetchWebsiteBtn", "runAnalysisBtn", "saveCustomerBtn", "clearAnalysisBtn", "staleBanner",
      "templatePurpose", "templateSubject", "templateBody", "attachmentType", "attachmentName", "attachmentUrl",
      "addAttachmentBtn", "attachmentFileInput", "attachmentList", "previewTemplateBtn", "saveTemplateBtn",
      "analysisResult", "manualOverrideBtn", "companyInfoTable", "ratingHero", "fourScores", "signalTags",
      "scoringBreakdown", "recommendedProducts", "actionSuggestions", "copyEmailBtn", "sendEmailBtn", "emailPreview",
      "addLogBtn", "timeline", "analysisHistory", "addProductBtn", "importProductsBtn", "productImportFileSelect", "productImportIndex", "productSearch",
      "productView", "productTable", "addCustomerBtn", "importCustomersBtn", "importUpdateBtn",
      "exportCustomersBtn", "customerImportFileSelect", "customerImportIndex", "importCustomersConfigBtn", "excelFileList", "productExcelFileList", "customerTypeFilter", "ratingFilter",
      "followStatusFilter", "customerSearch", "selectAllCustomers", "bulkAnalyzeSelectedBtn",
      "bulkAnalyzeAllBtn", "bulkDeleteBtn", "bulkConvertBtn", "bulkFollowStatus", "bulkNextFollowDate", "bulkProgressBar", "bulkProgressText", "customerList", "backupExportBtn",
      "backupImportBtn", "backupFileInput", "productDialog", "productForm", "productDialogTitle",
      "productId", "productName", "productCategory", "productStatus", "productInPool", "productPriority",
      "productPriorityNumber", "productSku", "productDescription", "productPrice", "productUrl", "productLaunchDate",
      "saveProductDialogBtn", "customerDialog", "customerForm", "customerDialogTitle", "customerId",
      "dialogCompanyName", "dialogWebsite", "dialogContactName", "dialogContactEmail", "dialogCountry",
      "dialogCustomerType", "dialogFollowStatus", "dialogNextFollowDate", "saveCustomerDialogBtn",
      "overrideDialog", "overrideForm", "overrideRating", "overrideReason", "saveOverrideBtn",
      "logDialog", "logForm", "logCustomerId", "logDate", "logChannel", "logContactPerson", "logSubject",
      "logSummary", "logResponse", "logNextAction", "logNextFollowDate", "saveLogBtn"
    ].forEach((id) => { dom[id] = $(id); });
  }

  function bindEvents() {
    document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => UI.showPage(button.dataset.page)));
    dom.fetchWebsiteBtn.addEventListener("click", () => fetchWebsite().catch((error) => UI.toast(error.message, "bad")));
    dom.runAnalysisBtn.addEventListener("click", () => runAnalysis().catch((error) => UI.toast(error.message, "bad")));
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
      document.getElementById("analysisForm").reset();
      dom.analysisResult.classList.add("hidden");
      dom.sendEmailBtn.disabled = true;
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
    dom.copyEmailBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(dom.emailPreview.textContent || "");
      UI.toast("Email copied.", "good");
    });
    dom.sendEmailBtn.addEventListener("click", () => sendCurrentEmail().catch((error) => {
      DB.addErrorLog("發送郵件", error, formCustomer());
      UI.refreshAll();
      UI.toast(`❌ 發送失敗：${error.message}`, "bad");
    }));
    dom.manualOverrideBtn.addEventListener("click", () => {
      if (!state.currentCustomerId && !state.currentAnalysis) return UI.toast("Run analysis first.", "warn");
      dom.overrideReason.value = "";
      dom.overrideRating.value = state.currentAnalysis?.rating || "B";
      dom.overrideDialog.showModal();
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
    dom.saveTemplateBtn.addEventListener("click", saveTemplate);
    dom.previewTemplateBtn.addEventListener("click", previewTemplate);
    dom.addAttachmentBtn?.addEventListener("click", addAttachmentFromEditor);
    [dom.attachmentName, dom.attachmentUrl].forEach((input) => input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addAttachmentFromEditor();
    }));
    dom.addProductBtn.addEventListener("click", () => openProductDialog());
    dom.saveProductDialogBtn.addEventListener("click", saveProductFromDialog);
    dom.importProductsBtn.addEventListener("click", () => ExcelHandler.importProductsFromConfig().catch((error) => {
      DB.addErrorLog("導入 config 產品 Excel", error);
      UI.refreshAll();
      UI.toast(error.message, "bad");
    }));
    dom.productSearch.addEventListener("input", () => UI.renderProductList());
    dom.productView.addEventListener("change", () => UI.renderProductList());
    dom.addCustomerBtn.addEventListener("click", () => openCustomerDialog());
    dom.saveCustomerDialogBtn.addEventListener("click", saveCustomerFromDialog);
    dom.importCustomersBtn.addEventListener("click", () => refreshImportFiles().catch((error) => {
      DB.addErrorLog("列出導入文件", error);
      UI.refreshAll();
      UI.toast(error.message, "bad");
    }));
    dom.customerImportFileSelect.addEventListener("change", () => {
      dom.customerImportIndex.value = String(dom.customerImportFileSelect.selectedIndex + 1);
    });
    dom.productImportFileSelect.addEventListener("change", () => {
      dom.productImportIndex.value = String(dom.productImportFileSelect.selectedIndex + 1);
    });
    dom.excelFileList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-file-index]");
      if (!button) return;
      dom.customerImportIndex.value = button.dataset.fileIndex;
      dom.customerImportFileSelect.selectedIndex = Number(button.dataset.fileIndex) - 1;
    });
    dom.productExcelFileList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-file-index]");
      if (!button) return;
      dom.productImportIndex.value = button.dataset.fileIndex;
      dom.productImportFileSelect.selectedIndex = Number(button.dataset.fileIndex) - 1;
    });
    dom.importCustomersConfigBtn.addEventListener("click", () => ExcelHandler.importCustomersFromConfig().catch((error) => {
      DB.addErrorLog("導入 config Excel", error);
      UI.refreshAll();
      UI.toast(error.message, "bad");
    }));
    dom.importUpdateBtn.addEventListener("click", () => ExcelHandler.importUpdateFromConfig().catch((error) => {
      DB.addErrorLog("匯入 config 更新 Excel", error);
      UI.refreshAll();
      UI.toast(error.message, "bad");
    }));
    dom.exportCustomersBtn.addEventListener("click", () => ExcelHandler.exportCustomers().catch((error) => {
      DB.addErrorLog("導出 Excel", error);
      UI.refreshAll();
      UI.toast(error.message, "bad");
    }));
    [dom.customerTypeFilter, dom.ratingFilter, dom.followStatusFilter, dom.customerSearch].forEach((item) => item.addEventListener("input", () => UI.renderCustomerList()));
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
    dom.bulkFollowStatus.addEventListener("change", bulkUpdateFollowUpSelected);
    dom.bulkNextFollowDate.addEventListener("change", bulkUpdateFollowUpSelected);
    dom.backupExportBtn.addEventListener("click", exportBackup);
    dom.backupImportBtn.addEventListener("click", () => dom.backupFileInput.click());
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
      if (action === "add-log") openLogDialog(id);
      if (action === "copy-log-email") {
        const log = DB.getLogs()[id];
        if (log) {
          navigator.clipboard.writeText(`Subject: ${log.subject || ""}\n\n${log.summary || ""}`);
          UI.toast("Historical email copied.", "good");
        }
      }
      if (action === "remove-attachment") {
        state.emailAttachments = normalizeAttachments(state.emailAttachments).filter((item) => item.id !== id);
        UI.renderAttachmentList();
        previewTemplate();
      }
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      const action = target.dataset?.action;
      const id = target.dataset?.id;
      if (!action || !id) return;
      if (action === "toggle-product-pool" || action === "toggle-product-priority") {
        const products = DB.getProducts().map((item) => {
          if (item.id !== id) return item;
          if (action === "toggle-product-pool") return { ...item, inRecommendationPool: target.checked };
          return { ...item, isPriority: target.checked, priority: target.checked && !item.priority ? 1 : item.priority };
        });
        DB.setProducts(products);
        UI.renderProductList();
      }
      if (action === "select-customer") {
        if (target.checked) state.selectedCustomerIds.add(id);
        else state.selectedCustomerIds.delete(id);
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
    UI.toast("Loading shared database...", "warn");
    await DB.initSharedStore();
    DB.getProducts();
    DB.getTemplates();
    dom.templatePurpose.innerHTML = EMAIL_PURPOSES.map((purpose) => `<option>${purpose}</option>`).join("");
    bindEvents();
    UI.refreshAll();
    refreshImportFiles().catch((error) => {
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

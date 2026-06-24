(function () {
  "use strict";

  const API_BASE = location.protocol === "file:" ? "http://127.0.0.1:8787" : location.origin;
  const STORAGE_KEYS = {
    prospects: "phottix.customerAgent.prospects.v2",
    customers: "phottix.customerAgent.customers.v2",
    products: "phottix.customerAgent.products.v2",
    productSource: "phottix.customerAgent.products.source.v2"
  };

  const DEFAULT_PRODUCTS = [
    { category: "Lighting", name: "Phottix Kali50Ra RGB LED Light", description: "Compact RGB LED with DMX-style control and high-CRI output.", tags: "rgb, led, dmx, studio, location" },
    { category: "Lighting", name: "Phottix X160 COB LED Light", description: "High-output Bowens-mount COB light for pro photo/video setups.", tags: "cob, bowens, daylight, studio" },
    { category: "Lighting", name: "Phottix X600 COB LED Light", description: "High-power COB light for demanding studio and location work.", tags: "cob, bowens, daylight, video" },
    { category: "Lighting", name: "Phottix M200R RGB Panel", description: "Compact RGB panel for creators, interviews, and livestreams.", tags: "rgb, panel, creator, livestream" },
    { category: "Lighting", name: "Phottix M500R RGB Panel", description: "Larger RGB panel for production, studio, and content work.", tags: "rgb, panel, studio, video" },
    { category: "Modifiers", name: "Phottix G-Capsule Softbox 85cm", description: "Quick-collapse softbox with no-rod setup.", tags: "softbox, modifier, quick open" },
    { category: "Modifiers", name: "Phottix G-Capsule Softbox 105cm", description: "Premium modifier for retail bundles and studio kits.", tags: "softbox, modifier, quick open" },
    { category: "Modifiers", name: "Phottix Octa Softbox", description: "Classic light modifier for portrait and video lighting.", tags: "softbox, portrait, video" },
    { category: "Flash & Trigger", name: "Phottix Odin II TTL Flash Trigger", description: "Reliable wireless trigger for flash systems.", tags: "flash, trigger, ttl, wireless" },
    { category: "Flash & Trigger", name: "Phottix Mitros+ TTL Flash", description: "TTL flash for photographers and retail demo bundles.", tags: "flash, ttl, speedlight" },
    { category: "Flash & Trigger", name: "Phottix Juno Flash", description: "Entry-level flash option for retail and content creator channels.", tags: "flash, entry, speedlight" },
    { category: "Support & Accessories", name: "Phottix Light Stand", description: "Core support item for lighting bundles.", tags: "stand, support, lighting" },
    { category: "Support & Accessories", name: "Phottix Boom Arm", description: "Useful for overhead and studio lighting setups.", tags: "boom, arm, studio" },
    { category: "Support & Accessories", name: "Phottix Super Clamp", description: "Flexible mount for content creators and studio use.", tags: "clamp, mount, accessory" },
    { category: "Support & Accessories", name: "Phottix Sandbag", description: "Practical stabilizer for retail and studio kits.", tags: "sandbag, safety, support" },
    { category: "Power & Video", name: "Phottix USB-C Power Kit", description: "Power and charging accessory for mobile video workflows.", tags: "power, usb-c, video" },
    { category: "Power & Video", name: "Phottix Battery Plate Kit", description: "Battery power accessory for portable lighting setups.", tags: "battery, power, mobile" },
    { category: "Power & Video", name: "Phottix Video Accessory Kit", description: "Bundle-style accessory package for creator channels.", tags: "video, creator, accessory" }
  ];

  const CATEGORY_DEFS = [
    { id: "wholesale", label: "Wholesale / 批发经销", cap: 35, rules: [
      { label: "批发采购证据 / Wholesale buying", points: 15, terms: [/\bwholesale\b/i, /\bwholesaler\b/i, /\bbulk\b/i, /\bb2b\b/i, /\btrade pricing\b/i, /\btrade account\b/i] },
      { label: "经销商证据 / Distributor or dealer", points: 12, terms: [/\bdistributor\b/i, /\bdistribution\b/i, /\bdealer\b/i, /\breseller\b/i, /\bauthorized dealer\b/i, /\bdealer application\b/i] },
      { label: "商业账户证据 / Business account", points: 8, terms: [/exclusive distributor/i, /master distributor/i, /official distributor/i, /\bchannel partner\b/i, /\bbusiness account\b/i, /\bcommercial account\b/i] }
    ]},
    { id: "retail", label: "Retail / 零售经销", cap: 32, rules: [
      { label: "店铺销售证据 / Shop or store", points: 10, terms: [/\bretail\b/i, /\bretailer\b/i, /\bsales\b/i, /\bshop\b/i, /\bstore\b/i, /\bsuperstore\b/i] },
      { label: "产品销售页面 / Product sales page", points: 10, terms: [/shop now/i, /\bshop\b/i, /order prints/i, /photo products/i, /view shop/i, /product catalog/i, /products/i] },
      { label: "门店或展厅 / Storefront or showroom", points: 6, terms: [/showroom/i, /sales floor/i, /in-store/i, /walk[- ]?in/i, /pickup/i, /get in touch/i] },
      { label: "在线购买 / Online purchasing", points: 6, terms: [/buy now/i, /order now/i, /buy online/i, /order online/i, /add to cart/i, /checkout/i, /shopping_cart/i] }
    ]},
    { id: "photoVideoRetail", label: "Photo & Video Retail / 摄影与视频器材零售", cap: 34, rules: [
      { label: "摄影/视频产品 / Photo or video products", points: 12, terms: [/photo products/i, /photo(?:graphy)? gear/i, /video gear/i, /camera gear/i, /imaging equipment/i, /lighting equipment/i, /photo equipment/i, /video equipment/i] },
      { label: "摄影相关文字 / Photo-video wording", points: 10, terms: [/\bcameras?\b/i, /\bphoto\b/i, /\bphotography\b/i, /\bvideo\b/i, /\bimaging\b/i] },
      { label: "器材配件 / Gear accessories", points: 8, terms: [/\blens(?:es)?\b/i, /\btripods?\b/i, /\bflash\b/i, /\blight(?:ing)?\b/i, /\bmodifier\b/i, /\baccessor(?:y|ies)\b/i, /\bfilter\b/i, /\bmic\b/i] },
      { label: "专业影像 / Professional imaging", points: 4, terms: [/broadcast/i, /cinema/i, /production equipment/i, /studio equipment/i, /mirrorless/i, /dslr/i, /camera brands?/i] }
    ]},
    { id: "cameraStore", label: "Camera Store / 相机店", cap: 24, rules: [
      { label: "相机店文字 / Camera store wording", points: 10, terms: [/camera store/i, /camera shop/i, /photo store/i, /camera center/i, /camera centre/i, /imaging store/i, /camera department/i] },
      { label: "专业相机零售 / Specialist camera retailer", points: 8, terms: [/digital camera/i, /camera expert/i, /photo video store/i, /camera and photo/i, /camera & photo/i] },
      { label: "相机/摄影目录 / Camera or photo catalog", points: 6, terms: [/camera brands?/i, /lenses?/i, /tripods?/i, /lighting/i, /photography/i, /photo products/i] }
    ]},
    { id: "physicalStore", label: "Physical Store / 实体门店", cap: 20, rules: [
      { label: "地址/电话 / Address or phone", points: 8, terms: [/address/i, /get in touch/i, /\bcontact\b/i, /\bphone\b/i, /\(\d{3}\)\s*\d{3}[-\s]?\d{4}/i, /\b[A-Z]{2}\s+\d{5}\b/] },
      { label: "营业时间/位置 / Hours or location", points: 8, terms: [/visit us/i, /store hours/i, /business hours/i, /opening hours/i, /directions/i, /find us/i, /our location/i] },
      { label: "多门店 / Multiple locations", points: 4, terms: [/multiple locations/i, /\bbranches?\b/i, /\blocations?\b/i, /pickup store/i, /superstore/i, /super store/i] }
    ]},
    { id: "onlineShop", label: "Online Shop / 线上商店", cap: 20, rules: [
      { label: "购物车/结账 / Cart or checkout", points: 10, terms: [/add to cart/i, /\bcart\b/i, /checkout/i, /shopping cart/i, /shopping_cart/i] },
      { label: "电商文字 / E-commerce wording", points: 6, terms: [/online store/i, /shop online/i, /buy online/i, /shipping/i, /free shipping/i, /order online/i, /our online shop/i] },
      { label: "在线下单路径 / Online order path", points: 4, terms: [/order prints/i, /view shop/i, /sign in/i, /register/i, /account details/i] }
    ]},
    { id: "studio", label: "Studio / 工作室", cap: 14, rules: [
      { label: "工作室证据 / Studio signal", points: 8, terms: [/photo studio/i, /video studio/i, /portrait studio/i, /production studio/i, /studio rental/i, /rental studio/i, /in-house studio/i] },
      { label: "影棚环境 / Studio lighting setup", points: 6, terms: [/studio lighting/i, /backdrop/i, /lighting setup/i, /portrait sessions?/i, /commercial studio/i] }
    ]},
    { id: "services", label: "Services / 服务型业务", cap: 12, rules: [
      { label: "租赁/维修/服务 / Rental or service", points: 7, terms: [/rental/i, /repair/i, /calibration/i, /installation/i, /support center/i, /service center/i, /maintenance/i, /services/i] },
      { label: "培训/支持 / Training or support", points: 5, terms: [/consulting/i, /support/i, /training/i, /custom solution/i, /classes?/i] }
    ]},
    { id: "eventsEducation", label: "Events & Education / 活动教育", cap: 12, rules: [
      { label: "课程/活动 / Classes or events", points: 12, terms: [/workshop/i, /seminar/i, /class/i, /course/i, /academy/i, /training/i, /education/i, /demo day/i, /webinar/i, /event/i, /lesson/i] }
    ]},
    { id: "creator", label: "Creator / 内容创作", cap: 12, rules: [
      { label: "创作者证据 / Creator signal", points: 7, terms: [/content creator/i, /\bcreator\b/i, /vlogger/i, /filmmaker/i, /photographer/i, /videographer/i, /influencer/i] },
      { label: "社媒内容 / Social content", points: 5, terms: [/youtube/i, /tiktok/i, /livestream/i, /live stream/i, /social content/i, /streaming/i, /podcast/i] }
    ]}
  ];

  const PRIORITY_ORDER = [
    "wholesale", "retail", "photoVideoRetail", "cameraStore", "onlineShop",
    "physicalStore", "studio", "services", "eventsEducation", "creator"
  ];

  const RATING_BANDS = [
    { grade: "A", min: 70, label: "A 级：核心零售 / 批发 / 经销 / 线上商店信号明确，适合优先深度开发。" },
    { grade: "B", min: 40, label: "B 级：有较明确相关业务，但仍需更清晰的切入点与证据。" },
    { grade: "C", min: 25, label: "C 级：只出现部分相关信号，适合简洁切入。" },
    { grade: "D", min: 0, label: "D 级：相关信号较弱，先补资料或做低频触达。" }
  ];

  const NOT_RATED_BAND = {
    grade: "NR",
    label: "未评级 / Not Rated：官网抓取受阻且没有足够有效正文，当前不能代表真实客户价值。"
  };

  const KNOWN_ACCOUNT_FALLBACKS = [
    {
      domainPattern: /(^|\.)bhphotovideo\.com$/i,
      grade: "A",
      score: 90,
      businessTypes: [
        "Retail / 零售经销",
        "Photo & Video Retail / 摄影与视频器材零售",
        "Camera Store / 相机店",
        "Online Shop / 线上商店"
      ],
      note: "B&H 是已知大型摄影、视频、灯光和专业器材零售商。官网抓取被阻挡时，按已知大客户优先处理。"
    }
  ];

  const MULTILINGUAL_TERMS = {
    wholesale: [/批发|批發|批發商|卸売|도매/i, /grossiste|vente en gros|großhandel|grosshandel|mayorista|al por mayor|atacado|revendedor|ingrosso/i],
    distributor: [/经销|經銷|代理商|分销|分銷|販売代理店|代理店|유통|대리점/i, /distributeur|distribuidor|distribuzione|vertrieb|händler|haendler|revendeur|revendedor|rivenditore/i],
    retail: [/零售|零售店|销售|銷售|門市|门市|小売|販売|매장|소매/i, /retail|retailer|shop|store|tienda|boutique|magasin|geschäft|geschaeft|negozio|loja|winkel/i],
    productSales: [/产品|產品|商品|购买|購買|下单|下單|注文|購入|제품|구매/i, /products?|catalog|catalogue|comprar|acheter|kaufen|acquista|compra|compras|comprar online|comprar ahora/i],
    storefront: [/展厅|展廳|门店|門店|店铺|店舖|店舗|ショールーム|매장/i, /showroom|in-store|pickup|recogida|retrait|abholung|ritiro|retirada/i],
    onlinePurchase: [/购物车|購物車|结账|結帳|在线购买|線上購買|カート|チェックアウト|장바구니|결제/i, /cart|checkout|buy online|order online|comprar online|panier|warenkorb|carrello|carrinho/i],
    photoVideoProducts: [/摄影器材|攝影器材|照相器材|相機器材|影像器材|视频器材|視頻器材|カメラ用品|撮影機材|사진 장비|영상 장비/i, /photo gear|video gear|camera gear|photo equipment|video equipment|matériel photo|materiel photo|equipo fotograf|equipo de video|fotografia|fotografía|fotografie|attrezzatura fotografica/i],
    photoVideoWords: [/相机|相機|摄影|攝影|照片|写真|カメラ|撮影|写真機|카메라|사진|촬영/i, /camera|photo|photography|video|imaging|caméra|camera|kamera|fotocamera|cámara|camara|fotografía|photographie|fotografie|fotografia/i],
    gearAccessories: [/镜头|鏡頭|三脚架|三腳架|闪光灯|閃光燈|灯光|燈光|配件|フィルター|レンズ|三脚|照明|렌즈|삼각대|조명/i, /lens|lenses|tripod|flash|lighting|modifier|accessor|filter|mic|objectif|trépied|trepied|blitz|beleuchtung|objektiv|zubehör|zubehor|accesorios|acessórios|accessori/i],
    proImaging: [/广播|廣播|电影|電影|影视|影視|影棚设备|プロ映像|방송|영화/i, /broadcast|cinema|production equipment|studio equipment|mirrorless|dslr|cine|cinéma|kino|producción|produccion|produção|producao/i],
    cameraStore: [/相机店|相機店|摄影店|攝影店|カメラ店|写真店|카메라 매장/i, /camera store|camera shop|photo store|camera center|camera centre|imaging store|tienda de cámaras|tienda de camaras|magasin photo|fotogeschäft|fotogeschaeft|negozio fotografico/i],
    physicalAddress: [/地址|電話|电话|联系我们|聯絡我們|营业时间|營業時間|所在地|住所|営業時間|연락처|주소/i, /address|contact|phone|opening hours|business hours|store hours|directions|adresse|kontakt|telefono|teléfono|horario|indirizzo|telefone|horário|horario/i],
    multipleLocations: [/分店|门店|門店|多家店|店舗|支店|지점/i, /multiple locations|branches|locations|filiales|succursales|sucursales|lojas|negozi/i],
    studio: [/工作室|影棚|摄影棚|攝影棚|スタジオ|스튜디오/i, /studio|photo studio|video studio|portrait studio|production studio|studio rental|rental studio|estudio|atelier|fotostudio/i],
    service: [/租赁|租賃|出租|维修|維修|服务|服務|修理|レンタル|수리|대여/i, /rental|repair|calibration|installation|service center|maintenance|location|réparation|reparation|reparación|reparacion|reparatur|noleggio|aluguel|assistência|assistencia/i],
    training: [/培训|培訓|课程|課程|课堂|課堂|讲座|講座|教室|ワークショップ|세미나|교육/i, /workshop|seminar|class|course|academy|training|education|demo day|webinar|event|lesson|curso|cours|formation|schulung|corso|aula/i],
    creator: [/创作者|創作者|内容创作|內容創作|摄影师|攝影師|视频博主|クリエイター|写真家|크리에이터/i, /content creator|creator|vlogger|filmmaker|photographer|videographer|influencer|créateur|createur|fotógrafo|fotografo|fotograf|videomaker/i],
    social: [/直播|播客|社交媒体|社交媒體|YouTube|TikTok|ライブ配信|라이브/i, /youtube|tiktok|livestream|live stream|social content|streaming|podcast|réseaux sociaux|redes sociales|soziale medien/i]
  };

  function terms(...groups) {
    return groups.flatMap((group) => MULTILINGUAL_TERMS[group] || []);
  }

  function addTerms(categoryId, ruleIndex, ...groups) {
    const category = CATEGORY_DEFS.find((item) => item.id === categoryId);
    if (!category || !category.rules[ruleIndex]) return;
    category.rules[ruleIndex].terms = category.rules[ruleIndex].terms.concat(terms(...groups));
  }

  addTerms("wholesale", 0, "wholesale");
  addTerms("wholesale", 1, "distributor");
  addTerms("wholesale", 2, "wholesale", "distributor");
  addTerms("retail", 0, "retail");
  addTerms("retail", 1, "productSales");
  addTerms("retail", 2, "storefront");
  addTerms("retail", 3, "onlinePurchase");
  addTerms("photoVideoRetail", 0, "photoVideoProducts");
  addTerms("photoVideoRetail", 1, "photoVideoWords");
  addTerms("photoVideoRetail", 2, "gearAccessories");
  addTerms("photoVideoRetail", 3, "proImaging");
  addTerms("cameraStore", 0, "cameraStore");
  addTerms("cameraStore", 1, "cameraStore", "photoVideoWords");
  addTerms("cameraStore", 2, "photoVideoWords", "gearAccessories");
  addTerms("physicalStore", 0, "physicalAddress");
  addTerms("physicalStore", 1, "physicalAddress");
  addTerms("physicalStore", 2, "multipleLocations");
  addTerms("onlineShop", 0, "onlinePurchase");
  addTerms("onlineShop", 1, "onlinePurchase", "productSales");
  addTerms("onlineShop", 2, "onlinePurchase", "productSales");
  addTerms("studio", 0, "studio");
  addTerms("studio", 1, "studio", "gearAccessories");
  addTerms("services", 0, "service");
  addTerms("services", 1, "training");
  addTerms("eventsEducation", 0, "training");
  addTerms("creator", 0, "creator");
  addTerms("creator", 1, "social");

  const DOM = {
    tabs: Array.from(document.querySelectorAll(".module-tab")),
    moduleSections: Array.from(document.querySelectorAll("[data-module-section]")),
    analysisResultPanel: document.getElementById("analysisResultPanel"),
    resultArea: document.getElementById("resultArea"),
    resultStatus: document.getElementById("resultStatus"),
    companyTable: document.getElementById("companyTable"),
    keyDecisionRating: document.getElementById("keyDecisionRating"),
    keyDecisionFocus: document.getElementById("keyDecisionFocus"),
    judgingStandardList: document.getElementById("judgingStandardList"),
    scopeList: document.getElementById("scopeList"),
    ratingList: document.getElementById("ratingList"),
    signalSummary: document.getElementById("signalSummary"),
    dealerProducts: document.getElementById("dealerProducts"),
    endUserProducts: document.getElementById("endUserProducts"),
    emailPreview: document.getElementById("emailPreview"),
    suggestionList: document.getElementById("suggestionList"),
    productLibrary: document.querySelector("[data-product-library]"),
    agentForm: document.getElementById("agentForm"),
    companyName: document.getElementById("companyName"),
    contactName: document.getElementById("contactName"),
    website: document.getElementById("website"),
    city: document.getElementById("city"),
    instagramUrl: document.getElementById("instagramUrl"),
    facebookUrl: document.getElementById("facebookUrl"),
    businessNotes: document.getElementById("businessNotes"),
    sourceNotes: document.getElementById("sourceNotes"),
    generateBtn: document.getElementById("generateBtn"),
    saveBtn: document.getElementById("saveBtn"),
    copyReportBtn: document.getElementById("copyReportBtn"),
    copyEmailBtn: document.getElementById("copyEmailBtn"),
    exportBtn: document.getElementById("exportBtn"),
    resetBtn: document.getElementById("resetBtn"),
    fillDemoBtn: document.getElementById("fillDemoBtn"),
    prospectImportBtn: document.getElementById("prospectImportBtn"),
    prospectFileInput: document.getElementById("prospectFileInput"),
    customerImportBtn: document.getElementById("customerImportBtn"),
    customerFileInput: document.getElementById("customerFileInput"),
    prospectImportStatus: document.getElementById("prospectImportStatus"),
    customerImportStatus: document.getElementById("customerImportStatus"),
    prospectList: document.getElementById("prospectList"),
    customerList: document.getElementById("customerList")
  };

  const state = {
    currentAnalysis: null,
    activeRecord: { bucket: "prospects", id: null },
    prospects: loadStoredList(STORAGE_KEYS.prospects),
    customers: loadStoredList(STORAGE_KEYS.customers),
    products: loadStoredProducts(),
    productSource: loadStoredValue(STORAGE_KEYS.productSource) || "default",
    pendingStatuses: {
      prospects: "支持 company_name / website / city / contact_name / contact_email / instagram_url / facebook_url / business_notes / source_notes.",
      customers: "旧客户表独立管理，导入后也可以继续用同一套分析和开发信逻辑。",
      products: "产品库支持导入 Excel / CSV，导入后会自动按类别分组。"
    }
  };

  function loadStoredValue(key) {
    try { return localStorage.getItem(key) || ""; } catch { return ""; }
  }

  function loadStoredList(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveStoredList(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function saveStoredValue(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function makeId(prefix = "rec") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function splitLines(value) {
    return normalizeText(value)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeUrl(input) {
    const text = normalizeText(input);
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    if (/^www\./i.test(text)) return `https://${text}`;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(text)) return `https://${text}`;
    return "";
  }

  function cleanUrl(url) {
    return normalizeText(url).replace(/[),.;\]]+$/g, "");
  }

  function displayUrl(url) {
    if (!url) return "—";
    try { return new URL(url).href.replace(/^https?:\/\//i, ""); } catch { return url; }
  }

  function isBlockedExtraction(data) {
    if (data?.blocked) return true;
    const text = normalizeText([data?.title, data?.description, data?.body, data?.error, data?.blockReason].filter(Boolean).join(" \n")).toLowerCase();
    return /just a moment|captcha|cloudflare|access denied|security check|verify you are human|may be requiring captcha|robot check|blocked|status 403|403 forbidden|forbidden/i.test(text);
  }

  function cleanMirrorLines(text) {
    const rawLines = String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => normalizeText(line))
      .filter(Boolean);

    const cleaned = [];
    const seen = new Set();
    for (const line of rawLines) {
      const lower = line.toLowerCase();
      if (/^(title|url source|published time|description|markdown content|source):\s*/i.test(line)) continue;
      if (!seen.has(lower)) {
        seen.add(lower);
        cleaned.push(line);
      }
    }
    return cleaned;
  }

  function domainFromUrl(url) {
    if (!url) return "";
    try { return new URL(url).hostname.replace(/^www\./i, ""); } catch { return ""; }
  }

  function humanizeDomain(url) {
    const domain = domainFromUrl(url);
    if (!domain) return "";
    if (/^bhphotovideo\.com$/i.test(domain)) return "B&H Photo Video";
    return domain
      .replace(/^m\./i, "")
      .replace(/\.[^.]+$/, "")
      .split(/[.-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function matchesAny(text, terms) {
    return terms.some((term) => term.test(text));
  }

  function cleanEvidenceText(value, maxLength = 170) {
    let text = normalizeText(value)
      .replace(/<%[\s\S]*?%>/g, " ")
      .replace(/\b(?:account_circle|sentiment_very_satisfied|person_add|shopping_cart|settings|search close)\b/gi, " ")
      .replace(/\b(?:firstname|totalItem|isLogged)\b/gi, " ")
      .replace(/\b(?:Welcome back|View account details|Sign In|Register|Can we help find anything)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const noiseIndex = text.search(/Newsletter|Privacy Policy|Terms & Conditions|Accessibility|Powered by/i);
    if (noiseIndex > 80) text = text.slice(0, noiseIndex).trim();
    if (text.length > maxLength) text = `${text.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
    return text;
  }

  function isReadableEvidence(value) {
    const text = normalizeText(value);
    if (!text || text.length < 8) return false;
    if (/<%|%>|firstname|totalItem|isLogged/i.test(text)) return false;
    return true;
  }

  function firstMatchingLine(lines, terms) {
    for (const line of lines) {
      if (matchesAny(line, terms) && isReadableEvidence(line)) return cleanEvidenceText(line);
    }
    return "";
  }

  function dedupeLines(lines) {
    const out = [];
    const seen = new Set();
    for (const line of lines) {
      const key = normalizeText(line).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
    return out;
  }

  function getFormValues() {
    return {
      companyName: normalizeText(DOM.companyName.value),
      contactName: normalizeText(DOM.contactName.value),
      website: normalizeUrl(DOM.website.value),
      city: normalizeText(DOM.city.value),
      instagramUrl: normalizeUrl(DOM.instagramUrl.value),
      facebookUrl: normalizeUrl(DOM.facebookUrl.value),
      businessNotes: normalizeText(DOM.businessNotes.value),
      sourceNotes: normalizeText(DOM.sourceNotes.value)
    };
  }

  function setFormValues(record) {
    DOM.companyName.value = record.companyName || "";
    DOM.contactName.value = record.contactName || "";
    DOM.website.value = record.website || "";
    DOM.city.value = record.city || "";
    DOM.instagramUrl.value = record.instagramUrl || "";
    DOM.facebookUrl.value = record.facebookUrl || "";
    DOM.businessNotes.value = record.businessNotes || "";
    DOM.sourceNotes.value = record.sourceNotes || "";
  }

  function setStatus(message, tone = "") {
    if (!DOM.resultStatus) return;
    DOM.resultStatus.textContent = message;
    DOM.resultStatus.classList.remove("good", "warn", "bad");
    if (tone) DOM.resultStatus.classList.add(tone);
  }

  function setSaveButtonLabel() {
    if (!DOM.saveBtn) return;
    DOM.saveBtn.textContent = state.activeRecord.bucket === "customers"
      ? "更新旧客户 / Save Customer"
      : "保存到潜在客户 / Save Prospect";
  }

  function showAnalysisPanel(visible) {
    if (!DOM.analysisResultPanel || !DOM.resultArea) return;
    DOM.analysisResultPanel.classList.toggle("hidden", !visible);
    DOM.resultArea.classList.toggle("hidden", !visible);
  }

  function switchModule(moduleName) {
    DOM.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.module === moduleName));
    DOM.moduleSections.forEach((section) => section.classList.toggle("is-hidden", section.dataset.moduleSection !== moduleName));
    showAnalysisPanel(moduleName === "analysis" && Boolean(state.currentAnalysis));
  }

  function normalizeImportedRecord(row) {
    const normalized = {};
    for (const [key, value] of Object.entries(row || {})) normalized[String(key).toLowerCase()] = value;
    return {
      id: row.id || makeId("row"),
      companyName: normalizeText(row.companyName || normalized.company_name || normalized.company || normalized.name),
      contactName: normalizeText(row.contactName || normalized.contact_name || normalized.contact),
      contactEmail: normalizeText(row.contactEmail || normalized.contact_email || normalized.email),
      website: normalizeUrl(row.website || normalized.website || normalized.domain || normalized.url),
      city: normalizeText(row.city || normalized.city || normalized.country),
      instagramUrl: normalizeUrl(row.instagramUrl || normalized.instagram_url || normalized.instagram),
      facebookUrl: normalizeUrl(row.facebookUrl || normalized.facebook_url || normalized.facebook),
      businessNotes: normalizeText(row.businessNotes || normalized.business_notes || normalized.notes || normalized.business_note),
      sourceNotes: normalizeText(row.sourceNotes || normalized.source_notes || normalized.source_note),
      savedAt: row.savedAt || new Date().toISOString(),
      rating: normalizeText(row.rating || normalized.rating || ""),
      score: Number(row.score || normalized.score || 0) || 0,
      keyDecision: normalizeText(row.keyDecision || normalized.key_decision || ""),
      businessTypes: normalizeText(row.businessTypes || normalized.business_types || ""),
      bucket: row.bucket || normalized.bucket || "prospects",
      analysisSummary: normalizeText(row.analysisSummary || normalized.analysis_summary || "")
    };
  }

  function normalizeProductRecord(row) {
    const normalized = {};
    for (const [key, value] of Object.entries(row || {})) normalized[String(key).toLowerCase()] = value;
    return {
      id: row.id || makeId("prod"),
      category: normalizeText(row.category || normalized.category || "Uncategorized"),
      name: normalizeText(row.name || normalized.name || normalized.product_name || "Untitled Product"),
      description: normalizeText(row.description || normalized.description || ""),
      tags: normalizeText(row.tags || normalized.tags || ""),
      sku: normalizeText(row.sku || normalized.sku || ""),
      brand: normalizeText(row.brand || normalized.brand || ""),
      price: normalizeText(row.price || normalized.price || ""),
      sourceType: normalizeText(row.sourceType || normalized.sourcetype || "excel"),
      sourceSheet: normalizeText(row.sourceSheet || normalized.sourcesheet || ""),
      note: normalizeText(row.note || normalized.note || "")
    };
  }

  async function fetchJson(pathname, options = {}) {
    const response = await fetch(`${API_BASE}${pathname}`, options);
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) throw new Error(data.error || `Request failed with status ${response.status}.`);
    return data;
  }

  function buildMirrorExtraction(text, pageUrl, source = "browser-mirror") {
    const lines = cleanMirrorLines(text);
    let title = "";
    let description = "";

    for (const line of String(text || "").split(/\r?\n/)) {
      const trimmed = normalizeText(line);
      if (!trimmed) continue;
      const titleMatch = trimmed.match(/^title:\s*(.*)$/i);
      const descriptionMatch = trimmed.match(/^description:\s*(.*)$/i);
      if (!title && titleMatch) title = normalizeText(titleMatch[1]);
      if (!description && descriptionMatch) description = normalizeText(descriptionMatch[1]);
      if (title && description) break;
    }

    if (!title) title = lines[0] || humanizeDomain(pageUrl) || domainFromUrl(pageUrl) || pageUrl;
    return {
      url: pageUrl,
      title,
      siteName: "",
      description: description || lines.slice(1, 3).join(" ").slice(0, 240),
      body: lines.join("\n"),
      source,
      blocked: isBlockedExtraction({ title, description, body: lines.join("\n") }),
      blockReason: isBlockedExtraction({ title, description, body: lines.join("\n") }) ? "Mirror returned a challenge / CAPTCHA page instead of usable website content." : ""
    };
  }

  async function fetchMirrorExtraction(url) {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;
    const parsed = new URL(normalized);
    const mirrorCandidates = [
      `https://r.jina.ai/http://${parsed.toString()}`,
      `https://r.jina.ai/http://${parsed.toString().replace(/^https?:\/\//i, "")}`
    ];
    let lastError = null;
    let blockedResult = null;

    for (const mirrorUrl of mirrorCandidates) {
      try {
        const response = await fetch(mirrorUrl, {
          headers: {
            Accept: "text/plain,text/*;q=0.9,*/*;q=0.8"
          }
        });
        if (!response.ok) {
          throw new Error(`Mirror fetch failed with status ${response.status}.`);
        }
        const text = await response.text();
        if (!normalizeText(text)) {
          throw new Error("Mirror fetch returned empty content.");
        }
        const extraction = buildMirrorExtraction(text, parsed.toString(), "browser-mirror");
        if (!extraction.blocked) return extraction;
        blockedResult = extraction;
      } catch (error) {
        lastError = error;
      }
    }

    if (blockedResult) return blockedResult;
    throw lastError || new Error("Mirror fetch failed.");
  }

  async function fetchExtraction(url) {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;
    try {
      const direct = await fetchJson(`/api/fetch?url=${encodeURIComponent(normalized)}`);
      if (!isBlockedExtraction(direct)) return direct;
      try {
        const mirror = await fetchMirrorExtraction(normalized);
        return mirror || direct;
      } catch {
        return direct;
      }
    } catch (error) {
      try {
        return await fetchMirrorExtraction(normalized);
      } catch {
        throw error;
      }
    }
  }

  function extractUrlsFromText(text) {
    return (String(text || "").match(/https?:\/\/[^\s"'<>]+/gi) || []).map(cleanUrl).filter(Boolean);
  }

  function detectSocialUrls(text) {
    const found = { instagram: "", facebook: "", linkedin: "", youtube: "", tiktok: "" };
    for (const url of extractUrlsFromText(text)) {
      const lower = url.toLowerCase();
      if (!found.instagram && lower.includes("instagram.com")) found.instagram = url;
      if (!found.facebook && lower.includes("facebook.com")) found.facebook = url;
      if (!found.linkedin && lower.includes("linkedin.com")) found.linkedin = url;
      if (!found.youtube && (lower.includes("youtube.com") || lower.includes("youtu.be"))) found.youtube = url;
      if (!found.tiktok && lower.includes("tiktok.com")) found.tiktok = url;
    }
    return found;
  }

  function mergeSocialTargets(input, discovered) {
    return {
      instagram: input.instagramUrl || discovered.instagram || "",
      facebook: input.facebookUrl || discovered.facebook || "",
      linkedin: discovered.linkedin || "",
      youtube: discovered.youtube || "",
      tiktok: discovered.tiktok || ""
    };
  }

  function evidenceBlocksFromInput(input, sources) {
    const blocks = [];
    if (input.businessNotes) blocks.push({ label: "Business Notes / 业务备注", url: "", text: input.businessNotes });
    if (input.sourceNotes) blocks.push({ label: "Source Notes / 官网与社媒摘录", url: "", text: input.sourceNotes });
    for (const source of sources) {
      if (!source) continue;
      if (source.error || isBlockedExtraction(source.raw || source)) continue;
      const text = [source.title, source.description, source.body].filter(Boolean).join("\n");
      if (!text) continue;
      blocks.push({ label: `${source.platform || "Website"} / ${source.sourceLabel || "Source"}`, url: source.url || "", text });
    }
    return blocks;
  }

  async function collectSources(input) {
    const sources = [];
    const visited = new Set();

    async function addSource(platform, url, label) {
      const normalized = normalizeUrl(url);
      if (!normalized || visited.has(normalized)) return null;
      visited.add(normalized);
      try {
        const data = await fetchExtraction(normalized);
        if (!data) return null;
        const source = {
          platform,
          url: normalized,
          sourceLabel: label || platform,
          title: normalizeText(data.title || data.siteName || ""),
          description: normalizeText(data.description || ""),
          body: normalizeText(data.body || ""),
          raw: data
        };
        sources.push(source);
        return source;
      } catch (error) {
        sources.push({ platform, url: normalized, sourceLabel: label || platform, title: "", description: "", body: "", error: error.message || "Failed to fetch source." });
        return null;
      }
    }

    const websiteSource = input.website ? await addSource("website", input.website, "Website") : null;
    const discoveredFromWebsite = detectSocialUrls([
      websiteSource ? [websiteSource.title, websiteSource.description, websiteSource.body].join("\n") : "",
      input.sourceNotes,
      input.businessNotes,
      input.companyName
    ].join("\n"));

    const socialTargets = mergeSocialTargets(input, discoveredFromWebsite);
    const socialFetches = [
      ["instagram", socialTargets.instagram],
      ["facebook", socialTargets.facebook],
      ["linkedin", socialTargets.linkedin],
      ["youtube", socialTargets.youtube],
      ["tiktok", socialTargets.tiktok]
    ].filter(([, url]) => url).map(([platform, url]) => addSource(platform, url, platform.charAt(0).toUpperCase() + platform.slice(1)));

    if (socialFetches.length) await Promise.allSettled(socialFetches);
    return { sources, socialTargets, discoveredFromWebsite };
  }

  function scoreCategory(def, blocks) {
    let score = 0;
    const signals = [];
    for (const rule of def.rules) {
      let matched = "";
      for (const block of blocks) {
        const lines = splitLines(block.text);
        matched = firstMatchingLine(lines, rule.terms);
        if (matched) break;
      }
      if (matched) {
        score += rule.points;
        signals.push({ categoryId: def.id, categoryLabel: def.label, label: rule.label, points: rule.points, evidence: matched });
      }
    }
    return { id: def.id, label: def.label, score: Math.min(score, def.cap), signals };
  }

  function buildSourceStatus(sources) {
    const website = sources.find((source) => source.platform === "website");
    const blocked = sources.filter((source) => isBlockedExtraction(source.raw || source));
    const failed = sources.filter((source) => source.error);
    const usable = sources.filter((source) => normalizeText([source.title, source.description, source.body].filter(Boolean).join(" ")));
    return {
      websiteBlocked: Boolean(website && isBlockedExtraction(website.raw || website)),
      blockedCount: blocked.length,
      failedCount: failed.length,
      usableCount: usable.length,
      message: blocked.length
        ? "部分网页返回 CAPTCHA / Cloudflare / access denied，评分只使用抓到的有效文字。"
        : failed.length
          ? "部分网页抓取失败，评分只使用已抓到的有效文字。"
          : "已使用官网 / 社媒 / 手工摘录中的有效文字进行评分。"
    };
  }

  function getRatingBand(score) {
    return RATING_BANDS.find((band) => score >= band.min) || RATING_BANDS[RATING_BANDS.length - 1];
  }

  function findKnownAccountFallback(input) {
    const domain = domainFromUrl(input.website);
    return KNOWN_ACCOUNT_FALLBACKS.find((item) => item.domainPattern.test(domain)) || null;
  }

  function buildBusinessTypes(categoryScores) {
    return categoryScores
      .filter((item) => item.score > 0)
      .sort((a, b) => (b.score - a.score) || (PRIORITY_ORDER.indexOf(a.id) - PRIORITY_ORDER.indexOf(b.id)))
      .map((item) => item.label);
  }

  function buildDecisionFocus(categoryScores, ratingBand) {
    const positives = categoryScores.filter((item) => item.score > 0).sort((a, b) => (b.score - a.score) || (PRIORITY_ORDER.indexOf(a.id) - PRIORITY_ORDER.indexOf(b.id)));
    if (ratingBand.fallbackNote) return `${ratingBand.fallbackNote} 下一步建议直接按重点零售客户写开发信，并在邮件里用简洁产品组合切入。`;
    if (ratingBand.grade === "NR") return "官网抓取受阻，当前没有可用于评分的业务正文。可以粘贴官网产品页/品牌页摘录后重新分析。";
    if (!positives.length) return "没有足够明确的网页证据，先补官网摘录、社媒链接或业务说明，再发开发信。";
    const top = positives.slice(0, 3).map((item) => item.label).join(" / ");
    const wholesale = categoryScores.find((item) => item.id === "wholesale");
    if (wholesale && wholesale.score > 0) return `Top fit: ${top}. Start with a dealer / wholesale angle first.`;
    if (ratingBand.grade === "A") return `Top fit: ${top}. Use a deeper, product-specific outreach angle.`;
    if (ratingBand.grade === "B") return `Top fit: ${top}. Keep the first email tight and evidence-led.`;
    return `Top fit: ${top}. Keep outreach short and ask for a clearer product / buying signal.`;
  }

  function buildKeyDecision(analysis) {
    const strongest = analysis.businessTypes.slice(0, 3).join(" / ") || "No clear type";
    if (analysis.fallbackNote) return `${analysis.grade} / ${analysis.score} · 已知客户兜底判断：${strongest}`;
    if (analysis.sourceStatus.websiteBlocked && analysis.score === 0) {
      return `${analysis.grade} / ${analysis.score} · 官网抓取受阻，当前结果不代表真实客户价值`;
    }
    return `${analysis.grade} / ${analysis.score} · ${strongest}`;
  }

  function extractRelevantScope(blocks) {
    const scopePatterns = [
      /wholesale|distributor|dealer|retail|shop|store|camera|photo|video|lighting|gear|equipment|accessor|studio|rental|repair|workshop|course|training|creator|stream|superstore|showroom|address/i,
      ...terms("wholesale", "distributor", "retail", "productSales", "storefront", "onlinePurchase", "photoVideoProducts", "photoVideoWords", "gearAccessories", "proImaging", "cameraStore", "physicalAddress", "multipleLocations", "studio", "service", "training", "creator", "social")
    ];
    const lines = [];
    for (const block of blocks) {
      for (const line of splitLines(block.text)) {
        if (line.length < 18 || !isReadableEvidence(line)) continue;
        if (!matchesAny(line, scopePatterns)) continue;
        lines.push(`${block.label} ::: ${cleanEvidenceText(line, 190)}`);
      }
    }
    return dedupeLines(lines).slice(0, 8).map((entry) => {
      const [source, text] = entry.split(" ::: ");
      return { source, text, url: "" };
    });
  }

  function buildMatchedSignals(categoryScores) {
    return categoryScores.flatMap((item) => item.signals).sort((a, b) => b.points - a.points).slice(0, 8);
  }

  function calculateSalesScore(categoryMap) {
    const wholesale = categoryMap.wholesale?.score || 0;
    const retail = categoryMap.retail?.score || 0;
    const photoVideo = categoryMap.photoVideoRetail?.score || 0;
    const cameraStore = categoryMap.cameraStore?.score || 0;
    const online = categoryMap.onlineShop?.score || 0;
    const physical = categoryMap.physicalStore?.score || 0;
    const studio = categoryMap.studio?.score || 0;
    const services = categoryMap.services?.score || 0;
    const education = categoryMap.eventsEducation?.score || 0;
    const creator = categoryMap.creator?.score || 0;

    const channelCore = Math.min(55, wholesale + retail + photoVideo + cameraStore);
    const salesAccess = Math.min(25, online + physical);
    const serviceDepth = Math.min(15, studio + services + education);
    const creatorDepth = Math.min(5, creator);
    return Math.min(100, channelCore + salesAccess + serviceDepth + creatorDepth);
  }

  function normalizeProductCategory(category, name = "", tags = "") {
    const text = `${category} ${name} ${tags}`.toLowerCase();
    if (/lighting|led|rgb|panel|beam|lumen|lamp/.test(text)) return "Lighting";
    if (/modifier|softbox|umbrella|reflector|beauty dish|grid|capsule/.test(text)) return "Modifiers";
    if (/flash|trigger|speedlight|strobe|transmitter|receiver|odin|mitros|juno/.test(text)) return "Flash & Trigger";
    if (/support|stand|boom|clamp|holder|bag|adapter|mount|arm|tripod/.test(text)) return "Support & Accessories";
    if (/power|battery|charger|video|mobile|usb-c|np-f/.test(text)) return "Power & Video";
    return category || "Other";
  }

  function normalizeCatalog(products) {
    return products.map((product) => {
      const normalized = normalizeProductRecord(product);
      normalized.category = normalizeProductCategory(normalized.category, normalized.name, normalized.tags);
      return normalized;
    });
  }

  function loadStoredProducts() {
    const stored = loadStoredList(STORAGE_KEYS.products);
    return stored.length ? normalizeCatalog(stored) : normalizeCatalog(DEFAULT_PRODUCTS);
  }

  function groupProductsByCategory(products) {
    const grouped = new Map();
    for (const product of products) {
      const category = normalizeProductCategory(product.category, product.name, product.tags);
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push({ ...product, category });
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], "en"));
  }

  function scoreProduct(product, targetCategories, targetTerms, mode) {
    const haystack = normalizeText([product.name, product.description, product.tags, product.brand, product.category].join(" ")).toLowerCase();
    let score = 0;
    if (targetCategories.includes(product.category)) score += 8;
    if (mode === "dealer" && ["Lighting", "Modifiers", "Flash & Trigger", "Support & Accessories", "Power & Video"].includes(product.category)) score += 5;
    if (mode === "endUser" && ["Lighting", "Modifiers", "Flash & Trigger", "Power & Video"].includes(product.category)) score += 5;
    for (const term of targetTerms) if (haystack.includes(term)) score += 2;
    if (product.sourceType === "excel") score += 1;
    return score;
  }

  function pickProducts(products, targetCategories, targetTerms, mode) {
    const scored = products
      .map((product) => ({ ...product, matchScore: scoreProduct(product, targetCategories, targetTerms, mode) }))
      .filter((product) => product.matchScore > 0)
      .sort((a, b) => (b.matchScore - a.matchScore) || a.name.localeCompare(b.name, "en"));
    const deduped = [];
    const seen = new Set();
    for (const product of scored) {
      const key = `${product.category}|${product.name}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(product);
      if (deduped.length >= 4) break;
    }
    return deduped;
  }

  function buildProductReason(product, analysis, mode) {
    const reasons = [];
    const category = product.category;
    if (mode === "dealer") {
      if (analysis.categoryMap.wholesale?.score > 0) reasons.push("wholesale / dealer friendly");
      if (analysis.categoryMap.retail?.score > 0) reasons.push("retail assortment support");
      if (analysis.categoryMap.onlineShop?.score > 0) reasons.push("online sell-through");
    } else {
      if (analysis.categoryMap.studio?.score > 0) reasons.push("studio bundle fit");
      if (analysis.categoryMap.creator?.score > 0) reasons.push("creator / content fit");
      if (analysis.categoryMap.photoVideoRetail?.score > 0) reasons.push("photo/video retail demand");
    }
    if (["Lighting", "Modifiers"].includes(category)) reasons.push("core lighting line");
    if (category === "Flash & Trigger") reasons.push("flash ecosystem");
    if (category === "Support & Accessories") reasons.push("easy upsell accessory");
    if (category === "Power & Video") reasons.push("mobile / video use");
    return dedupeLines(reasons).slice(0, 3).join(" · ");
  }

  function buildProductCards(products, analysis, mode) {
    if (!products.length) {
      return `<div class="bullet-item">No matched products yet. Import the Phottix Excel file in the Products tab to unlock catalog-based recommendations.</div>`;
    }
    return products.map((product) => {
      const reason = buildProductReason(product, analysis, mode);
      const subtitleParts = [product.category];
      if (product.sku) subtitleParts.push(`SKU: ${product.sku}`);
      if (product.brand) subtitleParts.push(product.brand);
      if (product.price) subtitleParts.push(product.price);
      return `<article class="product-card"><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(reason || product.description || "Recommended because it fits the current customer signals.")}</span><div class="crm-meta">${escapeHtml(subtitleParts.join(" · "))}</div></article>`;
    }).join("");
  }

  function toEnglishLabel(label) {
    return normalizeText(label).split("/")[0].trim();
  }

  function englishBusinessTypes(analysis, limit = 2) {
    return (analysis.businessTypes || [])
      .map(toEnglishLabel)
      .filter(Boolean)
      .slice(0, limit);
  }

  function cleanEmailText(value) {
    return normalizeText(value)
      .replace(/[\u3400-\u9fff]+/g, "")
      .replace(/\s*\/\s*/g, " / ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function englishMeaningForExcerpt(value) {
    const text = normalizeText(value);
    const lower = text.toLowerCase();
    const meanings = [];

    if (/strona główna|strona glowna/i.test(text)) meanings.push("Home page");
    if (/foto[- ]technika/i.test(text)) meanings.push("Foto-Technika");
    if (/od\s+30\s+lat/i.test(lower)) meanings.push("has been operating for 30 years");
    if (/dystrybucj[ąa].*sprz[ęe]tu fotograficznego|sprz[ęe]tu fotograficznego.*dystrybucj[ąa]/i.test(text)) meanings.push("distributes photographic equipment");
    if (/\bw polsce\b/i.test(lower)) meanings.push("in Poland");
    if (/oferujemy blisko\s+20\s+marek|blisko\s+20\s+marek/i.test(lower)) meanings.push("offers nearly 20 brands");
    if (/nie zatrzymujemy si[ęe]|nie zastrzymujemy si[ęe]/i.test(lower)) meanings.push("continues to expand");

    if (meanings.length >= 2) {
      return `${meanings.join("; ")}.`;
    }

    return "";
  }

  function renderEvidenceWithMeaning(label, text, maxLength = 160) {
    const cleaned = cleanEvidenceText(text, maxLength);
    const meaning = englishMeaningForExcerpt(text);
    return `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(cleaned)}${meaning ? `<br><span class="crm-meta">English meaning: ${escapeHtml(meaning)}</span>` : ""}`;
  }

  function buildSuggestionList(analysis) {
    const items = [];
    const wholesale = analysis.categoryMap.wholesale?.score || 0;
    const retail = analysis.categoryMap.retail?.score || 0;
    const online = analysis.categoryMap.onlineShop?.score || 0;
    const studio = analysis.categoryMap.studio?.score || 0;
    const creator = analysis.categoryMap.creator?.score || 0;
    if (wholesale > 0) items.push("Open with a dealer / distribution angle, because wholesale signals are already visible.");
    else if (retail > 0 || online > 0) items.push("Lead with retail assortment and one concrete best-selling Phottix bundle.");
    else if (studio > 0 || creator > 0) items.push("Lead with compact lighting + modifier bundles that fit studio or creator workflows.");
    else items.push("Ask for one more website or social excerpt before sending a highly personalized email.");
    if (analysis.businessTypes.length) items.push(`Use the strongest visible mix: ${analysis.businessTypes.slice(0, 3).join(" / ")}.`);
    items.push("Include one line of evidence from the website in the opening paragraph.");
    items.push("Keep the CTA simple: catalog, pricing, and a short call to discuss fit.");
    return dedupeLines(items).slice(0, 4);
  }

  function buildEmailSubject(analysis, input) {
    const company = input.companyName || humanizeDomain(input.website) || "your team";
    if (analysis.categoryMap.wholesale?.score > 0) return `Quick introduction from Phottix`;
    if (analysis.categoryMap.retail?.score > 0 || analysis.categoryMap.onlineShop?.score > 0) return `A quick Phottix introduction for ${company}`;
    if (analysis.categoryMap.studio?.score > 0) return `Phottix lighting introduction`;
    if (analysis.categoryMap.creator?.score > 0) return `Phottix lighting introduction`;
    return `Quick introduction from Phottix`;
  }

  function buildLeadSentence(analysis) {
    const scopes = englishBusinessTypes(analysis, 2);
    if (!scopes.length) return "I was looking through your website and thought there may be a relevant fit.";
    return `I was looking through your website and noticed your work around ${scopes.join(" and ")}.`;
  }

  function buildSoftFitLine(analysis) {
    const productAreas = [];
    if (analysis.categoryMap.retail?.score > 0 || analysis.categoryMap.onlineShop?.score > 0 || analysis.fallbackNote) {
      productAreas.push("LED lighting");
      productAreas.push("softboxes");
      productAreas.push("photo/video accessories");
    } else if (analysis.categoryMap.studio?.score > 0 || analysis.categoryMap.creator?.score > 0) {
      productAreas.push("compact lighting");
      productAreas.push("softboxes");
      productAreas.push("creator-friendly accessories");
    } else {
      productAreas.push("lighting");
      productAreas.push("softboxes");
      productAreas.push("photo accessories");
    }
    return `Phottix works with photo and video partners on products such as ${dedupeLines(productAreas).slice(0, 3).join(", ")}.`;
  }

  function buildEmail(analysis, input) {
    const contact = input.contactName || "there";
    const company = input.companyName || humanizeDomain(input.website) || "your team";
    const leadSentence = buildLeadSentence(analysis);
    const fitLine = buildSoftFitLine(analysis);
    const subject = buildEmailSubject(analysis, input);
    const body = [
      `Hi ${contact},`,
      "",
      `I came across ${company} and wanted to briefly introduce Phottix.`,
      "",
      leadSentence,
      "",
      fitLine,
      "",
      "No pressure at all, but would it be alright if I sent over a short product overview for the right person on your team?",
      "",
      "If there is a better contact for new brand or product line discussions, I would also appreciate being pointed in the right direction.",
      "",
      "Best regards,",
      "[Your Name]",
      "Phottix Business Development Team"
    ].join("\n");
    return { subject, body, preview: `Subject: ${subject}\n\n${body}` };
  }

  function buildReportText(analysis, input) {
    const lines = [];
    lines.push(`Company: ${input.companyName || "—"}`);
    lines.push(`Contact: ${input.contactName || "—"}`);
    lines.push(`Website: ${input.website || "—"}`);
    lines.push(`City: ${input.city || "—"}`);
    lines.push(`Instagram: ${input.instagramUrl || analysis.socialTargets.instagram || "—"}`);
    lines.push(`Facebook: ${input.facebookUrl || analysis.socialTargets.facebook || "—"}`);
    lines.push(`Rating: ${analysis.grade} / ${analysis.score}`);
    lines.push(`Key decision: ${analysis.keyDecision}`);
    lines.push(`Focus: ${analysis.focus}`);
    lines.push("");
    lines.push("Matched signals:");
    for (const signal of analysis.topSignals.slice(0, 6)) lines.push(`- ${signal.categoryLabel} / ${signal.label} +${signal.points}: ${signal.evidence}`);
    lines.push("");
    lines.push("Business scope:");
    for (const scope of analysis.scopeLines.slice(0, 6)) lines.push(`- ${scope.source}: ${scope.text}`);
    lines.push("");
    lines.push("Dealer line:");
    for (const product of analysis.dealerProducts.slice(0, 4)) lines.push(`- ${product.name} (${product.category}) — ${product.reason}`);
    lines.push("");
    lines.push("End-user line:");
    for (const product of analysis.endUserProducts.slice(0, 4)) lines.push(`- ${product.name} (${product.category}) — ${product.reason}`);
    lines.push("");
    lines.push("Email subject:");
    lines.push(analysis.email.subject);
    lines.push("");
    lines.push("Email body:");
    lines.push(analysis.email.body);
    lines.push("");
    lines.push("Suggestions:");
    for (const suggestion of analysis.suggestions) lines.push(`- ${suggestion}`);
    return lines.join("\n");
  }

  function buildExportRow(analysis, input, bucket) {
    return {
      company_name: input.companyName || "",
      contact_name: input.contactName || "",
      contact_email: "",
      website: input.website || "",
      instagram_url: input.instagramUrl || analysis.socialTargets.instagram || "",
      facebook_url: input.facebookUrl || analysis.socialTargets.facebook || "",
      city: input.city || "",
      business_types: analysis.businessTypes.join(" | "),
      rating: analysis.grade,
      score: analysis.score,
      rating_focus: analysis.focus,
      key_decision: analysis.keyDecision,
      matched_signals: analysis.topSignals.map((signal) => `${signal.categoryLabel}: ${signal.label} +${signal.points}`).join(" | "),
      dealer_line: analysis.dealerProducts.map((product) => `${product.name} (${product.reason})`).join(" | "),
      end_user_line: analysis.endUserProducts.map((product) => `${product.name} (${product.reason})`).join(" | "),
      email_subject: analysis.email.subject,
      email_body: analysis.email.body,
      email_preview: analysis.email.preview,
      suggestions: analysis.suggestions.join(" | "),
      save_bucket: bucket,
      saved_at: new Date().toISOString()
    };
  }

  function renderTable(rows) {
    if (!rows.length) return `<div class="bullet-item">—</div>`;
    return `<table><tbody>${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`).join("")}</tbody></table>`;
  }

  function renderBulletList(items, emptyText = "—") {
    if (!items.length) return `<div class="bullet-item">${escapeHtml(emptyText)}</div>`;
    return items.map((item) => `<div class="bullet-item">${item}</div>`).join("");
  }

  function renderCompanyInfo(analysis, input) {
    const rows = [
      ["公司名 / Company", escapeHtml(input.companyName || "—")],
      ["联系人 / Contact", escapeHtml(input.contactName || "—")],
      ["官网 / Website", input.website ? `<a href="${escapeHtml(input.website)}" target="_blank" rel="noreferrer">${escapeHtml(displayUrl(input.website))}</a>` : "—"],
      ["城市 / City", escapeHtml(input.city || "—")],
      ["Instagram", analysis.socialTargets.instagram ? `<a href="${escapeHtml(analysis.socialTargets.instagram)}" target="_blank" rel="noreferrer">${escapeHtml(displayUrl(analysis.socialTargets.instagram))}</a>` : "—"],
      ["Facebook", analysis.socialTargets.facebook ? `<a href="${escapeHtml(analysis.socialTargets.facebook)}" target="_blank" rel="noreferrer">${escapeHtml(displayUrl(analysis.socialTargets.facebook))}</a>` : "—"],
      ["业务类型 / Business Type", escapeHtml(analysis.businessTypes.length ? analysis.businessTypes.join(" / ") : "待确认 / Pending")]
    ];
    DOM.companyTable.innerHTML = renderTable(rows);
  }

  function renderJudgingStandardList() {
    const items = [
      `<strong>A 级</strong> 70+ 核心零售 / 批发 / 经销 / 线上商店信号明确，适合优先深度开发。`,
      `<strong>B 级</strong> 40-69 有较明确相关业务，但仍需更清晰的切入点与证据。`,
      `<strong>C 级</strong> 25-39 只出现部分相关信号，适合简洁切入。`,
      `<strong>D 级</strong> <25 相关信号较弱，先补资料或做低频触达。`,
      `<strong>优先级 / Priority</strong> Wholesale > Retail > Photo & Video Retail > Camera Store > Online Shop > Physical Store > Studio / Services / Events & Education > Creator.`,
      `<strong>判断依据 / Evidence</strong> 主要看网页正文、产品页、购物流程、门店地址、业务介绍和社媒文字；域名只作为辅助，不作为核心评分。`
    ];
    DOM.judgingStandardList.innerHTML = items.map((item) => `<div class="bullet-item">${item}</div>`).join("");
  }

  function renderScopeList(scopeLines, input, analysis) {
    const items = [];
    if (analysis.sourceStatus?.message) {
      const tone = analysis.sourceStatus.websiteBlocked ? "抓取状态 / Fetch Status" : "资料来源 / Source Status";
      items.push(`<strong>${tone}:</strong> ${escapeHtml(analysis.sourceStatus.message)}`);
    }
    if (analysis.fallbackNote) {
      items.push(`<strong>已知客户兜底 / Known Account:</strong> ${escapeHtml(analysis.fallbackNote)}`);
    }
    if (input.website) {
      if (analysis.websiteMeta.title) items.push(renderEvidenceWithMeaning("Title", analysis.websiteMeta.title, 120));
      if (analysis.websiteMeta.description) items.push(renderEvidenceWithMeaning("Description", analysis.websiteMeta.description, 160));
    }
    for (const scope of scopeLines.slice(0, 5)) items.push(renderEvidenceWithMeaning(scope.source, scope.text, 160));
    if (!items.length) items.push("未抓到足够明确的业务摘录。若官网被 CAPTCHA / Cloudflare 拦截，当前低分只是资料不足，不代表客户价值低。");
    DOM.scopeList.innerHTML = items.map((item) => `<div class="bullet-item">${item}</div>`).join("");
  }

  function renderRatingList(categoryScores, analysis) {
    if (analysis?.fallbackNote && !categoryScores.some((item) => item.score > 0)) {
      DOM.ratingList.innerHTML = `<div class="bullet-item"><strong>已知客户兜底 / Known Account</strong><br><span class="crm-meta">${escapeHtml(analysis.fallbackNote)}</span></div>`;
      return;
    }
    const positive = categoryScores.filter((item) => item.score > 0);
    if (!positive.length) {
      DOM.ratingList.innerHTML = `<div class="bullet-item">No strong category match found yet. Add more website text or a social excerpt to sharpen the rating.</div>`;
      return;
    }
    DOM.ratingList.innerHTML = positive
      .sort((a, b) => (b.score - a.score) || (PRIORITY_ORDER.indexOf(a.id) - PRIORITY_ORDER.indexOf(b.id)))
      .map((item) => {
        const signals = item.signals.length ? item.signals.map((signal) => {
          return `<div class="bullet-item"><strong>+${signal.points}</strong> ${escapeHtml(signal.label)}</div>`;
        }).join("") : `<div class="bullet-item">No direct signal text captured.</div>`;
        return `<section class="result-subgroup"><h4>${escapeHtml(item.label)} — ${item.score}</h4>${signals}</section>`;
      }).join("");
  }

  function renderSignals(signals, analysis) {
    if (!DOM.signalSummary) return;
    if (analysis?.fallbackNote && !signals.length) {
      DOM.signalSummary.innerHTML = `<div class="bullet-item"><strong>Known Account / 已知客户</strong><br><span class="crm-meta">${escapeHtml(analysis.fallbackNote)}</span></div>`;
      return;
    }
    if (!signals.length) {
      DOM.signalSummary.innerHTML = `<div class="bullet-item">No matched signals yet.</div>`;
      return;
    }
    DOM.signalSummary.innerHTML = signals.map((signal) => {
      const evidence = cleanEvidenceText(signal.evidence, 115);
      return `<div class="bullet-item"><strong>${escapeHtml(signal.categoryLabel)}</strong> · ${escapeHtml(signal.label)} <strong>+${signal.points}</strong>${evidence ? `<br><span class="crm-meta">${escapeHtml(evidence)}</span>` : ""}</div>`;
    }).join("");
  }

  function renderSuggestions(items) {
    DOM.suggestionList.innerHTML = renderBulletList(items.map((item) => escapeHtml(item)), "No suggestions yet.");
  }

  function renderAnalysis(analysis, input) {
    renderCompanyInfo(analysis, input);
    const ratingTitle = analysis.grade === "NR" ? "未评级 / Not Rated" : `${analysis.grade} 级 / ${analysis.score} 分`;
    DOM.keyDecisionRating.innerHTML = `<div class="bullet-item"><strong>${escapeHtml(ratingTitle)}</strong></div>`;
    DOM.keyDecisionFocus.innerHTML = `<div class="bullet-item">${escapeHtml(analysis.keyDecision)}</div><div class="bullet-item">${escapeHtml(analysis.focus)}</div>`;
    renderJudgingStandardList();
    renderScopeList(analysis.scopeLines, input, analysis);
    renderRatingList(analysis.categoryScores, analysis);
    renderSignals(analysis.topSignals, analysis);
    DOM.dealerProducts.innerHTML = buildProductCards(analysis.dealerProducts, analysis, "dealer");
    DOM.endUserProducts.innerHTML = buildProductCards(analysis.endUserProducts, analysis, "endUser");
    DOM.emailPreview.textContent = analysis.email.preview;
    renderSuggestions(analysis.suggestions);
    DOM.copyReportBtn.disabled = false;
    DOM.copyEmailBtn.disabled = false;
    DOM.exportBtn.disabled = false;
    DOM.saveBtn.disabled = false;
    showAnalysisPanel(true);
    setStatus(`${analysis.grade} / ${analysis.score} ready`, analysis.grade === "A" ? "good" : analysis.grade === "D" ? "bad" : "warn");
  }

  function renderProductLibrary() {
    if (!DOM.productLibrary) return;
    const products = state.products.length ? state.products : normalizeCatalog(DEFAULT_PRODUCTS);
    const grouped = groupProductsByCategory(products);
    const productCount = products.length;
    const categoryCount = grouped.length;
    const sourceLabel = state.productSource === "excel" ? "Excel" : "Default";
    DOM.productLibrary.innerHTML = `
      <div class="section-head">
        <div>
          <h2>产品资料库 / Product Library</h2>
          <p>当前已加载 ${productCount} 个产品，覆盖 ${categoryCount} 个类别。导入 Excel 后，这里会自动换成你的真实产品库。</p>
        </div>
        <div class="crm-tools">
          <button class="secondary-button" type="button" data-action="import-products">导入产品 Excel / Import Products</button>
          <input id="productFileInput" type="file" accept=".xlsx,.xlsm,.csv" hidden>
        </div>
      </div>
      <div class="overview-cards">
        <div class="overview-card"><span class="overview-label">Products</span><strong class="overview-value">${productCount}</strong><span class="overview-note">Source: ${escapeHtml(sourceLabel)}</span></div>
        <div class="overview-card"><span class="overview-label">Categories</span><strong class="overview-value">${categoryCount}</strong><span class="overview-note">Grouped automatically</span></div>
        <div class="overview-card"><span class="overview-label">Usage</span><strong class="overview-value">Dealer + End User</strong><span class="overview-note">Used by the email generator</span></div>
      </div>
      <div class="result-area">
        ${grouped.map(([category, items]) => `
          <section class="result-block">
            <div class="block-head"><h3>${escapeHtml(category)} (${items.length})</h3><span class="status-pill">${escapeHtml(sourceLabel)}</span></div>
            <div class="bullet-list">${items.slice(0, 6).map((item) => `<div class="bullet-item"><strong>${escapeHtml(item.name)}</strong>${item.description ? ` — ${escapeHtml(item.description)}` : ""}</div>`).join("")}</div>
          </section>
        `).join("")}
      </div>
    `;
  }

  function formatSavedAt(iso) {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("zh-HK", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function renderCrmList(list, container, bucket, emptyText) {
    if (!container) return;
    if (!list.length) {
      container.innerHTML = `<div class="result-block"><div class="bullet-item">${escapeHtml(emptyText)}</div></div>`;
      return;
    }
    container.innerHTML = list.map((record) => {
      const gradeClass = record.rating === "A" ? "good" : record.rating === "B" ? "warn" : record.rating === "C" ? "warn" : record.rating === "D" ? "bad" : "";
      const summary = record.analysisSummary || record.businessTypes || record.keyDecision || record.businessNotes || record.sourceNotes || "No summary yet.";
      const websiteDisplay = record.website ? `<a href="${escapeHtml(record.website)}" target="_blank" rel="noreferrer">${escapeHtml(displayUrl(record.website))}</a>` : "—";
      return `
        <article class="crm-item" data-record-id="${escapeHtml(record.id)}" data-record-bucket="${escapeHtml(bucket)}">
          <div class="crm-item-head">
            <div>
              <h3>${escapeHtml(record.companyName || "Untitled")}</h3>
              <p class="crm-summary">${websiteDisplay}</p>
            </div>
            <span class="status-pill crm-grade ${gradeClass}">${record.rating ? `${escapeHtml(record.rating)} / ${record.score || 0}` : "Not analyzed"}</span>
          </div>
          <p class="crm-summary">${escapeHtml(summary)}</p>
          <p class="crm-meta">${escapeHtml([record.city, record.contactName, record.contactEmail, formatSavedAt(record.savedAt)].filter(Boolean).join(" · "))}</p>
          <div class="crm-actions">
            <button class="mini-button" type="button" data-action="load-record" data-record-id="${escapeHtml(record.id)}" data-record-bucket="${escapeHtml(bucket)}">Analyze</button>
            <button class="mini-button danger-text" type="button" data-action="delete-record" data-record-id="${escapeHtml(record.id)}" data-record-bucket="${escapeHtml(bucket)}">Delete</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderCrmModules() {
    renderCrmList(state.prospects, DOM.prospectList, "prospects", "No prospects yet. Import a prospect Excel file or save a new analysis here.");
    renderCrmList(state.customers, DOM.customerList, "customers", "No existing customers yet. Import the old-customer Excel file here.");
    if (DOM.prospectImportStatus) DOM.prospectImportStatus.textContent = state.pendingStatuses.prospects;
    if (DOM.customerImportStatus) DOM.customerImportStatus.textContent = state.pendingStatuses.customers;
  }

  function saveCurrentLists() {
    saveStoredList(STORAGE_KEYS.prospects, state.prospects);
    saveStoredList(STORAGE_KEYS.customers, state.customers);
    saveStoredList(STORAGE_KEYS.products, state.products);
    saveStoredValue(STORAGE_KEYS.productSource, state.productSource);
  }

  async function importFileToRows(file, bucket) {
    const text = await file.text();
    if (bucket === "products") {
      if (/\.csv$/i.test(file.name) || /text\/csv/i.test(file.type)) {
        return fetchJson("/api/import-products", { method: "POST", headers: { "Content-Type": "text/csv; charset=utf-8" }, body: text });
      }
      return fetchJson("/api/import-products", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: await readAsBase64(file) });
    }
    if (/\.csv$/i.test(file.name) || /text\/csv/i.test(file.type)) {
      return fetchJson("/api/import-excel", { method: "POST", headers: { "Content-Type": "text/csv; charset=utf-8" }, body: text });
    }
    return fetchJson("/api/import-excel", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: await readFileAsBase64(file) });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const commaIndex = result.indexOf(",");
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  }

  function readAsBase64(file) {
    return readFileAsBase64(file);
  }

  function syncRecordFromAnalysis(bucket, existingRecordId, analysis, input) {
    return {
      id: existingRecordId || makeId(bucket === "customers" ? "cust" : "pros"),
      bucket,
      companyName: input.companyName || humanizeDomain(input.website) || "",
      contactName: input.contactName || "",
      contactEmail: "",
      website: input.website || "",
      city: input.city || "",
      instagramUrl: input.instagramUrl || analysis.socialTargets.instagram || "",
      facebookUrl: input.facebookUrl || analysis.socialTargets.facebook || "",
      businessNotes: input.businessNotes || "",
      sourceNotes: input.sourceNotes || "",
      rating: analysis.grade,
      score: analysis.score,
      keyDecision: analysis.keyDecision,
      businessTypes: analysis.businessTypes.join(" / "),
      analysisSummary: analysis.grade === "NR"
        ? "未评级 / Not Rated · 官网抓取受阻"
        : `${analysis.grade} / ${analysis.score} · ${analysis.businessTypes.slice(0, 3).join(" / ") || "No clear type"}`,
      emailSubject: analysis.email.subject,
      emailBody: analysis.email.body,
      emailPreview: analysis.email.preview,
      matchedSignals: analysis.topSignals.map((signal) => `${signal.categoryLabel}: ${signal.label} +${signal.points}`).join(" | "),
      dealerLine: analysis.dealerProducts.map((product) => product.name).join(" | "),
      endUserLine: analysis.endUserProducts.map((product) => product.name).join(" | "),
      suggestions: analysis.suggestions.join(" | "),
      savedAt: new Date().toISOString()
    };
  }

  function upsertRecord(bucket, record) {
    const list = bucket === "customers" ? state.customers : state.prospects;
    const index = list.findIndex((item) => item.id === record.id);
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.unshift(record);
    if (bucket === "customers") state.customers = list; else state.prospects = list;
    saveCurrentLists();
    renderCrmModules();
  }

  function deleteRecord(bucket, id) {
    if (bucket === "customers") state.customers = state.customers.filter((item) => item.id !== id);
    else state.prospects = state.prospects.filter((item) => item.id !== id);
    saveCurrentLists();
    renderCrmModules();
  }

  function findRecord(bucket, id) {
    const list = bucket === "customers" ? state.customers : state.prospects;
    return list.find((item) => item.id === id) || null;
  }

  function loadRecordToForm(record) {
    setFormValues(record);
    state.activeRecord = { bucket: record.bucket === "customers" ? "customers" : "prospects", id: record.id || null };
    setSaveButtonLabel();
  }

  async function analyzeCurrentForm() {
    const input = getFormValues();
    const websiteForDisplay = input.website || "";
    const companyFallback = input.companyName || humanizeDomain(input.website) || "";
    if (!input.companyName && !input.website && !input.businessNotes && !input.sourceNotes) {
      setStatus("Please enter a company name, website, or some evidence text first.", "warn");
      return;
    }

    setStatus("Fetching website and social evidence...", "warn");
    DOM.copyReportBtn.disabled = true;
    DOM.copyEmailBtn.disabled = true;
    DOM.exportBtn.disabled = true;
    DOM.saveBtn.disabled = true;

    const collected = await collectSources({ ...input, website: websiteForDisplay, companyName: companyFallback });
    setStatus("Analyzing signals...", "warn");

    const evidenceBlocks = evidenceBlocksFromInput(input, collected.sources);
    const categoryScores = CATEGORY_DEFS.map((def) => scoreCategory(def, evidenceBlocks));
    const categoryMap = {};
    for (const item of categoryScores) categoryMap[item.id] = item;
    const sourceStatus = buildSourceStatus(collected.sources);
    const knownFallback = sourceStatus.websiteBlocked && !input.businessNotes && !input.sourceNotes
      ? findKnownAccountFallback(input)
      : null;
    const score = knownFallback ? knownFallback.score : calculateSalesScore(categoryMap);
    const notRateable = sourceStatus.websiteBlocked && score === 0 && !input.businessNotes && !input.sourceNotes;
    const ratingBand = knownFallback
      ? { ...getRatingBand(score), grade: knownFallback.grade, fallbackNote: knownFallback.note }
      : notRateable ? NOT_RATED_BAND : getRatingBand(score);
    const businessTypes = knownFallback ? knownFallback.businessTypes : buildBusinessTypes(categoryScores);
    const scopeLines = extractRelevantScope(evidenceBlocks);
    const topSignals = buildMatchedSignals(categoryScores);
    const focus = buildDecisionFocus(categoryScores, ratingBand);
    const baseCatalog = state.products.length ? state.products : normalizeCatalog(DEFAULT_PRODUCTS);
    const dealerProducts = pickProducts(baseCatalog, ["Lighting", "Modifiers", "Flash & Trigger", "Support & Accessories", "Power & Video"], ["lighting", "led", "rgb", "softbox", "modifier", "flash", "trigger", "stand", "clamp", "battery", "power", "video"], "dealer").map((product) => ({ ...product, reason: buildProductReason(product, { categoryMap }, "dealer") }));
    const endUserProducts = pickProducts(baseCatalog, ["Lighting", "Modifiers", "Flash & Trigger", "Power & Video", "Support & Accessories"], ["creator", "studio", "video", "rgb", "light", "softbox", "mobile", "stream", "content", "photo"], "endUser").map((product) => ({ ...product, reason: buildProductReason(product, { categoryMap }, "endUser") }));
    const analysis = {
      input,
      websiteMeta: collected.sources.find((source) => source.platform === "website") || { title: "", description: "" },
      socialTargets: collected.socialTargets,
      categoryScores,
      categoryMap,
      score,
      grade: ratingBand.grade,
      ratingLabel: ratingBand.label,
      businessTypes,
      focus,
      sourceStatus,
      fallbackNote: knownFallback ? knownFallback.note : "",
      scopeLines,
      topSignals,
      dealerProducts,
      endUserProducts,
      suggestions: buildSuggestionList({ categoryMap, businessTypes }),
      keyDecision: "",
      sourceBlocks: evidenceBlocks
    };

    analysis.keyDecision = buildKeyDecision(analysis);
    analysis.email = buildEmail(analysis, input);
    analysis.reportText = buildReportText(analysis, {
      companyName: input.companyName || companyFallback,
      contactName: input.contactName,
      website: input.website,
      city: input.city,
      instagramUrl: input.instagramUrl || collected.socialTargets.instagram,
      facebookUrl: input.facebookUrl || collected.socialTargets.facebook,
      businessNotes: input.businessNotes,
      sourceNotes: input.sourceNotes
    });

    state.currentAnalysis = analysis;
    renderAnalysis(analysis, input);
    switchModule("analysis");
    setSaveButtonLabel();
  }

  async function handleGenerate(event) {
    if (event) event.preventDefault();
    try {
      await analyzeCurrentForm();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to analyze the customer.", "bad");
    }
  }

  async function handleSave() {
    if (!state.currentAnalysis) {
      setStatus("Please generate an analysis first.", "warn");
      return;
    }
    const input = getFormValues();
    const bucket = state.activeRecord.bucket === "customers" ? "customers" : "prospects";
    const record = syncRecordFromAnalysis(bucket, state.activeRecord.id, state.currentAnalysis, input);
    upsertRecord(bucket, record);
    state.activeRecord = { bucket, id: record.id };
    setSaveButtonLabel();
    setStatus(bucket === "customers" ? "Updated existing customer." : "Saved to prospects.", "good");
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  async function handleCopyReport() {
    if (!state.currentAnalysis) return;
    await copyToClipboard(state.currentAnalysis.reportText || buildReportText(state.currentAnalysis, getFormValues()));
    setStatus("Report copied to clipboard.", "good");
  }

  async function handleCopyEmail() {
    if (!state.currentAnalysis) return;
    await copyToClipboard(state.currentAnalysis.email.preview);
    setStatus("Email copied to clipboard.", "good");
  }

  async function handleExport() {
    if (!state.currentAnalysis) return;
    const input = getFormValues();
    const bucket = state.activeRecord.bucket === "customers" ? "customers" : "prospects";
    const row = buildExportRow(state.currentAnalysis, input, bucket);
    try {
      const response = await fetchJson("/api/export-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: [row] })
      });
      if (response.downloadUrl) {
        const link = document.createElement("a");
        link.href = `${API_BASE}${response.downloadUrl}`;
        link.target = "_blank";
        link.rel = "noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setStatus("Excel export ready.", "good");
      } else {
        setStatus("Export finished, but no download link was returned.", "warn");
      }
    } catch (error) {
      setStatus(error.message || "Failed to export Excel.", "bad");
    }
  }

  function resetForm() {
    setFormValues({ companyName: "", contactName: "", website: "", city: "", instagramUrl: "", facebookUrl: "", businessNotes: "", sourceNotes: "" });
    state.currentAnalysis = null;
    state.activeRecord = { bucket: "prospects", id: null };
    DOM.copyReportBtn.disabled = true;
    DOM.copyEmailBtn.disabled = true;
    DOM.exportBtn.disabled = true;
    DOM.saveBtn.disabled = true;
    DOM.companyTable.innerHTML = "";
    DOM.keyDecisionRating.innerHTML = "";
    DOM.keyDecisionFocus.innerHTML = "";
    DOM.judgingStandardList.innerHTML = "";
    DOM.scopeList.innerHTML = "";
    DOM.ratingList.innerHTML = "";
    if (DOM.signalSummary) DOM.signalSummary.innerHTML = "";
    DOM.dealerProducts.innerHTML = "";
    DOM.endUserProducts.innerHTML = "";
    DOM.emailPreview.textContent = "";
    DOM.suggestionList.innerHTML = "";
    showAnalysisPanel(false);
    setSaveButtonLabel();
    setStatus("Ready", "");
  }

  async function handleImportClick(bucket, inputEl) {
    if (!inputEl?.files?.[0]) return;
    const file = inputEl.files[0];
    try {
      const response = await importFileToRows(file, bucket);
      const rows = Array.isArray(response.rows) ? response.rows : [];
      if (!rows.length) {
        setStatus(`No rows were imported from ${file.name}.`, "warn");
        return;
      }

      if (bucket === "products") {
        state.products = normalizeCatalog(rows.map((row) => normalizeProductRecord(row)));
        state.productSource = "excel";
        saveCurrentLists();
        renderProductLibrary();
        setStatus(`Imported ${state.products.length} products.`, "good");
      } else {
        const list = rows.map(normalizeImportedRecord).map((row) => ({ ...row, bucket, id: row.id || makeId(bucket === "customers" ? "cust" : "pros") }));
        if (bucket === "customers") state.customers = list;
        else state.prospects = list;
        saveCurrentLists();
        renderCrmModules();
        setStatus(`Imported ${list.length} ${bucket === "customers" ? "existing customers" : "prospects"}.`, "good");
      }
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to import file.", "bad");
    } finally {
      inputEl.value = "";
    }
  }

  function handleDelegatedClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    if (button.classList.contains("module-tab")) return;
    switch (action) {
      case "import-products": {
        const input = document.getElementById("productFileInput");
        if (input) input.click();
        break;
      }
      case "load-record": {
        const id = button.dataset.recordId;
        const bucket = button.dataset.recordBucket || "prospects";
        const record = findRecord(bucket, id);
        if (record) {
          loadRecordToForm(record);
          switchModule("analysis");
          handleGenerate().catch((error) => setStatus(error.message || "Failed to analyze loaded record.", "bad"));
        }
        break;
      }
      case "delete-record": {
        const id = button.dataset.recordId;
        const bucket = button.dataset.recordBucket || "prospects";
        const record = findRecord(bucket, id);
        if (confirm(`Delete ${record ? record.companyName || "this record" : "this record"}?`)) deleteRecord(bucket, id);
        break;
      }
      default:
        break;
    }
  }

  async function handleDelegatedChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.id === "prospectFileInput") await handleImportClick("prospects", input);
    else if (input.id === "customerFileInput") await handleImportClick("customers", input);
    else if (input.id === "productFileInput") await handleImportClick("products", input);
  }

  function fillDemo() {
    setFormValues({
      companyName: "B&H Photo Video",
      contactName: "",
      website: "https://www.bhphotovideo.com/",
      city: "New York",
      instagramUrl: "",
      facebookUrl: "",
      businessNotes: "Large photo/video retailer with strong online and showroom presence.",
      sourceNotes: ""
    });
    state.currentAnalysis = null;
    state.activeRecord = { bucket: "prospects", id: null };
    setSaveButtonLabel();
    setStatus("Demo data loaded. Click Generate to analyze it.", "warn");
  }

  function bindEvents() {
    DOM.tabs.forEach((tab) => tab.addEventListener("click", () => switchModule(tab.dataset.module)));
    DOM.agentForm.addEventListener("submit", handleGenerate);
    DOM.saveBtn.addEventListener("click", handleSave);
    DOM.copyReportBtn.addEventListener("click", handleCopyReport);
    DOM.copyEmailBtn.addEventListener("click", handleCopyEmail);
    DOM.exportBtn.addEventListener("click", handleExport);
    DOM.resetBtn.addEventListener("click", resetForm);
    DOM.fillDemoBtn.addEventListener("click", fillDemo);
    DOM.prospectImportBtn.addEventListener("click", () => DOM.prospectFileInput?.click());
    DOM.customerImportBtn.addEventListener("click", () => DOM.customerFileInput?.click());
    document.addEventListener("click", handleDelegatedClick);
    document.addEventListener("change", handleDelegatedChange);
  }

  function init() {
    bindEvents();
    renderProductLibrary();
    renderCrmModules();
    setSaveButtonLabel();
    setStatus("Ready", "");
    switchModule("analysis");
    showAnalysisPanel(false);
    DOM.copyReportBtn.disabled = true;
    DOM.copyEmailBtn.disabled = true;
    DOM.exportBtn.disabled = true;
    DOM.saveBtn.disabled = true;
  }

  init();
})();

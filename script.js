(function () {
  "use strict";

  const API_BASE = location.protocol === "file:" ? "http://127.0.0.1:8787" : location.origin;
  const STORAGE_KEYS = {
    customerPool: "phottix.customerAgent.customerPool.v1",
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

  const FOLLOW_UP_STATUSES = [
    { id: "notContacted", label: "Not Contacted / 未联系", tone: "" },
    { id: "emailSent", label: "Email Sent / 已发邮件", tone: "warn" },
    { id: "followUpNeeded", label: "Follow-up Needed / 需要跟进", tone: "warn" },
    { id: "replied", label: "Replied / 已回复", tone: "good" },
    { id: "qualified", label: "Qualified / 已确认机会", tone: "good" },
    { id: "notFit", label: "Not Fit / 暂不匹配", tone: "bad" },
    { id: "converted", label: "Converted / 已转客户", tone: "good" },
    { id: "dormant", label: "Dormant / 暂停跟进", tone: "" }
  ];

  const DEFAULT_PRODUCT_NAMES = new Set(DEFAULT_PRODUCTS.map((product) => product.name.toLowerCase()));
  const ANALYSIS_VERSION_PREFIX = "analysis-v";

  const FOUR_SCORE_DEFS = [
    { key: "customerPriorityScore", label: "Customer Priority / 客户优先级" },
    { key: "productFitScore", label: "Product Fit / 产品匹配度" },
    { key: "dataConfidenceScore", label: "Data Confidence / 资料可信度" },
    { key: "outreachReadinessScore", label: "Outreach Readiness / 开发准备度" }
  ];

  const IMPORT_UPDATE_KEYS = new Set([
    "followUpStatus",
    "nextFollowUpDate",
    "lastContactedAt",
    "manualRating",
    "manualScore",
    "manualOverrideReason"
  ]);

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
    },
    {
      domainPattern: /(^|\.)mktradingco\.com$/i,
      grade: "A",
      score: 88,
      businessTypes: [
        "Retail / 零售经销",
        "Photo & Video Retail / 摄影与视频器材零售",
        "Camera Store / 相机店",
        "Online Shop / 线上商店"
      ],
      note: "MK Trading Co. 是已确认的摄影器材线上零售客户，网站有 Phottix、Camera Accessories、Lenses、Flash Units 和购物车信号。"
    },
    {
      domainPattern: /(^|\.)fototecnica\.com$/i,
      grade: "A",
      score: 92,
      businessTypes: [
        "Wholesale / 批发经销",
        "Retail / 零售经销",
        "Photo & Video Retail / 摄影与视频器材零售",
        "Camera Store / 相机店"
      ],
      note: "Foto Tecnica Import 是西语摄影/视频器材品牌代理与进口商，网站列出 Marcas que representamos、Phottix 和 Dónde comprar。"
    }
  ];

  const MULTILINGUAL_TERMS = {
    wholesale: [/批发|批發|批發商|卸売|도매/i, /grossiste|vente en gros|großhandel|grosshandel|mayorista|al por mayor|atacado|revendedor|ingrosso/i],
    distributor: [/经销|經銷|代理商|分销|分銷|販売代理店|代理店|유통|대리점/i, /distributeur|distribuidor|distribuzione|vertrieb|händler|haendler|revendeur|revendedor|rivenditore|import(?:ador)?|representamos|representante|marcas que representamos/i],
    retail: [/零售|零售店|销售|銷售|門市|门市|小売|販売|매장|소매/i, /retail|retailer|shop|store|tienda|boutique|magasin|geschäft|geschaeft|negozio|loja|winkel|d[oó]nde comprar|nuestras tiendas|tiendas/i],
    productSales: [/产品|產品|商品|购买|購買|下单|下單|注文|購入|제품|구매/i, /products?|catalog|catalogue|comprar|acheter|kaufen|acquista|compra|compras|comprar online|comprar ahora|marcas|brands/i],
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
    manualOverridePanel: document.getElementById("manualOverridePanel"),
    judgingStandardList: document.getElementById("judgingStandardList"),
    scoringWeightList: document.getElementById("scoringWeightList"),
    scopeList: document.getElementById("scopeList"),
    ratingList: document.getElementById("ratingList"),
    signalSummary: document.getElementById("signalSummary"),
    dealerProducts: document.getElementById("dealerProducts"),
    endUserProducts: document.getElementById("endUserProducts"),
    emailPreview: document.getElementById("emailPreview"),
    emailTemplateVariables: document.getElementById("emailTemplateVariables"),
    customEmailTemplate: document.getElementById("customEmailTemplate"),
    emailHistoryList: document.getElementById("emailHistoryList"),
    suggestionList: document.getElementById("suggestionList"),
    productLibrary: document.querySelector("[data-product-library]"),
    agentForm: document.getElementById("agentForm"),
    companyName: document.getElementById("companyName"),
    contactName: document.getElementById("contactName"),
    contactEmail: document.getElementById("contactEmail"),
    emailPurpose: document.getElementById("emailPurpose"),
    customerType: document.getElementById("customerType"),
    website: document.getElementById("website"),
    city: document.getElementById("city"),
    instagramUrl: document.getElementById("instagramUrl"),
    facebookUrl: document.getElementById("facebookUrl"),
    businessNotes: document.getElementById("businessNotes"),
    manualWebsiteSummary: document.getElementById("manualWebsiteSummary"),
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
    customerBulkAnalyzeBtn: document.getElementById("customerBulkAnalyzeBtn"),
    customerExportBtn: document.getElementById("customerExportBtn"),
    customerFileInput: document.getElementById("customerFileInput"),
    customerImportStatus: document.getElementById("customerImportStatus"),
    customerList: document.getElementById("customerList")
  };

  const state = {
    currentAnalysis: null,
    activeRecord: { bucket: "prospects", id: null, customerType: "prospect" },
    customerPool: migrateCustomerPool(),
    get prospects() {
      return this.customerPool.filter((record) => normalizeCustomerType(record.customerType || record.bucket) === "prospect");
    },
    set prospects(list) {
      this.customerPool = [
        ...this.customerPool.filter((record) => normalizeCustomerType(record.customerType || record.bucket) === "existing"),
        ...list.map((record) => ({ ...record, bucket: "prospects", customerType: "prospect" }))
      ];
    },
    get customers() {
      return this.customerPool.filter((record) => normalizeCustomerType(record.customerType || record.bucket) === "existing");
    },
    set customers(list) {
      this.customerPool = [
        ...this.customerPool.filter((record) => normalizeCustomerType(record.customerType || record.bucket) === "prospect"),
        ...list.map((record) => ({ ...record, bucket: "customers", customerType: "existing" }))
      ];
    },
    products: loadStoredProducts(),
    productSource: loadStoredValue(STORAGE_KEYS.productSource) || "default",
    productFilters: {
      query: "",
      selectedOnly: false
    },
    bulkRunning: false,
    pendingStatuses: {
      customers: "统一客户池：导入潜在客户会标记 Prospect，导入旧客户会标记 Existing；重复公司+官网会提示合并。",
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

  function normalizeCustomerType(value) {
    const text = normalizeText(value).toLowerCase();
    if (/existing|customer|old|旧|老|已成交|converted/.test(text)) return "existing";
    return "prospect";
  }

  function customerTypeLabel(value) {
    return normalizeCustomerType(value) === "existing" ? "Existing / 旧客户" : "Prospect / 潜在客户";
  }

  function normalizeCompanyKey(value) {
    return normalizeText(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
  }

  function customerDomainKey(record) {
    return domainFromUrl(record?.website || "");
  }

  function customerDuplicateKey(record) {
    const company = normalizeCompanyKey(record?.companyName || "");
    const domain = customerDomainKey(record);
    if (company && domain) return `${company}|${domain}`;
    if (record?.contactEmail) return `email|${normalizeText(record.contactEmail).toLowerCase()}`;
    return "";
  }

  function prepareCustomerRecord(record, type = "prospect") {
    const normalizedType = normalizeCustomerType(record.customerType || record.customer_type || record.bucket || type);
    return {
      ...record,
      bucket: normalizedType === "existing" ? "customers" : "prospects",
      customerType: normalizedType,
      emailPurpose: normalizeEmailPurpose(record.emailPurpose, normalizedType)
    };
  }

  function mergeCustomerRecords(existing, incoming) {
    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming || {})) {
      if (value === undefined || value === null || value === "") continue;
      if (!merged[key] || key === "savedAt" || key === "customerType" || key === "bucket" || IMPORT_UPDATE_KEYS.has(key)) merged[key] = value;
    }
    if (Array.isArray(existing.emailHistory) || Array.isArray(incoming.emailHistory)) {
      merged.emailHistory = mergeEmailHistory(existing.emailHistory, incoming.emailHistory);
    }
    if (normalizeCustomerType(existing.customerType || existing.bucket) === "existing" || normalizeCustomerType(incoming.customerType || incoming.bucket) === "existing") {
      merged.customerType = "existing";
      merged.bucket = "customers";
      if (!merged.emailPurpose || merged.emailPurpose === "firstTouch") merged.emailPurpose = "existingCustomerUpdate";
    } else {
      merged.customerType = "prospect";
      merged.bucket = "prospects";
      if (!merged.emailPurpose) merged.emailPurpose = "firstTouch";
    }
    merged.savedAt = incoming.savedAt || existing.savedAt || new Date().toISOString();
    return merged;
  }

  function mergeCustomerList(records) {
    const merged = [];
    const keyIndex = new Map();
    let duplicateCount = 0;
    for (const record of records.map((item) => prepareCustomerRecord(item))) {
      const key = customerDuplicateKey(record);
      if (key && keyIndex.has(key)) {
        const index = keyIndex.get(key);
        merged[index] = mergeCustomerRecords(merged[index], record);
        duplicateCount += 1;
      } else {
        if (key) keyIndex.set(key, merged.length);
        merged.push(record);
      }
    }
    return { records: merged, duplicateCount };
  }

  function migrateCustomerPool() {
    const existingPool = loadStoredList(STORAGE_KEYS.customerPool).map((record) => prepareCustomerRecord(record));
    if (existingPool.length) return mergeCustomerList(existingPool).records;
    const legacyProspects = loadStoredList(STORAGE_KEYS.prospects).map((record) => prepareCustomerRecord(record, "prospect"));
    const legacyCustomers = loadStoredList(STORAGE_KEYS.customers).map((record) => prepareCustomerRecord(record, "existing"));
    return mergeCustomerList([...legacyProspects, ...legacyCustomers]).records;
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
    const text = normalizeText(input).replace(/[<>"']/g, "").replace(/[),.;\]]+$/g, "");
    if (!text) return "";
    if (/^https?:\/\//i.test(text)) return text;
    if (/^www\./i.test(text)) return `https://${text}`;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(text)) return `https://${text}`;
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

  function normalizeEmailHistoryItem(item) {
    if (!item || typeof item !== "object") return null;
    const subject = normalizeText(item.subject || item.emailSubject || "");
    const body = normalizeText(item.body || item.emailBody || "");
    if (!subject && !body) return null;
    return {
      id: item.id || makeId("email"),
      createdAt: item.createdAt || item.sentAt || new Date().toISOString(),
      purpose: normalizeEmailPurpose(item.purpose || item.emailPurpose || "firstTouch"),
      subject,
      body,
      preview: item.preview || item.emailPreview || (subject || body ? `Subject: ${subject}\n\n${body}` : "")
    };
  }

  function mergeEmailHistory(...histories) {
    const merged = [];
    const seen = new Set();
    for (const history of histories) {
      for (const item of Array.isArray(history) ? history : []) {
        const normalized = normalizeEmailHistoryItem(item);
        if (!normalized) continue;
        const key = `${normalized.subject}||${normalizeText(normalized.body).slice(0, 300)}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(normalized);
      }
    }
    return merged
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10);
  }

  function appendEmailHistory(history, analysis) {
    const email = analysis?.email || {};
    const nextItem = normalizeEmailHistoryItem({
      createdAt: new Date().toISOString(),
      purpose: analysis?.emailPurpose || "firstTouch",
      subject: email.subject || "",
      body: email.body || "",
      preview: email.preview || ""
    });
    if (!nextItem) return mergeEmailHistory(history);
    return mergeEmailHistory([nextItem], history);
  }

  function inferEmailPurposeFromBucket(bucket) {
    return normalizeCustomerType(bucket) === "existing" ? "existingCustomerUpdate" : "firstTouch";
  }

  function normalizeEmailPurpose(value, fallbackBucket = "prospects") {
    const purpose = normalizeText(value);
    return ["firstTouch", "productFollowUp", "eventInvitation", "existingCustomerUpdate", "reactivation", "holidayGreeting"].includes(purpose)
      ? purpose
      : inferEmailPurposeFromBucket(fallbackBucket);
  }

  function normalizeFollowUpStatus(value) {
    const text = normalizeText(value).toLowerCase().replace(/[\s_-]+/g, "");
    if (!text) return "notContacted";
    const direct = FOLLOW_UP_STATUSES.find((item) => item.id.toLowerCase() === text);
    if (direct) return direct.id;
    if (/notcontacted|new|pending|未联系|未聯繫|未跟进|未跟進/.test(text)) return "notContacted";
    if (/emailsent|sent|contacted|已发|已發|已联系|已聯繫/.test(text)) return "emailSent";
    if (/followup|needfollow|next|跟进|跟進|需要/.test(text)) return "followUpNeeded";
    if (/replied|reply|responded|response|已回复|已回覆/.test(text)) return "replied";
    if (/qualified|opportunity|机会|機會|确认机会|確認機會/.test(text)) return "qualified";
    if (/notfit|unfit|badfit|不匹配|不合适|不合適/.test(text)) return "notFit";
    if (/converted|customer|won|成交|已转客户|已轉客戶/.test(text)) return "converted";
    if (/dormant|paused|sleep|inactive|暂停|暫停|沉睡/.test(text)) return "dormant";
    return "notContacted";
  }

  function followUpStatusMeta(value) {
    const normalized = normalizeFollowUpStatus(value);
    return FOLLOW_UP_STATUSES.find((item) => item.id === normalized) || FOLLOW_UP_STATUSES[0];
  }

  function formatDateInputValue(value) {
    const text = normalizeText(value);
    if (!text) return "";
    const direct = text.match(/^\d{4}-\d{2}-\d{2}$/);
    if (direct) return text;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }

  function formatDateTimeDisplay(value) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat("zh-HK", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value));
    } catch {
      return String(value || "");
    }
  }

  function daysSince(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000));
  }

  function nextAnalysisVersion(record) {
    const current = Number(record?.analysisVersionNumber || String(record?.analysisVersion || "").match(/\d+/)?.[0] || 0) || 0;
    return current + 1;
  }

  function analysisVersionLabel(number) {
    return `${ANALYSIS_VERSION_PREFIX}${Number(number || 1)}`;
  }

  function normalizeManualGrade(value) {
    const grade = normalizeText(value).toUpperCase();
    return ["A", "B", "C", "D", "NR"].includes(grade) ? grade : "";
  }

  function normalizeManualScore(value) {
    if (value === "" || value === null || value === undefined) return "";
    const number = Number(value);
    if (Number.isNaN(number)) return "";
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function ratingTone(grade) {
    return grade === "A" ? "good" : grade === "D" ? "bad" : "warn";
  }

  function isUsableContactEmail(email) {
    const text = normalizeText(email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return false;
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(text)) return false;
    return !/^(no-?reply|donotreply|privacy|legal|abuse|postmaster|webmaster|support\.?bot)@/i.test(text);
  }

  function extractContactEmails(value) {
    const text = String(value || "").replace(/\s*\[\s*at\s*\]\s*/gi, "@").replace(/\s*\(\s*at\s*\)\s*/gi, "@");
    const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return dedupeLines(matches.map((email) => email.toLowerCase()).filter(isUsableContactEmail));
  }

  function preferredContactEmail(...sources) {
    const emails = dedupeLines(sources.flatMap((source) => extractContactEmails(source)));
    if (!emails.length) return "";
    const preferred = emails.find((email) => /^(sales|info|contact|hello|office|business|commercial|trade|dealer|wholesale)@/i.test(email));
    return preferred || emails[0];
  }

  function getFormValues() {
    return {
      companyName: normalizeText(DOM.companyName.value),
      contactName: normalizeText(DOM.contactName.value),
      contactEmail: normalizeText(DOM.contactEmail?.value),
      emailPurpose: DOM.emailPurpose?.value || "",
      customerType: normalizeCustomerType(DOM.customerType?.value || state.activeRecord.customerType || state.activeRecord.bucket),
      website: normalizeUrl(DOM.website.value),
      city: normalizeText(DOM.city.value),
      instagramUrl: normalizeUrl(DOM.instagramUrl.value),
      facebookUrl: normalizeUrl(DOM.facebookUrl.value),
      businessNotes: normalizeText(DOM.businessNotes.value),
      manualWebsiteSummary: normalizeText(DOM.manualWebsiteSummary?.value),
      sourceNotes: normalizeText(DOM.sourceNotes.value)
    };
  }

  function setFormValues(record) {
    DOM.companyName.value = record.companyName || "";
    DOM.contactName.value = record.contactName || "";
    if (DOM.contactEmail) DOM.contactEmail.value = record.contactEmail || "";
    if (DOM.emailPurpose) DOM.emailPurpose.value = record.emailPurpose || inferEmailPurposeFromBucket(record.customerType || record.bucket);
    if (DOM.customerType) DOM.customerType.value = normalizeCustomerType(record.customerType || record.bucket);
    DOM.website.value = record.website || "";
    DOM.city.value = record.city || "";
    DOM.instagramUrl.value = record.instagramUrl || "";
    DOM.facebookUrl.value = record.facebookUrl || "";
    DOM.businessNotes.value = record.businessNotes || "";
    if (DOM.manualWebsiteSummary) DOM.manualWebsiteSummary.value = record.manualWebsiteSummary || "";
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
    const typeLabel = normalizeCustomerType(state.activeRecord.customerType || state.activeRecord.bucket) === "existing"
      ? "旧客户 / Existing"
      : "潜在客户 / Prospect";
    DOM.saveBtn.textContent = `保存到客户池 (${typeLabel}) / Save to Pool`;
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
    for (const [key, value] of Object.entries(row || {})) {
      const rawKey = String(key).trim().toLowerCase();
      normalized[rawKey] = value;
      normalized[rawKey.replace(/[\s_-]+/g, "")] = value;
    }
    const hasFollowUpStatus = row.followUpStatus !== undefined || row.follow_up_status !== undefined || normalized.followupstatus !== undefined || normalized.follow_up_status !== undefined || normalized.status !== undefined || normalized.crm_status !== undefined;
    const hasNextFollowUpDate = row.nextFollowUpDate !== undefined || row.next_follow_up_date !== undefined || row.next_follow_up !== undefined || normalized.nextfollowupdate !== undefined || normalized.next_follow_up_date !== undefined || normalized.next_follow_up !== undefined;
    const hasLastContactedAt = row.lastContactedAt !== undefined || row.last_contacted_at !== undefined || normalized.lastcontactedat !== undefined || normalized.last_contacted_at !== undefined;
    return {
      id: row.id || makeId("row"),
      companyName: normalizeText(row.companyName || normalized.company_name || normalized.company || normalized.name),
      contactName: normalizeText(row.contactName || normalized.contact_name || normalized.contactname || normalized["联系人名称"] || normalized["主要联系人名称"] || normalized["主要联系人"] || normalized.contact || normalized.primary_contact || normalized.primarycontact),
      emailPurpose: normalizeText(row.emailPurpose || normalized.email_purpose || normalized.emailpurpose || inferEmailPurposeFromBucket(row.bucket || normalized.bucket)),
      contactEmail: normalizeText(row.contactEmail || normalized.contact_email || normalized.contactemail || normalized["联系人邮箱"] || normalized["主要联系人邮箱"] || normalized["主要邮箱"] || normalized.email || normalized.emailaddress || normalized.email_address || normalized["e-mail"] || normalized.mail || normalized.business_email || normalized.businessemail || normalized.primary_email || normalized.primaryemail),
      primaryContact: normalizeText(row.primaryContact || normalized["主要联系人名称"] || normalized.primary_contact || normalized.primarycontact),
      primaryEmail: normalizeText(row.primaryEmail || normalized["主要联系人邮箱"] || normalized.primary_email || normalized.primaryemail),
      website: normalizeUrl(row.website || normalized.website || normalized.domain || normalized.url),
      city: normalizeText(row.city || normalized.city || normalized.country),
      instagramUrl: normalizeUrl(row.instagramUrl || normalized.instagram_url || normalized.instagram),
      facebookUrl: normalizeUrl(row.facebookUrl || normalized.facebook_url || normalized.facebook),
      businessNotes: normalizeText(row.businessNotes || normalized.business_notes || normalized.notes || normalized.business_note),
      manualWebsiteSummary: normalizeText(row.manualWebsiteSummary || row.manual_website_summary || normalized.manualwebsitesummary || normalized.manual_website_summary || normalized.website_summary || normalized.websitesummary || normalized["网站摘要"] || normalized["網站摘要"] || normalized["官网摘要"] || normalized["官網摘要"] || ""),
      sourceNotes: normalizeText(row.sourceNotes || normalized.source_notes || normalized.source_note),
      followUpStatus: hasFollowUpStatus ? normalizeFollowUpStatus(row.followUpStatus || row.follow_up_status || normalized.followupstatus || normalized.follow_up_status || normalized.status || normalized.crm_status) : "",
      nextFollowUpDate: hasNextFollowUpDate ? formatDateInputValue(row.nextFollowUpDate || row.next_follow_up_date || row.next_follow_up || normalized.nextfollowupdate || normalized.next_follow_up_date || normalized.next_follow_up) : "",
      lastContactedAt: hasLastContactedAt ? (row.lastContactedAt || row.last_contacted_at || normalized.lastcontactedat || normalized.last_contacted_at || "") : "",
      savedAt: row.savedAt || new Date().toISOString(),
      rating: normalizeText(row.rating || normalized.rating || ""),
      score: Number(row.score || normalized.score || 0) || 0,
      customerPriorityScore: Number(row.customerPriorityScore || normalized.customer_priority_score || normalized.customerpriorityscore || 0) || 0,
      productFitScore: Number(row.productFitScore || normalized.product_fit_score || normalized.productfitscore || 0) || 0,
      dataConfidenceScore: Number(row.dataConfidenceScore || normalized.data_confidence_score || normalized.dataconfidencescore || 0) || 0,
      outreachReadinessScore: Number(row.outreachReadinessScore || normalized.outreach_readiness_score || normalized.outreachreadinessscore || 0) || 0,
      customerType: normalizeCustomerType(row.customerType || row.customer_type || normalized.customer_type || normalized.customertype || normalized["客户类型"] || normalized["客戶類型"] || normalized["客户状态"] || normalized["客戶狀態"] || normalized.type || normalized.customerstatus || normalized.customer_status || row.bucket || normalized.bucket),
      lastAnalyzedAt: row.lastAnalyzedAt || row.last_analyzed_at || normalized.lastanalyzedat || normalized.last_analyzed_at || normalized["上次分析时间"] || normalized["上次分析時間"] || "",
      analysisVersion: normalizeText(row.analysisVersion || row.analysis_version || normalized.analysisversion || normalized.analysis_version || normalized["分析版本"] || ""),
      analysisVersionNumber: Number(row.analysisVersionNumber || row.analysis_version_number || normalized.analysisversionnumber || normalized.analysis_version_number || 0) || 0,
      aiRating: normalizeText(row.aiRating || row.ai_rating || normalized.airating || normalized.ai_rating || ""),
      aiScore: Number(row.aiScore || row.ai_score || normalized.aiscore || normalized.ai_score || 0) || 0,
      manualRating: normalizeManualGrade(row.manualRating || row.manual_rating || normalized.manualrating || normalized.manual_rating || normalized["人工评级"] || normalized["人工評級"]),
      manualScore: normalizeManualScore(row.manualScore || row.manual_score || normalized.manualscore || normalized.manual_score || normalized["人工分数"] || normalized["人工分數"]),
      manualOverrideReason: normalizeText(row.manualOverrideReason || row.manual_override_reason || normalized.manualoverridereason || normalized.manual_override_reason || normalized["人工修正原因"] || normalized["人工修正理由"] || ""),
      manualOverrideAt: row.manualOverrideAt || row.manual_override_at || normalized.manualoverrideat || normalized.manual_override_at || "",
      suggestedAction: normalizeText(row.suggestedAction || row.suggested_action || normalized.suggestedaction || normalized.suggested_action || normalized["建议行动"] || normalized["建議行動"] || ""),
      emailHistory: mergeEmailHistory(row.emailHistory || []),
      keyDecision: normalizeText(row.keyDecision || normalized.key_decision || ""),
      businessTypes: normalizeText(row.businessTypes || normalized.business_types || ""),
      bucket: row.bucket || normalized.bucket || "prospects",
      analysisSummary: normalizeText(row.analysisSummary || normalized.analysis_summary || "")
    };
  }

  function normalizeProductRecord(row) {
    const normalized = {};
    for (const [key, value] of Object.entries(row || {})) normalized[String(key).toLowerCase()] = value;
    const recommendationValue = row.useForRecommendation ?? row.use_for_recommendation ?? normalized.useforrecommendation ?? normalized.use_for_recommendation ?? normalized.recommend ?? normalized.active;
    const globalPushValue = row.globalPush ?? row.global_push ?? row.forceIncludeInEmail ?? row.force_include_in_email ?? normalized.globalpush ?? normalized.global_push ?? normalized.forceincludeinemail ?? normalized.force_include_in_email ?? normalized.email_include ?? normalized.include_in_email;
    const statusValue = row.productStatus ?? row.product_status ?? row.status ?? normalized.productstatus ?? normalized.product_status ?? normalized.status ?? normalized["产品状态"] ?? normalized["產品狀態"];
    const disabledValue = row.excludeFromRecommendation ?? row.exclude_from_recommendation ?? normalized.excludefromrecommendation ?? normalized.exclude_from_recommendation;
    const hasRecommendationValue = recommendationValue !== undefined && recommendationValue !== null && String(recommendationValue).trim() !== "";
    const isExplicitlySelected = /^(true|1|yes|y|on|selected|recommend|recommended)$/i.test(String(recommendationValue || ""));
    const isGlobalPush = /^(true|1|yes|y|on|selected|include|included|force|push|priority)$/i.test(String(globalPushValue || ""));
    const isDisabled = /^(false|0|no|n|off|disabled|exclude|excluded)$/i.test(String(recommendationValue || "")) || /^(true|1|yes|y|on)$/i.test(String(disabledValue || ""));
    return {
      id: row.id || makeId("prod"),
      category: normalizeText(row.category || normalized.category || normalized["类别"] || normalized["類別"] || "Uncategorized"),
      name: normalizeText(row.name || normalized.name || normalized.product_name || normalized.title || normalized["标题"] || normalized["標題"] || normalized["产品名称"] || normalized["產品名稱"] || "Untitled Product"),
      description: normalizeText(row.description || normalized.description || normalized.desc || normalized["描述"] || normalized["子标题"] || normalized["子標題"] || ""),
      tags: normalizeText(row.tags || normalized.tags || ""),
      sku: normalizeText(row.sku || normalized.sku || ""),
      brand: normalizeText(row.brand || normalized.brand || ""),
      price: normalizeText(row.price || normalized.price || ""),
      sourceType: normalizeText(row.sourceType || normalized.sourcetype || (DEFAULT_PRODUCT_NAMES.has(normalizeText(row.name || normalized.name || normalized.product_name || normalized.title).toLowerCase()) ? "default" : "excel")),
      sourceSheet: normalizeText(row.sourceSheet || normalized.sourcesheet || ""),
      note: normalizeText(row.note || normalized.note || ""),
      productStatus: normalizeProductStatus(statusValue),
      useForRecommendation: hasRecommendationValue ? isExplicitlySelected && !isDisabled : false,
      globalPush: isGlobalPush
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

  async function analyzeWebsiteUrl(url) {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;
    try {
      return await fetchJson(`/api/analyze-url?url=${encodeURIComponent(normalized)}`);
    } catch {
      return null;
    }
  }

  async function findWebsite(companyName, country = "") {
    const company = normalizeText(companyName);
    if (!company) return null;
    try {
      return await fetchJson(`/api/find-website?company=${encodeURIComponent(company)}&country=${encodeURIComponent(country || "")}`);
    } catch {
      return null;
    }
  }

  async function searchEvidence(companyName, country = "", industry = "") {
    const company = normalizeText(companyName);
    if (!company) return null;
    try {
      return await fetchJson(`/api/search-evidence?company=${encodeURIComponent(company)}&country=${encodeURIComponent(country || "")}&industry=${encodeURIComponent(industry || "")}`);
    } catch {
      return null;
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
    if (input.manualWebsiteSummary) blocks.push({ label: "Manual Website Summary / 手动网站摘要", url: input.website || "", text: input.manualWebsiteSummary });
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
        let data = platform === "website"
          ? (await analyzeWebsiteUrl(normalized)) || (await fetchExtraction(normalized))
          : await fetchExtraction(normalized);
        if (platform === "website" && (data?.rating === "NR" || data?.blocked || !normalizeText([data?.title, data?.description, data?.body].filter(Boolean).join(" ")))) {
          try {
            const fallbackData = await fetchExtraction(normalized);
            if (fallbackData && !isBlockedExtraction(fallbackData)) data = fallbackData;
          } catch {
            // Keep the backend analysis result so the UI can explain the fetch failure.
          }
        }
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
    const websiteText = websiteSource ? normalizeText([websiteSource.title, websiteSource.description, websiteSource.body].filter(Boolean).join(" ")) : "";
    const websiteFailed = Boolean(input.website && (!websiteSource || websiteSource.error || !websiteText || isBlockedExtraction(websiteSource.raw || websiteSource)));
    if (websiteFailed && input.companyName) {
      const industryHint = [
        input.businessNotes,
        input.manualWebsiteSummary,
        "camera photo video lighting retailer distributor store"
      ].filter(Boolean).join(" ");
      const fallback = await searchEvidence(input.companyName, input.city, industryHint);
      if (fallback?.body || fallback?.description) {
        sources.push({
          platform: "search",
          url: "",
          sourceLabel: "Search Evidence",
          title: normalizeText(fallback.title || "Search Evidence"),
          description: normalizeText(fallback.description || ""),
          body: normalizeText(fallback.body || ""),
          raw: fallback
        });
      }
    }
    const discoveredFromWebsite = detectSocialUrls([
      websiteSource ? [websiteSource.title, websiteSource.description, websiteSource.body].join("\n") : "",
      input.manualWebsiteSummary,
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
    const searchFallback = sources.find((source) => source.platform === "search");
    const websiteHasText = Boolean(website && normalizeText([website.title, website.description, website.body].filter(Boolean).join(" ")));
    const websiteBodyLength = normalizeText(website?.body || "").length;
    const websiteTitleOnly = Boolean(website && normalizeText(website.title || website.description) && websiteBodyLength < 80);
    const websiteFailed = Boolean(website && (website.error || !websiteHasText || isBlockedExtraction(website.raw || website)));
    return {
      websiteBlocked: websiteFailed,
      searchFallbackUsed: Boolean(searchFallback),
      websiteTitleOnly,
      blockedCount: blocked.length,
      failedCount: failed.length,
      usableCount: usable.length,
      message: websiteFailed && website?.error
        ? `官网抓取失败：${website.error}${searchFallback ? "；已启用公司名 + 行业关键词搜索证据作为降级补充。" : ""}`
        : websiteFailed
          ? `官网没有抓到足够有效正文${searchFallback ? "，已启用搜索证据作为降级补充。" : "，当前结果不代表真实客户价值。"}`
          : blocked.length
        ? "部分网页返回 CAPTCHA / Cloudflare / access denied，评分只使用抓到的有效文字。"
        : failed.length
          ? "部分网页抓取失败，评分只使用已抓到的有效文字。"
          : websiteTitleOnly
            ? "官网只抓到标题或极少正文，资料可信度已自动调低。"
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
    return calculateSalesScoreDetails(categoryMap).score;
  }

  function calculateSalesScoreDetails(categoryMap) {
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
    const score = Math.min(100, channelCore + salesAccess + serviceDepth + creatorDepth);
    return {
      score,
      components: [
        { label: "Core channel fit", points: channelCore, cap: 55, detail: "Wholesale + retail + photo/video + camera-store signals" },
        { label: "Sales access", points: salesAccess, cap: 25, detail: "Online shop + physical store/contact signals" },
        { label: "Service depth", points: serviceDepth, cap: 15, detail: "Studio + services + education signals" },
        { label: "Creator depth", points: creatorDepth, cap: 5, detail: "Creator/social-content signals" }
      ],
      categoryTotals: [
        { label: "Wholesale", points: wholesale },
        { label: "Retail", points: retail },
        { label: "Photo & Video Retail", points: photoVideo },
        { label: "Camera Store", points: cameraStore },
        { label: "Online Shop", points: online },
        { label: "Physical Store", points: physical },
        { label: "Studio", points: studio },
        { label: "Services", points: services },
        { label: "Events & Education", points: education },
        { label: "Creator", points: creator }
      ].filter((item) => item.points > 0)
    };
  }

  function buildScoreDetails({ localScoreDetails, websiteAnalysis, websiteScore, localScore, finalScore, ratingBand, sourceStatus }) {
    const websiteSource = websiteAnalysis?.source || "";
    const websiteConfidence = Number(websiteAnalysis?.confidence || 0) || 0;
    const source = ratingBand.grade === "NR"
      ? "Not rated"
      : websiteAnalysis?.rating && websiteScore >= localScore
        ? websiteSource === "known-fetch-fallback" ? "Known account fallback" : "Website analysis API"
        : "Local evidence scoring";
    const summary = ratingBand.grade === "NR"
      ? "No reliable score is shown because the website could not be read and no usable evidence was available."
      : `Final rating ${ratingBand.grade} uses ${source}. Final score ${finalScore}; local evidence score ${localScore}; website score ${websiteScore || 0}.`;
    const reportLines = [
      summary,
      `Rating thresholds: A 70+, B 40-69, C 25-39, D below 25, NR means not enough reliable evidence.`,
      websiteAnalysis
        ? `Website analysis: ${websiteAnalysis.rating || "NR"} / ${websiteScore || 0}, source ${websiteSource || "backend"}, confidence ${websiteConfidence}%.`
        : "Website analysis: not available.",
      `Local evidence score: ${localScore}.`,
      sourceStatus?.websiteBlocked ? "Fetch warning: website text was blocked or insufficient, so the result should be treated as evidence-limited." : "Fetch status: usable evidence was available."
    ];
    return {
      source,
      summary,
      thresholds: "A 70+, B 40-69, C 25-39, D <25, NR = not enough reliable evidence",
      components: localScoreDetails.components,
      categoryTotals: localScoreDetails.categoryTotals,
      reportLines
    };
  }

  function calculateFourScores({ analysisBase, input, sourceStatus, localScoreDetails, websiteAnalysis, dealerProducts, endUserProducts, globalPushProducts }) {
    const grade = analysisBase.grade || "D";
    const sourceText = normalizeText([
      input.website,
      input.instagramUrl,
      input.facebookUrl,
      input.businessNotes,
      input.manualWebsiteSummary,
      input.sourceNotes
    ].filter(Boolean).join(" "));
    const productCount = (dealerProducts || []).length + (endUserProducts || []).length;
    const selectedProductCount = getRecommendationCatalog(state.products.length ? state.products : normalizeCatalog(DEFAULT_PRODUCTS)).filter(isProductRecommendable).length;
    const evidenceCount = analysisBase.topSignals?.length || 0;
    const scopeCount = analysisBase.scopeLines?.length || 0;
    const businessTypeCount = analysisBase.businessTypes?.length || 0;
    const hasContact = Boolean(input.contactName || input.contactEmail);
    const hasWebsite = Boolean(input.website);
    const customerPriorityScore = Math.max(0, Math.min(100, Number(analysisBase.score || 0)));
    const productFitScore = Math.min(100,
      (productCount >= 6 ? 45 : productCount * 7) +
      (selectedProductCount ? 20 : 0) +
      ((globalPushProducts || []).length ? 10 : 0) +
      (businessTypeCount ? 15 : 0) +
      (grade === "A" ? 10 : grade === "B" ? 6 : grade === "C" ? 3 : 0)
    );
    const dataConfidenceScore = Math.min(100,
      (hasWebsite ? 25 : 0) +
      (sourceStatus?.websiteBlocked ? 0 : 25) +
      (sourceStatus?.websiteTitleOnly ? -18 : 0) +
      (sourceStatus?.searchFallbackUsed ? 10 : 0) +
      Math.min(25, evidenceCount * 5 + scopeCount * 3) +
      (websiteAnalysis?.confidence ? Math.min(15, Math.round(Number(websiteAnalysis.confidence || 0) / 7)) : 0) +
      (sourceText.length > 200 ? 10 : sourceText.length > 40 ? 5 : 0)
    );
    const outreachReadinessScore = Math.min(100,
      (customerPriorityScore >= 70 ? 30 : customerPriorityScore >= 40 ? 20 : customerPriorityScore >= 25 ? 12 : 4) +
      (productFitScore >= 60 ? 25 : productFitScore >= 35 ? 15 : productFitScore >= 15 ? 8 : 0) +
      (dataConfidenceScore >= 70 ? 20 : dataConfidenceScore >= 45 ? 12 : dataConfidenceScore >= 25 ? 6 : 0) +
      (hasContact ? 10 : 0) +
      (hasWebsite ? 8 : 0) +
      (analysisBase.emailPurpose ? 7 : 0)
    );
    return {
      customerPriorityScore,
      productFitScore,
      dataConfidenceScore,
      outreachReadinessScore
    };
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

  function normalizeProductStatus(status) {
    const text = normalizeText(status).toLowerCase();
    if (/new|新品|新款|重点新品/.test(text)) return "new";
    if (/phase[-\s]?out|phaseout|clearance|last chance|old|旧|舊|legacy|discontinued|低优先|低優先|清货|清貨|停产|停產/.test(text)) return "phaseOut";
    if (/donotrecommend|do not|don'?t|not recommend|never|exclude|disabled|不推荐|不推薦|不要推荐|不要推薦|停推/.test(text)) return "doNotRecommend";
    return "active";
  }

  function productStatusLabel(status) {
    const normalized = normalizeProductStatus(status);
    if (normalized === "new") return "New / 新品";
    if (normalized === "phaseOut") return "Phase-Out / 退市过渡";
    if (normalized === "doNotRecommend") return "Do Not Recommend / 不推荐";
    return "Active / 常规在售";
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

  function productMatchesQuery(product, query) {
    const normalizedQuery = normalizeText(query).toLowerCase();
    if (!normalizedQuery) return true;
    const haystack = normalizeText([
      product.name,
      product.category,
      product.description,
      product.tags,
      product.sku,
      product.brand,
      product.note
    ].join(" ")).toLowerCase();
    return normalizedQuery.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
  }

  function filterProductsForLibrary(products) {
    const query = state.productFilters.query;
    return products.filter((product) => {
      if (state.productFilters.selectedOnly && !isProductSelected(product)) return false;
      return productMatchesQuery(product, query);
    });
  }

  function scoreProduct(product, targetCategories, targetTerms, mode) {
    const haystack = normalizeText([product.name, product.description, product.tags, product.brand, product.category].join(" ")).toLowerCase();
    let score = 0;
    if (targetCategories.includes(product.category)) score += 8;
    if (mode === "dealer" && ["Lighting", "Modifiers", "Flash & Trigger", "Support & Accessories", "Power & Video"].includes(product.category)) score += 5;
    if (mode === "endUser" && ["Lighting", "Modifiers", "Flash & Trigger", "Power & Video"].includes(product.category)) score += 5;
    if (isProductGlobalPush(product)) score += 10;
    if (normalizeProductStatus(product.productStatus) === "new") score += 8;
    if (normalizeProductStatus(product.productStatus) === "phaseOut") score -= 6;
    for (const term of targetTerms) if (haystack.includes(term)) score += 2;
    if (product.sourceType === "excel") score += 1;
    return score;
  }

  function isProductSelected(product) {
    return product?.useForRecommendation === true;
  }

  function isDefaultProduct(product) {
    return product?.sourceType === "default" || DEFAULT_PRODUCT_NAMES.has(normalizeText(product?.name).toLowerCase());
  }

  function isProductRecommendable(product) {
    return (isProductSelected(product) || isDefaultProduct(product)) && normalizeProductStatus(product?.productStatus) !== "doNotRecommend";
  }

  function isProductGlobalPush(product) {
    return product?.globalPush === true || product?.forceIncludeInEmail === true;
  }

  function getGlobalPushProducts(products) {
    return products.filter((product) => isProductGlobalPush(product) && isProductSelected(product) && normalizeProductStatus(product.productStatus) !== "doNotRecommend");
  }

  function pickProducts(products, targetCategories, targetTerms, mode) {
    const scored = products
      .filter(isProductRecommendable)
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

  function getRecommendationCatalog(products) {
    const selected = products.filter((product) => isProductSelected(product) && normalizeProductStatus(product?.productStatus) !== "doNotRecommend");
    if (selected.length) return selected;
    if (products.some((product) => product.sourceType === "excel")) return [];
    return normalizeCatalog(DEFAULT_PRODUCTS).map((product) => ({
      ...product,
      sourceType: "default",
      useForRecommendation: true
    }));
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

  function productExportLabel(product) {
    const lifecycle = productStatusLabel(product.productStatus).split("/")[0].trim();
    return `${product.name} [${lifecycle}]`;
  }

  function buildProductCards(products, analysis, mode) {
    if (!products.length) {
      return `<div class="bullet-item">No product matched yet. Full Catalog is searchable only; add products into the active Recommendation Pool before generating customer recommendations.</div>`;
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

  const EXPORT_BUSINESS_LABELS = [
    "Wholesale / Distributor",
    "Retail",
    "Photo & Video Retail",
    "Camera Store",
    "Online Shop",
    "Physical Store",
    "Studio",
    "Services",
    "Events & Education",
    "Creator",
    "Major Retailer",
    "Photo & Video Equipment"
  ];

  function englishFollowUpLabel(value) {
    const status = normalizeFollowUpStatus(value);
    const labels = {
      notContacted: "Not Contacted",
      emailSent: "Email Sent",
      followUpNeeded: "Follow-up Needed",
      replied: "Replied",
      qualified: "Qualified",
      notFit: "Not Fit",
      converted: "Converted",
      dormant: "Dormant"
    };
    return labels[status] || "Not Contacted";
  }

  function suggestedActionForRecord(record = {}) {
    const grade = normalizeText(record.grade || record.rating || record.aiRating || "").toUpperCase();
    const score = Number(record.score || record.aiScore || 0) || 0;
    const dataConfidence = Number(record.dataConfidenceScore || record.fourScores?.dataConfidenceScore || 0) || 0;
    const readiness = Number(record.outreachReadinessScore || record.fourScores?.outreachReadinessScore || 0) || 0;
    const contactEmail = normalizeText(record.contactEmail || "");
    if (!contactEmail) return "Verify contact email before outreach";
    if (dataConfidence > 0 && dataConfidence < 35) return "Enrich website evidence before sending";
    if (grade === "A" || score >= 70) {
      return readiness >= 60 ? "High priority: send first email" : "High fit: prepare contact and send";
    }
    if (grade === "B" || score >= 40) return "Medium priority: follow up with short email";
    if (grade === "C" || score >= 25) return "Low priority: send light touch or enrich data";
    if (grade === "NR") return "Pause: website evidence is not reliable yet";
    return "Pause or enrich before outreach";
  }

  function containsMojibake(value) {
    return /[鎵绁闆跺敭缁忛攢瑰彂涓庤嗛櫒鏉愰浂鍞鐩告満搴瀹炰綋闂ㄥ簵绾夸笂鍟嗶湇姒鑱旂郴]/.test(String(value || ""));
  }

  function canonicalBusinessLabels(value) {
    const text = normalizeText(value);
    if (!text) return [];
    const lower = text.toLowerCase();
    const labels = [];
    const add = (label) => {
      if (!labels.includes(label)) labels.push(label);
    };

    for (const label of EXPORT_BUSINESS_LABELS) {
      if (lower.includes(label.toLowerCase())) add(label);
    }
    if (/\bwholesale\b|\bdistributor\b|\bdealer\b|\bb2b\b|\btrade\b/i.test(text)) add("Wholesale / Distributor");
    if (/\bretail\b|\bstore\b|\bshop\b|\bsales\b/i.test(text)) add("Retail");
    if (/photo\s*&\s*video|photo and video|photo-video|camera gear|photo equipment|video equipment|photography equipment/i.test(text)) add("Photo & Video Retail");
    if (/camera store|camera shop|camera center|camera centre/i.test(text)) add("Camera Store");
    if (/online shop|online store|cart|checkout|buy online|order online/i.test(text)) add("Online Shop");
    if (/physical store|address|phone|showroom|location|contact/i.test(text)) add("Physical Store");
    if (/studio/i.test(text)) add("Studio");
    if (/service|rental|repair|support/i.test(text)) add("Services");
    if (/event|education|workshop|training|course|class/i.test(text)) add("Events & Education");
    if (/creator|photographer|videographer|filmmaker|youtube|tiktok|social/i.test(text)) add("Creator");

    return labels;
  }

  function englishBusinessMix(value, fallback = "the strongest visible business signals") {
    const labels = Array.isArray(value)
      ? value.flatMap((item) => canonicalBusinessLabels(item))
      : canonicalBusinessLabels(value);
    const clean = dedupeLines(labels).slice(0, 3);
    return clean.length ? clean.join(" / ") : fallback;
  }

  function cleanExportText(value) {
    let text = normalizeText(value);
    if (!text) return "";
    if (containsMojibake(text)) {
      const labels = canonicalBusinessLabels(text);
      const grade = text.match(/\b(A|B|C|D|NR)\b/i)?.[1]?.toUpperCase() || "";
      const score = text.match(/\b(?:100|[1-9]?\d)\b/)?.[0] || "";
      const prefix = grade ? `${grade}${score ? ` / ${score}` : ""}` : "";
      const cleanLabels = labels.length ? labels.slice(0, 3).join(" / ") : "";
      if (prefix || cleanLabels) return [prefix, cleanLabels].filter(Boolean).join(" · ");
      text = text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
    }
    text = text.replace(/\s*\|\s*/g, " | ");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function cleanSuggestionText(value, businessSource = "") {
    const text = normalizeText(value);
    if (!text) return "";
    if (/Use the strongest visible mix/i.test(text)) {
      return `Use the strongest visible mix: ${englishBusinessMix(`${businessSource} ${text}`)}.`;
    }
    if (containsMojibake(text)) {
      return text
        .replace(/Use the strongest visible mix:[^|.]+[.|]?/i, `Use the strongest visible mix: ${englishBusinessMix(`${businessSource} ${text}`)}.`)
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    return cleanExportText(text);
  }

  function cleanSuggestionsForExport(value, businessSource = "") {
    const parts = String(value || "")
      .split(/\s*\|\s*|\n+/)
      .map((part) => cleanSuggestionText(part, businessSource))
      .filter(Boolean);
    return dedupeLines(parts).join(" | ");
  }

  function cleanBusinessTypesForExport(value) {
    return englishBusinessMix(value, "");
  }

  function cleanSignalsForExport(value) {
    return String(value || "")
      .split(/\s*\|\s*|\n+/)
      .map((part) => {
        const labels = canonicalBusinessLabels(part);
        const cleanPart = containsMojibake(part)
          ? part.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
          : part;
        return cleanExportText(labels.length ? `${labels[0]}: ${cleanPart.split(":").pop() || ""}` : cleanPart);
      })
      .filter(Boolean)
      .join(" | ");
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
    if (analysis.businessTypes.length) items.push(`Use the strongest visible mix: ${englishBusinessMix(analysis.businessTypes)}.`);
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

  function getEmailType(analysis) {
    return normalizeEmailPurpose(analysis.emailPurpose, analysis.recordBucket);
  }

  function buildEmailProductLine(analysis) {
    if (getEmailType(analysis) === "firstTouch") return "";
    const products = dedupeLines([
      ...(analysis.globalPushProducts || []).map((product) => product.name),
      ...analysis.dealerProducts.map((product) => product.name),
      ...analysis.endUserProducts.map((product) => product.name)
    ]).slice(0, 3);
    if (!products.length) return "";
    const productObjects = [
      ...(analysis.globalPushProducts || []),
      ...analysis.dealerProducts,
      ...analysis.endUserProducts
    ];
    const statuses = productObjects
      .filter((product) => products.includes(product.name))
      .map((product) => normalizeProductStatus(product.productStatus));
    if (statuses.includes("new")) {
      return `Exciting news from Phottix: the most relevant items for your team to review first would be ${products.join(", ")}.`;
    }
    if (statuses.length && statuses.every((status) => status === "phaseOut")) {
      return `A quick last-chance note: ${products.join(", ")} may be worth reviewing while availability remains.`;
    }
    return `For your team, the most relevant Phottix items to review first would be ${products.join(", ")}.`;
  }

  function buildEmail(analysis, input) {
    const contact = input.contactName || "there";
    const company = input.companyName || humanizeDomain(input.website) || "your team";
    const leadSentence = buildLeadSentence(analysis);
    const fitLine = buildSoftFitLine(analysis);
    const productLine = buildEmailProductLine(analysis);
    const subject = buildEmailSubject(analysis, input);
    const purpose = getEmailType(analysis);
    const isFirstTouch = purpose === "firstTouch";
    const openerByPurpose = {
      firstTouch: `I came across ${company} and wanted to briefly introduce Phottix.`,
      productFollowUp: `I wanted to follow up with a slightly more specific Phottix product direction for ${company}.`,
      eventInvitation: `I wanted to reach out with a quick Phottix update that may be useful for your team around upcoming product demos or dealer discussions.`,
      existingCustomerUpdate: `I wanted to follow up with ${company} and share a quick Phottix update.`,
      reactivation: `It has been a while, so I wanted to reconnect and see whether a quick Phottix update would be useful.`,
      holidayGreeting: `I wanted to send a quick seasonal greeting from Phottix and share a light product update in case it is useful.`
    };
    const ctaByPurpose = {
      firstTouch: "No pressure at all, but would it be alright if I sent over a short product overview for the right person on your team?",
      productFollowUp: "Would it be useful if I sent over a short product overview with pricing for the most relevant items?",
      eventInvitation: "Would it be alright if I sent over a short product overview and possible demo focus for your team to review?",
      existingCustomerUpdate: "Would it be helpful if I sent over the latest product update, pricing, or a short replenishment suggestion?",
      reactivation: "Would it be alright if I sent a short update and you can let me know whether it is still relevant for your current plans?",
      holidayGreeting: "No pressure at all; would it be useful if I sent a short overview of a few items that may fit your current assortment?"
    };
    const routingByPurpose = {
      firstTouch: "If there is a better contact for new brand or product line discussions, I would also appreciate being pointed in the right direction.",
      productFollowUp: "If another colleague handles product selection or purchasing, I would be grateful if you could point me in the right direction.",
      eventInvitation: "If you have a colleague who handles events, trainings, or product demos, I would also be grateful if you could point me in the right direction.",
      existingCustomerUpdate: "If there are any categories you are currently refreshing or restocking, I can also tailor the suggestion around that.",
      reactivation: "If now is not the right timing, no problem at all; I can follow up later with a more relevant update.",
      holidayGreeting: "If there is a better timing after the holiday period, I can also follow up then with a shorter update."
    };
    const body = [
      `Hi ${contact},`,
      "",
      openerByPurpose[purpose],
      "",
      leadSentence,
      "",
      fitLine,
      "",
      ...(!isFirstTouch && productLine ? [productLine, ""] : []),
      ctaByPurpose[purpose],
      "",
      routingByPurpose[purpose],
      "",
      "Best regards,",
      "[Your Name]",
      "Phottix Business Development Team"
    ].join("\n");
    return { subject, body, preview: `Subject: ${subject}\n\n${body}` };
  }

  function emailTemplateVariables(analysis, input) {
    const recommendedProducts = dedupeLines([
      ...(analysis.globalPushProducts || []).map((product) => product.name),
      ...analysis.dealerProducts.map((product) => product.name),
      ...analysis.endUserProducts.map((product) => product.name)
    ]).slice(0, 5);
    return [
      ["{{公司名}}", input.companyName || humanizeDomain(input.website) || ""],
      ["{{联系人}}", input.contactName || ""],
      ["{{官网}}", input.website || ""],
      ["{{客户类型}}", customerTypeLabel(input.customerType || analysis.recordBucket)],
      ["{{官网发现的产品线}}", englishBusinessTypes(analysis, 3).join(", ")],
      ["{{推荐产品}}", recommendedProducts.join(", ")],
      ["{{评分}}", `${analysis.grade} / ${analysis.score}`],
      ["{{邮件目的}}", analysis.emailPurpose || "firstTouch"]
    ];
  }

  function renderVariableTemplate(template, variables) {
    let rendered = String(template || "");
    for (const [key, value] of variables) {
      rendered = rendered.split(key).join(value || "");
    }
    return rendered.trim();
  }

  function applyCustomEmailTemplate() {
    if (!state.currentAnalysis || !DOM.customEmailTemplate) return;
    const template = DOM.customEmailTemplate.value;
    if (!String(template || "").trim()) {
      setStatus("Custom template is empty. The generated email is unchanged.", "warn");
      return;
    }
    const input = getFormValues();
    const rendered = renderVariableTemplate(template, emailTemplateVariables(state.currentAnalysis, input));
    const lines = rendered.split(/\r?\n/);
    const subjectLine = lines[0] && /^subject\s*:/i.test(lines[0]) ? lines.shift().replace(/^subject\s*:/i, "").trim() : "";
    const subject = subjectLine || state.currentAnalysis.email.subject;
    const body = lines.join("\n").trim() || rendered;
    state.currentAnalysis.email = {
      subject,
      body,
      preview: `Subject: ${subject}\n\n${body}`
    };
    state.currentAnalysis.reportText = buildReportText(state.currentAnalysis, input);
    DOM.emailPreview.textContent = state.currentAnalysis.email.preview;
    setStatus("Custom email template applied. Save to Pool if you want this email stored in history.", "good");
  }

  function renderEmailTemplateVariables(analysis, input) {
    if (!DOM.emailTemplateVariables) return;
    DOM.emailTemplateVariables.innerHTML = `
      <section class="result-subgroup">
        <h4>邮件变量标签 / Email Variables</h4>
        <div class="template-variable-grid">
          ${emailTemplateVariables(analysis, input).map(([key, value]) => `
            <div class="template-variable"><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value || "—")}</span></div>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderEmailHistory(record) {
    if (!DOM.emailHistoryList) return;
    const history = Array.isArray(record?.emailHistory) ? record.emailHistory.slice(0, 5) : [];
    DOM.emailHistoryList.innerHTML = `
      <section class="result-subgroup">
        <h4>邮件历史 / Email History</h4>
        ${history.length ? history.map((item) => `
          <div class="email-history-item">
            <strong>${escapeHtml(formatDateTimeDisplay(item.sentAt || item.createdAt) || "—")} · ${escapeHtml(item.purpose || "")}</strong>
            <span>${escapeHtml(item.subject || "")}</span>
          </div>
        `).join("") : `<div class="bullet-item">No saved email history for this customer yet.</div>`}
      </section>
    `;
  }

  function buildReportText(analysis, input) {
    const lines = [];
    lines.push(`Company: ${input.companyName || "—"}`);
    lines.push(`Contact: ${input.contactName || "—"}`);
    lines.push(`Contact email: ${input.contactEmail || "—"}`);
    lines.push(`Website: ${input.website || "—"}`);
    lines.push(`City: ${input.city || "—"}`);
    lines.push(`Instagram: ${input.instagramUrl || analysis.socialTargets.instagram || "—"}`);
    lines.push(`Facebook: ${input.facebookUrl || analysis.socialTargets.facebook || "—"}`);
    lines.push(`Email purpose: ${analysis.emailPurpose || "firstTouch"}`);
    if (input.manualWebsiteSummary) lines.push(`Manual website summary: ${input.manualWebsiteSummary}`);
    lines.push(`Analysis version: ${analysis.analysisVersion || "—"}`);
    lines.push(`Last analyzed at: ${formatDateTimeDisplay(analysis.lastAnalyzedAt || analysis.analyzedAt) || "—"}`);
    lines.push(`Rating: ${analysis.grade} / ${analysis.score}`);
    if (analysis.manualRating || analysis.manualScore !== "") {
      lines.push(`AI rating: ${analysis.aiGrade || "—"} / ${analysis.aiScore || 0}`);
      lines.push(`Manual override: ${analysis.manualRating || "—"} / ${analysis.manualScore === "" ? "—" : analysis.manualScore}`);
      lines.push(`Manual reason: ${analysis.manualOverrideReason || "—"}`);
    }
    if (analysis.fourScores) {
      lines.push(`Customer Priority: ${analysis.fourScores.customerPriorityScore}`);
      lines.push(`Product Fit: ${analysis.fourScores.productFitScore}`);
      lines.push(`Data Confidence: ${analysis.fourScores.dataConfidenceScore}`);
      lines.push(`Outreach Readiness: ${analysis.fourScores.outreachReadinessScore}`);
    }
    lines.push(`Key decision: ${analysis.keyDecision}`);
    lines.push(`Focus: ${analysis.focus}`);
    if (analysis.scoreDetails?.reportLines?.length) {
      lines.push("");
      lines.push("Scoring explanation:");
      for (const line of analysis.scoreDetails.reportLines) lines.push(`- ${line}`);
    }
    lines.push("");
    lines.push("Matched signals:");
    for (const signal of analysis.topSignals.slice(0, 6)) lines.push(`- ${signal.categoryLabel} / ${signal.label} +${signal.points}: ${signal.evidence}`);
    lines.push("");
    lines.push("Business scope:");
    for (const scope of analysis.scopeLines.slice(0, 6)) lines.push(`- ${scope.source}: ${scope.text}`);
    lines.push("");
    lines.push("Priority pool products:");
    for (const product of (analysis.globalPushProducts || []).slice(0, 4)) lines.push(`- ${productExportLabel(product)} (${product.category})`);
    lines.push("");
    lines.push("Dealer line:");
    for (const product of analysis.dealerProducts.slice(0, 4)) lines.push(`- ${productExportLabel(product)} (${product.category}) — ${product.reason}`);
    lines.push("");
    lines.push("End-user line:");
    for (const product of analysis.endUserProducts.slice(0, 4)) lines.push(`- ${productExportLabel(product)} (${product.category}) — ${product.reason}`);
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
    const activeRecord = state.activeRecord.id ? findRecord(bucket, state.activeRecord.id) : null;
    const followUp = followUpStatusMeta(activeRecord?.followUpStatus);
    const contactName = input.contactName || activeRecord?.contactName || "";
    const contactEmail = input.contactEmail || activeRecord?.contactEmail || "";
    return {
      company_name: input.companyName || "",
      customer_type: customerTypeLabel(input.customerType || activeRecord?.customerType || bucket),
      contact_name: contactName,
      contact_email: contactEmail,
      email_ready: contactEmail ? "Ready" : "Missing Contact Email",
      website: input.website || "",
      instagram_url: input.instagramUrl || analysis.socialTargets.instagram || "",
      facebook_url: input.facebookUrl || analysis.socialTargets.facebook || "",
      city: input.city || "",
      email_purpose: analysis.emailPurpose || "",
      manual_website_summary: input.manualWebsiteSummary || "",
      analysis_version: analysis.analysisVersion || "",
      last_analyzed_at: analysis.lastAnalyzedAt || analysis.analyzedAt || "",
      ai_rating: analysis.aiGrade || analysis.grade,
      ai_score: analysis.aiScore || analysis.score,
      manual_rating: analysis.manualRating || "",
      manual_score: analysis.manualScore === "" || analysis.manualScore === undefined ? "" : analysis.manualScore,
      manual_override_reason: analysis.manualOverrideReason || "",
      manual_override_at: analysis.manualOverrideAt || "",
      follow_up_status: englishFollowUpLabel(activeRecord?.followUpStatus),
      next_follow_up_date: formatDateInputValue(activeRecord?.nextFollowUpDate),
      last_contacted_at: activeRecord?.lastContactedAt || "",
      suggested_action: suggestedActionForRecord({
        ...analysis,
        rating: analysis.grade,
        contactEmail,
        dataConfidenceScore: analysis.fourScores?.dataConfidenceScore || 0,
        outreachReadinessScore: analysis.fourScores?.outreachReadinessScore || 0
      }),
      business_types: cleanBusinessTypesForExport(analysis.businessTypes.join(" | ")),
      rating: analysis.grade,
      score: analysis.score,
      customer_priority_score: analysis.fourScores?.customerPriorityScore || 0,
      product_fit_score: analysis.fourScores?.productFitScore || 0,
      data_confidence_score: analysis.fourScores?.dataConfidenceScore || 0,
      outreach_readiness_score: analysis.fourScores?.outreachReadinessScore || 0,
      score_explanation: analysis.scoreDetails?.reportLines?.join(" | ") || "",
      rating_focus: cleanExportText(analysis.focus),
      key_decision: cleanExportText(analysis.keyDecision),
      matched_signals: cleanSignalsForExport(analysis.topSignals.map((signal) => `${signal.categoryLabel}: ${signal.label} +${signal.points}`).join(" | ")),
      global_push_line: (analysis.globalPushProducts || []).map(productExportLabel).join(" | "),
      force_email_line: "",
      dealer_line: analysis.dealerProducts.map((product) => `${productExportLabel(product)} (${product.reason})`).join(" | "),
      end_user_line: analysis.endUserProducts.map((product) => `${productExportLabel(product)} (${product.reason})`).join(" | "),
      email_subject: analysis.email.subject,
      email_body: analysis.email.body,
      email_preview: analysis.email.preview,
      last_email_subject: analysis.email.subject,
      last_email_at: new Date().toISOString(),
      email_history_count: activeRecord?.emailHistory?.length || 0,
      suggestions: analysis.suggestions.join(" | "),
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
      ["联系邮箱 / Contact Email", input.contactEmail ? `<a href="mailto:${escapeHtml(input.contactEmail)}">${escapeHtml(input.contactEmail)}</a>` : "—"],
      ["客户类型 / Customer Type", escapeHtml(customerTypeLabel(input.customerType || analysis.recordBucket))],
      ["分析版本 / Analysis Version", escapeHtml(analysis.analysisVersion || "—")],
      ["上次分析时间 / Last Analyzed", escapeHtml(formatDateTimeDisplay(analysis.lastAnalyzedAt || analysis.analyzedAt) || "—")],
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
    if (analysis.websiteAnalysis) {
      items.push(`<strong>Website analysis:</strong> ${escapeHtml(analysis.websiteAnalysis.source || "backend")} · ${escapeHtml(String(analysis.websiteAnalysis.rating || analysis.grade || ""))} / ${escapeHtml(String(analysis.websiteAnalysis.score || 0))} · confidence ${escapeHtml(String(analysis.websiteAnalysis.confidence || 0))}%`);
    }
    if (analysis.sourceStatus?.message) {
      const tone = analysis.sourceStatus.websiteBlocked ? "抓取状态 / Fetch Status" : "资料来源 / Source Status";
      items.push(`<strong>${tone}:</strong> ${escapeHtml(analysis.sourceStatus.message)}`);
    }
    if (analysis.fallbackNote) {
      items.push(`<strong>已知客户兜底 / Known Account:</strong> ${escapeHtml(analysis.fallbackNote)}`);
    }
    if (analysis.discoveredWebsite?.best?.url) {
      items.push(`<strong>自动官网候选 / Website Candidate:</strong> ${escapeHtml(analysis.discoveredWebsite.best.url)} · confidence ${escapeHtml(String(analysis.discoveredWebsite.best.confidence || 0))}% · source ${escapeHtml(analysis.discoveredWebsite.best.source || "search")}`);
    }
    if (input.website) {
      if (analysis.websiteMeta.title) items.push(renderEvidenceWithMeaning("Title", analysis.websiteMeta.title, 120));
      if (analysis.websiteMeta.description) items.push(renderEvidenceWithMeaning("Description", analysis.websiteMeta.description, 160));
    }
    for (const scope of scopeLines.slice(0, 5)) items.push(renderEvidenceWithMeaning(scope.source, scope.text, 160));
    if (!items.length) items.push("未抓到足够明确的业务摘录。若官网被 CAPTCHA / Cloudflare 拦截，当前低分只是资料不足，不代表客户价值低。");
    DOM.scopeList.innerHTML = items.map((item) => `<div class="bullet-item">${item}</div>`).join("");
  }

  function renderScoreExplanation(analysis) {
    const details = analysis?.scoreDetails;
    if (!details) return "";
    const components = details.components
      .map((item) => `<div class="bullet-item"><strong>${escapeHtml(item.label)}:</strong> +${escapeHtml(String(item.points))} / ${escapeHtml(String(item.cap))}<br><span class="crm-meta">${escapeHtml(item.detail)}</span></div>`)
      .join("");
    return `
      <section class="result-subgroup">
        <h4>Why this rating</h4>
        <div class="bullet-item"><strong>${escapeHtml(analysis.grade)} / ${escapeHtml(String(analysis.score))}</strong> ${escapeHtml(details.summary)}</div>
        <div class="bullet-item"><strong>Thresholds:</strong> ${escapeHtml(details.thresholds)}</div>
        ${components}
      </section>
    `;
  }

  function renderFourScores(analysis) {
    if (!analysis?.fourScores) return "";
    const notes = {
      customerPriorityScore: "How important this customer is for sales focus.",
      productFitScore: "How well selected products match this customer.",
      dataConfidenceScore: "How reliable the website/social evidence is.",
      outreachReadinessScore: "How ready this record is for a real email."
    };
    return `
      <section class="result-subgroup">
        <h4>Four Scores / 四分制</h4>
        <div class="score-card-grid">
          ${FOUR_SCORE_DEFS.map((item) => {
            const value = Number(analysis.fourScores[item.key] || 0) || 0;
            const tone = value >= 70 ? "good" : value >= 40 ? "warn" : "bad";
            return `<div class="score-mini-card ${tone}">
              <span>${escapeHtml(item.label)}</span>
              <strong>${value}</strong>
              <small>${escapeHtml(notes[item.key] || "")}</small>
            </div>`;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderScoringWeightList(analysis) {
    if (!DOM.scoringWeightList) return;
    const categoryMap = analysis.categoryMap || {};
    DOM.scoringWeightList.innerHTML = CATEGORY_DEFS.map((category) => {
      const scoredCategory = categoryMap[category.id] || { score: 0, signals: [] };
      const matchedLabels = new Set((scoredCategory.signals || []).map((signal) => signal.label));
      const ruleRows = category.rules.map((rule) => {
        const matched = matchedLabels.has(rule.label);
        return `
          <div class="weight-rule ${matched ? "matched" : ""}">
            <span class="weight-check">${matched ? "✓" : "○"}</span>
            <span>${escapeHtml(rule.label)}</span>
            <strong>+${escapeHtml(String(rule.points))}</strong>
          </div>
        `;
      }).join("");
      const percent = Math.max(0, Math.min(100, Math.round((Number(scoredCategory.score || 0) / Math.max(1, category.cap)) * 100)));
      return `
        <section class="weight-card">
          <div class="weight-card-head">
            <strong>${escapeHtml(category.label)}</strong>
            <span>${escapeHtml(String(scoredCategory.score || 0))} / ${escapeHtml(String(category.cap))}</span>
          </div>
          <div class="weight-bar"><span style="width:${percent}%"></span></div>
          <div class="weight-rules">${ruleRows}</div>
        </section>
      `;
    }).join("");
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

  function renderManualOverridePanel(analysis) {
    if (!DOM.manualOverridePanel) return;
    const manualGrade = normalizeManualGrade(analysis.manualRating);
    const manualScore = normalizeManualScore(analysis.manualScore);
    const hasOverride = Boolean(manualGrade || manualScore !== "" || analysis.manualOverrideReason);
    const aiLabel = `${analysis.aiGrade || analysis.grade || "—"} / ${analysis.aiScore || analysis.score || 0}`;
    DOM.manualOverridePanel.innerHTML = `
      <section class="result-subgroup manual-override-form">
        <h4>人工评分修正 / Manual Rating Override</h4>
        <p class="crm-meta">AI original: ${escapeHtml(aiLabel)}. If the AI rating is wrong, adjust it here and write the reason for future scoring improvement.</p>
        <div class="manual-override-grid">
          <label class="field">
            <span>人工等级 / Manual Grade</span>
            <select id="manualRatingInput">
              <option value="">Use AI</option>
              ${["A", "B", "C", "D", "NR"].map((grade) => `<option value="${grade}" ${manualGrade === grade ? "selected" : ""}>${grade}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>人工分数 / Manual Score</span>
            <input id="manualScoreInput" type="number" min="0" max="100" step="1" value="${manualScore === "" ? "" : escapeHtml(String(manualScore))}" placeholder="0-100">
          </label>
        </div>
        <label class="field field-wide">
          <span>人工修正原因 / Reason</span>
          <textarea id="manualReasonInput" rows="3" placeholder="Example: B&H is a major global retailer; AI under-scored due to blocked page.">${escapeHtml(analysis.manualOverrideReason || "")}</textarea>
        </label>
        <div class="crm-tools">
          <button class="mini-button secondary-button" type="button" data-action="apply-manual-override">Apply manual override</button>
          <button class="mini-button danger-text" type="button" data-action="clear-manual-override">Clear override</button>
        </div>
        ${hasOverride ? `<p class="crm-meta">Manual override saved in this analysis${analysis.manualOverrideAt ? ` · ${escapeHtml(formatDateTimeDisplay(analysis.manualOverrideAt))}` : ""}</p>` : ""}
      </section>
    `;
  }

  function applyManualOverride({ clear = false } = {}) {
    if (!state.currentAnalysis) return;
    if (clear) {
      state.currentAnalysis.manualRating = "";
      state.currentAnalysis.manualScore = "";
      state.currentAnalysis.manualOverrideReason = "";
      state.currentAnalysis.manualOverrideAt = "";
      state.currentAnalysis.grade = state.currentAnalysis.aiGrade || state.currentAnalysis.grade;
      state.currentAnalysis.score = state.currentAnalysis.aiScore || state.currentAnalysis.score;
      state.currentAnalysis.fourScores = {
        ...(state.currentAnalysis.fourScores || {}),
        customerPriorityScore: state.currentAnalysis.aiScore || state.currentAnalysis.score
      };
    } else {
      const manualRating = normalizeManualGrade(document.getElementById("manualRatingInput")?.value || "");
      const manualScore = normalizeManualScore(document.getElementById("manualScoreInput")?.value || "");
      const reason = normalizeText(document.getElementById("manualReasonInput")?.value || "");
      if (!manualRating && manualScore === "" && !reason) {
        setStatus("Please enter a manual grade, score, or reason before applying.", "warn");
        return;
      }
      state.currentAnalysis.aiGrade = state.currentAnalysis.aiGrade || state.currentAnalysis.grade;
      state.currentAnalysis.aiScore = state.currentAnalysis.aiScore || state.currentAnalysis.score;
      state.currentAnalysis.manualRating = manualRating;
      state.currentAnalysis.manualScore = manualScore;
      state.currentAnalysis.manualOverrideReason = reason;
      state.currentAnalysis.manualOverrideAt = new Date().toISOString();
      if (manualRating) state.currentAnalysis.grade = manualRating;
      if (manualScore !== "") {
        state.currentAnalysis.score = manualScore;
        state.currentAnalysis.fourScores = {
          ...(state.currentAnalysis.fourScores || {}),
          customerPriorityScore: manualScore
        };
      }
    }
    state.currentAnalysis.keyDecision = buildKeyDecision(state.currentAnalysis);
    state.currentAnalysis.reportText = buildReportText(state.currentAnalysis, getFormValues());
    renderAnalysis(state.currentAnalysis, getFormValues());
    setStatus(clear ? "Manual override cleared." : "Manual override applied. Remember to Save to Pool if you want it stored.", clear ? "warn" : "good");
  }

  function renderAnalysis(analysis, input) {
    renderCompanyInfo(analysis, input);
    const ratingTitle = analysis.grade === "NR" ? "未评级 / Not Rated" : `${analysis.grade} 级 / ${analysis.score} 分`;
    DOM.keyDecisionRating.innerHTML = `<strong>${escapeHtml(ratingTitle)}</strong>`;
    DOM.keyDecisionFocus.innerHTML = `<strong>${escapeHtml(analysis.keyDecision)}</strong><br><span class="crm-meta">${escapeHtml(analysis.focus)}</span>`;
    renderJudgingStandardList();
    renderScoringWeightList(analysis);
    renderScopeList(analysis.scopeLines, input, analysis);
    renderRatingList(analysis.categoryScores, analysis);
    const fourScores = renderFourScores(analysis);
    if (fourScores) DOM.ratingList.insertAdjacentHTML("afterbegin", fourScores);
    const scoreExplanation = renderScoreExplanation(analysis);
    if (scoreExplanation) DOM.ratingList.insertAdjacentHTML("beforeend", scoreExplanation);
    renderManualOverridePanel(analysis);
    renderSignals(analysis.topSignals, analysis);
    DOM.dealerProducts.innerHTML = buildProductCards(analysis.dealerProducts, analysis, "dealer");
    DOM.endUserProducts.innerHTML = buildProductCards(analysis.endUserProducts, analysis, "endUser");
    DOM.emailPreview.textContent = analysis.email.preview;
    renderEmailTemplateVariables(analysis, input);
    renderEmailHistory(state.activeRecord.id ? findRecord(state.activeRecord.bucket, state.activeRecord.id) : null);
    renderSuggestions(analysis.suggestions);
    DOM.copyReportBtn.disabled = false;
    DOM.copyEmailBtn.disabled = false;
    DOM.exportBtn.disabled = false;
    DOM.saveBtn.disabled = false;
    showAnalysisPanel(true);
    setStatus(`${analysis.grade} / ${analysis.score} ready`, ratingTone(analysis.grade));
  }

  function renderProductLibrary() {
    if (!DOM.productLibrary) return;
    const products = state.products.length ? state.products : normalizeCatalog(DEFAULT_PRODUCTS);
    const filteredProducts = filterProductsForLibrary(products);
    const grouped = groupProductsByCategory(filteredProducts);
    const productCount = products.length;
    const activeCount = products.filter(isProductSelected).length;
    const priorityCount = products.filter(isProductGlobalPush).length;
    const blockedCount = products.filter((item) => normalizeProductStatus(item.productStatus) === "doNotRecommend").length;
    const visibleCount = filteredProducts.length;
    const categoryCount = groupProductsByCategory(products).length;
    const sourceLabel = state.productSource === "excel" ? "Excel" : "Default";
    const summarizeProduct = (item) => {
      const text = normalizeText(item.description || item.tags || "");
      if (!text) return "";
      const firstSentence = text.split(/(?<=[.!?。！？])\s+/).find(Boolean) || text;
      return firstSentence.length > 150 ? `${firstSentence.slice(0, 150).trim()}...` : firstSentence;
    };
    DOM.productLibrary.innerHTML = `
      <div class="section-head">
        <div>
          <h2>产品资料库 / Product Database</h2>
          <p>Full Catalog 是完整产品查询库；Recommendation Pool 是主动推荐池。只有进入主动推荐池的产品，系统才会在客户分析和邮件里优先推荐。</p>
        </div>
        <div class="crm-tools">
          <button class="secondary-button" type="button" data-action="import-products">导入产品 Excel / Import Products</button>
          <button class="ghost-button" type="button" data-action="set-all-products" data-product-active="false">清空主动推荐池 / Clear Pool</button>
          <input id="productFileInput" type="file" accept=".xlsx,.xlsm,.csv" hidden>
        </div>
      </div>
      <div class="product-filter-bar">
        <label class="field product-search-field">
          <span>搜索产品 / Search Products</span>
          <input id="productSearchInput" type="search" placeholder="e.g. Kali, softbox, RGB, flash" value="${escapeHtml(state.productFilters.query)}">
        </label>
        <label class="product-toggle product-selected-filter">
          <input id="productSelectedOnlyInput" type="checkbox" ${state.productFilters.selectedOnly ? "checked" : ""}>
          <span>只看候选池 / Pool only</span>
        </label>
      </div>
      <div class="overview-cards">
        <div class="overview-card"><span class="overview-label">Full Catalog</span><strong class="overview-value">${productCount}</strong><span class="overview-note">Searchable product database · Source: ${escapeHtml(sourceLabel)}</span></div>
        <div class="overview-card"><span class="overview-label">Recommendation Pool</span><strong class="overview-value">${activeCount}</strong><span class="overview-note">Active products AI may recommend</span></div>
        <div class="overview-card"><span class="overview-label">Priority in Pool</span><strong class="overview-value">${priorityCount}</strong><span class="overview-note">Higher ranking inside the pool</span></div>
        <div class="overview-card"><span class="overview-label">Blocked / Visible</span><strong class="overview-value">${blockedCount} / ${visibleCount}</strong><span class="overview-note">Do Not Recommend is never used</span></div>
      </div>
      <div class="result-area">
        ${grouped.length ? grouped.map(([category, items]) => `
          <section class="result-block">
            <div class="block-head">
              <h3>${escapeHtml(category)} (${items.length})</h3>
              <div class="crm-tools product-category-tools">
                <span class="status-pill">${items.filter(isProductSelected).length} in pool</span>
                <button class="mini-button" type="button" data-action="set-category-products" data-category="${escapeHtml(category)}" data-product-active="true">Add category to pool</button>
                <button class="mini-button danger-text" type="button" data-action="set-category-products" data-category="${escapeHtml(category)}" data-product-active="false">Remove category from pool</button>
              </div>
            </div>
            <div class="product-grid">${items.map((item) => {
              const meta = [item.sku ? `SKU: ${item.sku}` : "", item.brand].filter(Boolean).join(" · ");
              const summary = summarizeProduct(item);
              const isActive = isProductSelected(item);
              const isGlobalPush = isProductGlobalPush(item);
              const status = normalizeProductStatus(item.productStatus);
              return `<article class="product-card compact-product-card ${isActive || isGlobalPush ? "" : "product-card-disabled"}">
                <label class="product-toggle">
                  <input type="checkbox" data-action="toggle-product-recommendation" data-product-id="${escapeHtml(item.id)}" ${isActive ? "checked" : ""}>
                  <span>${isActive ? "In Active Recommendation Pool" : "Full Catalog only"}</span>
                </label>
                <label class="product-toggle global-push-toggle">
                  <input type="checkbox" data-action="toggle-product-global-push" data-product-id="${escapeHtml(item.id)}" ${isGlobalPush ? "checked" : ""}>
                  <span>${isGlobalPush ? "Priority in Pool" : "Normal pool priority"}</span>
                </label>
                <label class="field product-status-field">
                  <span>Lifecycle / 产品生命周期</span>
                  <select data-action="set-product-status" data-product-id="${escapeHtml(item.id)}">
                    <option value="active" ${status === "active" ? "selected" : ""}>Active / 常规在售</option>
                    <option value="new" ${status === "new" ? "selected" : ""}>New / 新品</option>
                    <option value="phaseOut" ${status === "phaseOut" ? "selected" : ""}>Phase-Out / 退市过渡</option>
                    <option value="doNotRecommend" ${status === "doNotRecommend" ? "selected" : ""}>Do Not Recommend / 不推荐</option>
                  </select>
                </label>
                <strong>${escapeHtml(item.name)}</strong>
                <div class="crm-meta">${escapeHtml(productStatusLabel(status))}${meta ? ` · ${escapeHtml(meta)}` : ""}</div>
                ${summary ? `<span>${escapeHtml(summary)}</span>` : ""}
                <div class="product-actions">
                  <button class="${isActive ? "mini-button danger-text" : "mini-button secondary-button"}" type="button" data-action="set-product-recommendation" data-product-id="${escapeHtml(item.id)}" data-product-active="${isActive ? "false" : "true"}">
                    ${isActive ? "Remove from active pool" : "Add to active pool"}
                  </button>
                  <button class="${isGlobalPush ? "mini-button danger-text" : "mini-button secondary-button"}" type="button" data-action="set-product-global-push" data-product-id="${escapeHtml(item.id)}" data-product-push="${isGlobalPush ? "false" : "true"}">
                    ${isGlobalPush ? "Remove priority" : "Set pool priority"}
                  </button>
                </div>
              </article>`;
            }).join("")}</div>
          </section>
        `).join("") : `<section class="result-block"><div class="bullet-item">${products.length ? "No products match the current filter." : "No products loaded yet. Import a product Excel file first."}</div></section>`}
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

  function renderFollowUpOptions(selectedValue) {
    const selected = normalizeFollowUpStatus(selectedValue);
    return FOLLOW_UP_STATUSES.map((item) => (
      `<option value="${escapeHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.label)}</option>`
    )).join("");
  }

  function renderCrmList(list, container, bucket, emptyText) {
    if (!container) return;
    if (!list.length) {
      container.innerHTML = `<div class="result-block"><div class="bullet-item">${escapeHtml(emptyText)}</div></div>`;
      return;
    }
    container.innerHTML = list.map((record) => {
      const gradeClass = record.rating === "A" ? "good" : record.rating === "B" ? "warn" : record.rating === "C" ? "warn" : record.rating === "D" ? "bad" : "";
      const summary = record.analysisSummary || record.businessTypes || record.keyDecision || record.businessNotes || record.manualWebsiteSummary || record.sourceNotes || "No summary yet.";
      const followUp = followUpStatusMeta(record.followUpStatus);
      const typeLabel = customerTypeLabel(record.customerType || bucket);
      const recordBucket = record.bucket || (normalizeCustomerType(record.customerType) === "existing" ? "customers" : "prospects");
      const suggestedAction = record.suggestedAction || suggestedActionForRecord(record);
      const analysisMeta = [
        record.analysisVersion,
        record.lastAnalyzedAt ? `Last analyzed ${formatDateTimeDisplay(record.lastAnalyzedAt)}` : "",
        (record.manualRating || (record.manualScore !== "" && record.manualScore !== undefined)) ? "Manual override" : ""
      ].filter(Boolean).join(" · ");
      const scoreParts = FOUR_SCORE_DEFS
        .map((item) => {
          const value = Number(record[item.key] || 0) || 0;
          return value ? `${item.label.split(" / ")[0]} ${value}` : "";
        })
        .filter(Boolean)
        .join(" · ");
      const websiteDisplay = record.website ? `<a href="${escapeHtml(record.website)}" target="_blank" rel="noreferrer">${escapeHtml(displayUrl(record.website))}</a>` : "—";
      return `
        <article class="crm-item" data-record-id="${escapeHtml(record.id)}" data-record-bucket="${escapeHtml(recordBucket)}">
          <div class="crm-item-head">
            <div>
              <h3>${escapeHtml(record.companyName || "Untitled")}</h3>
              <p class="crm-summary">${websiteDisplay}</p>
            </div>
            <span class="status-pill crm-grade ${gradeClass}">${record.rating ? `${escapeHtml(record.rating)} / ${record.score || 0}` : "Not analyzed"}</span>
          </div>
          <div class="crm-follow-row">
            <label class="crm-follow-field">
              <span>Follow-up Status / 客户跟进状态</span>
              <select data-action="set-follow-up-status" data-record-id="${escapeHtml(record.id)}" data-record-bucket="${escapeHtml(recordBucket)}">
                ${renderFollowUpOptions(followUp.id)}
              </select>
            </label>
            <label class="crm-follow-field">
              <span>Next Follow-up / 下次跟进</span>
              <input type="date" value="${escapeHtml(formatDateInputValue(record.nextFollowUpDate))}" data-action="set-next-follow-up" data-record-id="${escapeHtml(record.id)}" data-record-bucket="${escapeHtml(recordBucket)}">
            </label>
          </div>
          <p class="crm-meta"><span class="status-pill">${escapeHtml(typeLabel)}</span> <span class="status-pill ${escapeHtml(followUp.tone)}">${escapeHtml(followUp.label)}</span></p>
          <p class="crm-summary">${escapeHtml(summary)}</p>
          <p class="crm-meta"><strong>Suggested Action:</strong> ${escapeHtml(suggestedAction)}</p>
          ${analysisMeta ? `<p class="crm-meta">${escapeHtml(analysisMeta)}</p>` : ""}
          ${scoreParts ? `<p class="crm-meta">${escapeHtml(scoreParts)}</p>` : ""}
          <p class="crm-meta">${escapeHtml([record.city, record.contactName, record.contactEmail, formatSavedAt(record.savedAt)].filter(Boolean).join(" · "))}</p>
          <div class="crm-actions">
            <button class="mini-button" type="button" data-action="load-record" data-record-id="${escapeHtml(record.id)}" data-record-bucket="${escapeHtml(recordBucket)}">Analyze</button>
            <button class="mini-button danger-text" type="button" data-action="delete-record" data-record-id="${escapeHtml(record.id)}" data-record-bucket="${escapeHtml(recordBucket)}">Delete</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderCrmModules() {
    const prospects = state.prospects.length;
    const existing = state.customers.length;
    renderCrmList(state.customerPool, DOM.customerList, "customers", "No customers yet. Import prospects or existing customers into the unified customer pool.");
    if (DOM.customerImportStatus) DOM.customerImportStatus.textContent = `${state.pendingStatuses.customers} Current pool: ${prospects} Prospect / ${existing} Existing.`;
    if (DOM.customerBulkAnalyzeBtn) DOM.customerBulkAnalyzeBtn.disabled = state.bulkRunning || !state.customerPool.length;
    if (DOM.customerExportBtn) DOM.customerExportBtn.disabled = state.bulkRunning || !state.customerPool.length;
  }

  function saveCurrentLists() {
    saveStoredList(STORAGE_KEYS.customerPool, state.customerPool);
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
    const previousRecord = existingRecordId ? findRecord(bucket, existingRecordId) : null;
    const customerType = normalizeCustomerType(input.customerType || previousRecord?.customerType || previousRecord?.bucket || bucket);
    const recordBucket = customerType === "existing" ? "customers" : "prospects";
    return {
      id: existingRecordId || makeId(customerType === "existing" ? "cust" : "pros"),
      bucket: recordBucket,
      customerType,
      companyName: input.companyName || humanizeDomain(input.website) || "",
      contactName: input.contactName || previousRecord?.contactName || "",
      emailPurpose: analysis.emailPurpose || input.emailPurpose || inferEmailPurposeFromBucket(customerType),
      contactEmail: input.contactEmail || previousRecord?.contactEmail || "",
      website: input.website || previousRecord?.website || "",
      city: input.city || previousRecord?.city || "",
      instagramUrl: input.instagramUrl || analysis.socialTargets.instagram || "",
      facebookUrl: input.facebookUrl || analysis.socialTargets.facebook || "",
      businessNotes: input.businessNotes || "",
      manualWebsiteSummary: input.manualWebsiteSummary || "",
      sourceNotes: input.sourceNotes || "",
      followUpStatus: normalizeFollowUpStatus(previousRecord?.followUpStatus),
      nextFollowUpDate: formatDateInputValue(previousRecord?.nextFollowUpDate),
      lastContactedAt: previousRecord?.lastContactedAt || "",
      lastAnalyzedAt: analysis.lastAnalyzedAt || analysis.analyzedAt || new Date().toISOString(),
      analysisVersion: analysis.analysisVersion || analysisVersionLabel(nextAnalysisVersion(previousRecord)),
      analysisVersionNumber: analysis.analysisVersionNumber || nextAnalysisVersion(previousRecord),
      aiRating: analysis.aiGrade || analysis.grade,
      aiScore: analysis.aiScore || analysis.score,
      manualRating: analysis.manualRating || "",
      manualScore: analysis.manualScore === "" || analysis.manualScore === undefined ? "" : analysis.manualScore,
      manualOverrideReason: analysis.manualOverrideReason || "",
      manualOverrideAt: analysis.manualOverrideAt || "",
      rating: analysis.grade,
      score: analysis.score,
      customerPriorityScore: analysis.fourScores?.customerPriorityScore || 0,
      productFitScore: analysis.fourScores?.productFitScore || 0,
      dataConfidenceScore: analysis.fourScores?.dataConfidenceScore || 0,
      outreachReadinessScore: analysis.fourScores?.outreachReadinessScore || 0,
      keyDecision: analysis.keyDecision,
      businessTypes: analysis.businessTypes.join(" / "),
      suggestedAction: suggestedActionForRecord({
        ...analysis,
        rating: analysis.grade,
        contactEmail: input.contactEmail || previousRecord?.contactEmail || "",
        dataConfidenceScore: analysis.fourScores?.dataConfidenceScore || 0,
        outreachReadinessScore: analysis.fourScores?.outreachReadinessScore || 0
      }),
      analysisSummary: analysis.grade === "NR"
        ? "未评级 / Not Rated · 官网抓取受阻"
        : `${analysis.grade} / ${analysis.score} · ${analysis.businessTypes.slice(0, 3).join(" / ") || "No clear type"}`,
      emailSubject: analysis.email.subject,
      emailBody: analysis.email.body,
      emailPreview: analysis.email.preview,
      emailHistory: appendEmailHistory(previousRecord?.emailHistory || [], analysis),
      matchedSignals: analysis.topSignals.map((signal) => `${signal.categoryLabel}: ${signal.label} +${signal.points}`).join(" | "),
      scoreExplanation: analysis.scoreDetails?.reportLines?.join(" | ") || "",
      dealerLine: analysis.dealerProducts.map((product) => product.name).join(" | "),
      endUserLine: analysis.endUserProducts.map((product) => product.name).join(" | "),
      globalPushLine: (analysis.globalPushProducts || []).map(productExportLabel).join(" | "),
      forceEmailLine: "",
      suggestions: cleanSuggestionsForExport(analysis.suggestions.join(" | "), analysis.businessTypes.join(" | ")),
      savedAt: new Date().toISOString()
    };
  }

  function upsertRecord(bucket, record) {
    const prepared = prepareCustomerRecord(record, record.customerType || bucket);
    const list = [...state.customerPool];
    const index = list.findIndex((item) => item.id === prepared.id);
    if (index >= 0) list[index] = mergeCustomerRecords(list[index], prepared);
    else list.unshift(prepared);
    state.customerPool = mergeCustomerList(list).records;
    saveCurrentLists();
    renderCrmModules();
  }

  function deleteRecord(bucket, id) {
    state.customerPool = state.customerPool.filter((item) => item.id !== id);
    saveCurrentLists();
    renderCrmModules();
  }

  function updateRecordFields(bucket, id, fields) {
    const list = [...state.customerPool];
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return;
    list[index] = { ...list[index], ...fields };
    state.customerPool = list;
    saveCurrentLists();
    renderCrmModules();
  }

  function setProductRecommendation(productId, isActive) {
    state.products = state.products.map((product) => (
      product.id === productId ? { ...product, useForRecommendation: normalizeProductStatus(product.productStatus) === "doNotRecommend" ? false : isActive } : product
    ));
    saveCurrentLists();
    renderProductLibrary();
    setStatus(isActive ? "Product added to the active Recommendation Pool." : "Product moved back to Full Catalog only.", isActive ? "good" : "warn");
  }

  function setProductGlobalPush(productId, isGlobalPush) {
    state.products = state.products.map((product) => (
      product.id === productId ? { ...product, globalPush: normalizeProductStatus(product.productStatus) === "doNotRecommend" ? false : isGlobalPush, forceIncludeInEmail: false } : product
    ));
    saveCurrentLists();
    renderProductLibrary();
    setStatus(isGlobalPush ? "Product set as Priority in Pool." : "Product returned to normal pool priority.", isGlobalPush ? "good" : "warn");
  }

  function setProductStatus(productId, status) {
    const normalizedStatus = normalizeProductStatus(status);
    state.products = state.products.map((product) => {
      if (product.id !== productId) return product;
      const updates = { ...product, productStatus: normalizedStatus };
      if (normalizedStatus === "doNotRecommend") {
        updates.useForRecommendation = false;
        updates.globalPush = false;
        updates.forceIncludeInEmail = false;
      }
      return updates;
    });
    saveCurrentLists();
    renderProductLibrary();
    setStatus(`Product status set to ${productStatusLabel(normalizedStatus)}.`, normalizedStatus === "doNotRecommend" ? "warn" : "good");
  }

  function setProductsRecommendationByCategory(category, isActive) {
    state.products = state.products.map((product) => {
      const normalizedCategory = normalizeProductCategory(product.category, product.name, product.tags);
      return normalizedCategory === category
        ? { ...product, useForRecommendation: normalizeProductStatus(product.productStatus) === "doNotRecommend" ? false : isActive }
        : product;
    });
    saveCurrentLists();
    renderProductLibrary();
    setStatus(`${isActive ? "Added" : "Removed"} ${category} ${isActive ? "to" : "from"} the active Recommendation Pool.`, isActive ? "good" : "warn");
  }

  function setAllProductsRecommendation(isActive) {
    state.products = state.products.map((product) => ({
      ...product,
      useForRecommendation: normalizeProductStatus(product.productStatus) === "doNotRecommend" ? false : isActive
    }));
    saveCurrentLists();
    renderProductLibrary();
    setStatus(isActive ? "All products added to the active Recommendation Pool." : "Active Recommendation Pool cleared.", isActive ? "good" : "warn");
  }

  function updateProductFilters({ query, selectedOnly } = {}) {
    if (query !== undefined) state.productFilters.query = query;
    if (selectedOnly !== undefined) state.productFilters.selectedOnly = selectedOnly;
    renderProductLibrary();
  }

  function findRecord(bucket, id) {
    if (!id) return null;
    return state.customerPool.find((item) => item.id === id) || null;
  }

  function loadRecordToForm(record) {
    setFormValues(record);
    state.activeRecord = {
      bucket: record.bucket === "customers" ? "customers" : "prospects",
      id: record.id || null,
      customerType: normalizeCustomerType(record.customerType || record.bucket)
    };
    setSaveButtonLabel();
  }

  function buildAnalysisInputFromRecord(record) {
    return {
      companyName: record.companyName || humanizeDomain(record.website) || "",
      contactName: record.contactName || "",
      contactEmail: record.contactEmail || "",
      customerType: normalizeCustomerType(record.customerType || record.bucket),
      emailPurpose: normalizeEmailPurpose(record.emailPurpose, record.customerType || record.bucket),
      website: record.website || "",
      city: record.city || "",
      instagramUrl: record.instagramUrl || "",
      facebookUrl: record.facebookUrl || "",
      businessNotes: record.businessNotes || "",
      manualWebsiteSummary: record.manualWebsiteSummary || "",
      sourceNotes: record.sourceNotes || ""
    };
  }

  function setBulkActionRunning(isRunning) {
    state.bulkRunning = isRunning;
    [DOM.customerBulkAnalyzeBtn, DOM.prospectImportBtn, DOM.customerImportBtn, DOM.customerExportBtn]
      .filter(Boolean)
      .forEach((button) => { button.disabled = isRunning; });
    if (!isRunning) renderCrmModules();
  }

  async function analyzeCurrentForm(options = {}) {
    const input = getFormValues();
    const activeType = normalizeCustomerType(input.customerType || state.activeRecord.customerType || state.activeRecord.bucket);
    state.activeRecord.customerType = activeType;
    state.activeRecord.bucket = activeType === "existing" ? "customers" : "prospects";
    const previousRecord = state.activeRecord.id ? findRecord(state.activeRecord.bucket, state.activeRecord.id) : null;
    if (!options.skipRefreshPrompt && previousRecord?.lastAnalyzedAt) {
      const elapsedDays = daysSince(previousRecord.lastAnalyzedAt);
      const dayText = elapsedDays === null ? "some" : String(elapsedDays);
      const shouldRefresh = confirm(`距离上次分析已 ${dayText} 天，官网或社媒可能已经更新。是否重新抓取并生成新版分析？`);
      if (!shouldRefresh) {
        setStatus("Re-analysis cancelled. Existing analysis kept.", "warn");
        state.analysisCancelled = true;
        return;
      }
    }
    let discoveredWebsite = null;
    let websiteForDisplay = input.website || "";
    const companyFallback = input.companyName || humanizeDomain(input.website) || "";
    if (!input.companyName && !input.website && !input.businessNotes && !input.manualWebsiteSummary && !input.sourceNotes) {
      setStatus("Please enter a company name, website, or some evidence text first.", "warn");
      return;
    }

    if (!websiteForDisplay && input.companyName) {
      setStatus("Finding official website candidate...", "warn");
      discoveredWebsite = await findWebsite(input.companyName, input.city);
      const candidateUrl = normalizeUrl(discoveredWebsite?.best?.url || "");
      if (candidateUrl) {
        websiteForDisplay = candidateUrl;
        DOM.website.value = candidateUrl;
      }
    }

    setStatus("Fetching website and social evidence...", "warn");
    DOM.copyReportBtn.disabled = true;
    DOM.copyEmailBtn.disabled = true;
    DOM.exportBtn.disabled = true;
    DOM.saveBtn.disabled = true;

    const effectiveInput = { ...input, website: websiteForDisplay, companyName: companyFallback };
    const collected = await collectSources(effectiveInput);
    const discoveredEmail = preferredContactEmail(
      effectiveInput.contactEmail,
      ...collected.sources.map((source) => [
        source.raw?.emails?.join(" "),
        source.title,
        source.description,
        source.body
      ].filter(Boolean).join(" ")),
      effectiveInput.businessNotes,
      effectiveInput.sourceNotes
    );
    if (!effectiveInput.contactEmail && discoveredEmail) {
      effectiveInput.contactEmail = discoveredEmail;
      if (DOM.contactEmail) DOM.contactEmail.value = discoveredEmail;
    }
    setStatus("Analyzing signals...", "warn");

    const evidenceBlocks = evidenceBlocksFromInput(effectiveInput, collected.sources);
    const categoryScores = CATEGORY_DEFS.map((def) => scoreCategory(def, evidenceBlocks));
    const categoryMap = {};
    for (const item of categoryScores) categoryMap[item.id] = item;
    const sourceStatus = buildSourceStatus(collected.sources);
    const websiteAnalysis = collected.sources.find((source) => source.platform === "website")?.raw || null;
    const knownFallback = !input.businessNotes && !input.manualWebsiteSummary && !input.sourceNotes
      ? findKnownAccountFallback(input)
      : null;
    const localScoreDetails = calculateSalesScoreDetails(categoryMap);
    const localScore = localScoreDetails.score;
    const websiteScore = Number(websiteAnalysis?.score || 0) || 0;
    const score = Math.max(localScore, websiteScore);
    const notRateable = sourceStatus.websiteBlocked && score === 0 && !input.businessNotes && !input.manualWebsiteSummary && !input.sourceNotes;
    const ratingBand = notRateable
      ? NOT_RATED_BAND
      : websiteAnalysis?.rating && websiteScore >= localScore
        ? { ...getRatingBand(score), grade: websiteAnalysis.rating, fallbackNote: websiteAnalysis.source === "known-fetch-fallback" ? "Known account fallback used for blocked or hard-to-fetch website." : "" }
        : knownFallback
          ? { ...getRatingBand(score), grade: knownFallback.grade, fallbackNote: knownFallback.note }
          : getRatingBand(score);
    const businessTypes = websiteAnalysis?.businessTypes?.length
      ? websiteAnalysis.businessTypes
      : knownFallback
        ? knownFallback.businessTypes
        : buildBusinessTypes(categoryScores);
    const scopeLines = extractRelevantScope(evidenceBlocks);
    const topSignals = buildMatchedSignals(categoryScores);
    const scoreDetails = buildScoreDetails({ localScoreDetails, websiteAnalysis, websiteScore, localScore, finalScore: score, ratingBand, sourceStatus });
    const focus = buildDecisionFocus(categoryScores, ratingBand);
    const analysisVersionNumber = nextAnalysisVersion(previousRecord);
    const analyzedAt = new Date().toISOString();
    const baseCatalog = state.products.length ? state.products : normalizeCatalog(DEFAULT_PRODUCTS);
    const recommendationCatalog = getRecommendationCatalog(baseCatalog);
    const emailPurpose = normalizeEmailPurpose(input.emailPurpose, state.activeRecord.customerType || state.activeRecord.bucket);
    const globalPushProducts = getGlobalPushProducts(recommendationCatalog);
    const dealerProducts = pickProducts(recommendationCatalog, ["Lighting", "Modifiers", "Flash & Trigger", "Support & Accessories", "Power & Video"], ["lighting", "led", "rgb", "softbox", "modifier", "flash", "trigger", "stand", "clamp", "battery", "power", "video"], "dealer").map((product) => ({ ...product, reason: buildProductReason(product, { categoryMap }, "dealer") }));
    const endUserProducts = pickProducts(recommendationCatalog, ["Lighting", "Modifiers", "Flash & Trigger", "Power & Video", "Support & Accessories"], ["creator", "studio", "video", "rgb", "light", "softbox", "mobile", "stream", "content", "photo"], "endUser").map((product) => ({ ...product, reason: buildProductReason(product, { categoryMap }, "endUser") }));
    const analysis = {
      input,
      discoveredWebsite,
      websiteMeta: collected.sources.find((source) => source.platform === "website") || { title: "", description: "" },
      socialTargets: collected.socialTargets,
      websiteAnalysis,
      categoryScores,
      categoryMap,
      score,
      grade: ratingBand.grade,
      aiScore: score,
      aiGrade: ratingBand.grade,
      ratingLabel: ratingBand.label,
      analyzedAt,
      lastAnalyzedAt: analyzedAt,
      previousAnalyzedAt: previousRecord?.lastAnalyzedAt || "",
      analysisVersionNumber,
      analysisVersion: analysisVersionLabel(analysisVersionNumber),
      manualRating: "",
      manualScore: "",
      manualOverrideReason: "",
      manualOverrideAt: "",
      scoreDetails,
      businessTypes,
      focus,
      sourceStatus,
      fallbackNote: ratingBand.fallbackNote || (knownFallback ? knownFallback.note : ""),
      scopeLines,
      topSignals,
      baseCatalog,
      recordBucket: normalizeCustomerType(state.activeRecord.customerType || state.activeRecord.bucket) === "existing" ? "customers" : "prospects",
      emailPurpose,
      globalPushProducts,
      dealerProducts,
      endUserProducts,
      suggestions: buildSuggestionList({ categoryMap, businessTypes }),
      keyDecision: "",
      sourceBlocks: evidenceBlocks
    };

    analysis.fourScores = calculateFourScores({
      analysisBase: analysis,
      input: effectiveInput,
      sourceStatus,
      localScoreDetails,
      websiteAnalysis,
      dealerProducts,
      endUserProducts,
      globalPushProducts
    });
    analysis.keyDecision = buildKeyDecision(analysis);
    analysis.email = buildEmail(analysis, effectiveInput);
    analysis.reportText = buildReportText(analysis, {
      companyName: input.companyName || companyFallback,
      contactName: input.contactName,
      emailPurpose,
      website: websiteForDisplay,
      city: input.city,
      instagramUrl: input.instagramUrl || collected.socialTargets.instagram,
      facebookUrl: input.facebookUrl || collected.socialTargets.facebook,
      businessNotes: input.businessNotes,
      manualWebsiteSummary: input.manualWebsiteSummary,
      sourceNotes: input.sourceNotes
    });

    state.currentAnalysis = analysis;
    renderAnalysis(analysis, effectiveInput);
    switchModule("analysis");
    setSaveButtonLabel();
  }

  async function handleGenerate(event) {
    if (event) event.preventDefault();
    const originalLabel = DOM.generateBtn ? DOM.generateBtn.textContent : "";
    state.analysisCancelled = false;
    try {
      if (DOM.generateBtn) {
        DOM.generateBtn.disabled = true;
        DOM.generateBtn.textContent = "分析中 / Analyzing...";
      }
      await analyzeCurrentForm();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to analyze the customer.", "bad");
    } finally {
      if (DOM.generateBtn) {
        DOM.generateBtn.disabled = false;
        DOM.generateBtn.textContent = originalLabel || "生成分析 / Generate";
      }
    }
  }

  async function handleSave() {
    if (!state.currentAnalysis) {
      setStatus("Please generate an analysis first.", "warn");
      return;
    }
    const input = getFormValues();
    const bucket = normalizeCustomerType(input.customerType || state.activeRecord.customerType || state.activeRecord.bucket) === "existing" ? "customers" : "prospects";
    const record = syncRecordFromAnalysis(bucket, state.activeRecord.id, state.currentAnalysis, input);
    upsertRecord(bucket, record);
    state.activeRecord = { bucket, id: record.id, customerType: record.customerType };
    setSaveButtonLabel();
    renderEmailHistory(findRecord(bucket, record.id));
    setStatus(`Saved to Customer Pool as ${customerTypeLabel(record.customerType)}.`, "good");
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
    const bucket = normalizeCustomerType(input.customerType || state.activeRecord.customerType || state.activeRecord.bucket) === "existing" ? "customers" : "prospects";
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

  function buildExportRowFromRecord(record, bucket) {
    const followUp = followUpStatusMeta(record.followUpStatus);
    const contactName = record.contactName || record["主要联系人名称"] || record.primaryContact || "";
    const contactEmail = record.contactEmail || record["主要联系人邮箱"] || record.primaryEmail || "";
    return {
      company_name: record.companyName || "",
      customer_type: customerTypeLabel(record.customerType || bucket),
      contact_name: contactName,
      contact_email: contactEmail,
      email_ready: contactEmail ? "Ready" : "Missing Contact Email",
      website: record.website || "",
      instagram_url: record.instagramUrl || "",
      facebook_url: record.facebookUrl || "",
      city: record.city || "",
      email_purpose: record.emailPurpose || inferEmailPurposeFromBucket(record.customerType || bucket),
      manual_website_summary: record.manualWebsiteSummary || "",
      analysis_version: record.analysisVersion || "",
      last_analyzed_at: record.lastAnalyzedAt || "",
      ai_rating: record.aiRating || record.rating || "",
      ai_score: record.aiScore || record.score || "",
      manual_rating: record.manualRating || "",
      manual_score: record.manualScore === "" || record.manualScore === undefined ? "" : record.manualScore,
      manual_override_reason: record.manualOverrideReason || "",
      manual_override_at: record.manualOverrideAt || "",
      follow_up_status: englishFollowUpLabel(record.followUpStatus),
      next_follow_up_date: formatDateInputValue(record.nextFollowUpDate),
      last_contacted_at: record.lastContactedAt || "",
      suggested_action: record.suggestedAction || suggestedActionForRecord(record),
      business_types: cleanBusinessTypesForExport(record.businessTypes || ""),
      rating: record.rating || "",
      score: record.score || "",
      customer_priority_score: record.customerPriorityScore || "",
      product_fit_score: record.productFitScore || "",
      data_confidence_score: record.dataConfidenceScore || "",
      outreach_readiness_score: record.outreachReadinessScore || "",
      score_explanation: record.scoreExplanation || "",
      rating_focus: cleanExportText(record.keyDecision || record.analysisSummary || ""),
      key_decision: cleanExportText(record.keyDecision || ""),
      matched_signals: cleanSignalsForExport(record.matchedSignals || ""),
      global_push_line: record.globalPushLine || "",
      force_email_line: record.forceEmailLine || "",
      dealer_line: record.dealerLine || "",
      end_user_line: record.endUserLine || "",
      email_subject: record.emailSubject || "",
      email_body: record.emailBody || "",
      email_preview: record.emailPreview || "",
      last_email_subject: record.emailHistory?.[0]?.subject || record.emailSubject || "",
      last_email_at: record.emailHistory?.[0]?.createdAt || "",
      email_history_count: Array.isArray(record.emailHistory) ? record.emailHistory.length : 0,
      suggestions: cleanSuggestionsForExport(record.suggestions || "", record.businessTypes || record.keyDecision || record.analysisSummary || ""),
      saved_at: record.savedAt || ""
    };
  }

  async function exportRecordBucket(bucket) {
    const list = state.customerPool;
    if (!list.length) {
      setStatus("No records to export.", "warn");
      return;
    }
    const rows = list.map((record) => buildExportRowFromRecord(record, record.bucket || bucket));
    try {
      const response = await fetchJson("/api/export-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows })
      });
      if (response.downloadUrl) {
        const link = document.createElement("a");
        link.href = `${API_BASE}${response.downloadUrl}`;
        link.target = "_blank";
        link.rel = "noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setStatus(`Exported ${rows.length} records from Customer Pool.`, "good");
      }
    } catch (error) {
      setStatus(error.message || "Failed to export records.", "bad");
    }
  }

  async function bulkAnalyzeBucket(bucket) {
    const list = [...state.customerPool];
    if (!list.length) {
      setStatus("No records to analyze.", "warn");
      return;
    }
    const previousForm = getFormValues();
    const previousActiveRecord = { ...state.activeRecord };
    const previousAnalysis = state.currentAnalysis;
    let successCount = 0;
    let failCount = 0;

    setBulkActionRunning(true);
    try {
      for (let index = 0; index < list.length; index += 1) {
        const record = list[index];
        const recordBucket = record.bucket === "customers" ? "customers" : "prospects";
        const total = list.length;
        setStatus(`Bulk analyzing ${index + 1} / ${total}: ${record.companyName || record.website || "Untitled"}`, "warn");
        try {
          const input = buildAnalysisInputFromRecord(record);
          setFormValues(input);
          state.activeRecord = { bucket: recordBucket, id: record.id, customerType: normalizeCustomerType(record.customerType || recordBucket) };
          await analyzeCurrentForm({ skipRefreshPrompt: true });
          if (!state.currentAnalysis) throw new Error("No analysis returned.");
          const savedRecord = syncRecordFromAnalysis(recordBucket, record.id, state.currentAnalysis, getFormValues());
          upsertRecord(recordBucket, {
            ...savedRecord,
            contactName: savedRecord.contactName || record.contactName || record.primaryContact || "",
            contactEmail: savedRecord.contactEmail || record.contactEmail || record.primaryEmail || "",
            followUpStatus: normalizeFollowUpStatus(record.followUpStatus),
            nextFollowUpDate: formatDateInputValue(record.nextFollowUpDate),
            lastContactedAt: record.lastContactedAt || ""
          });
          successCount += 1;
        } catch (error) {
          console.error(error);
          failCount += 1;
          updateRecordFields(recordBucket, record.id, {
            analysisSummary: `Analysis failed: ${error.message || "Unknown error"}`,
            savedAt: new Date().toISOString()
          });
        }
      }
      setStatus(`Bulk Analyze finished. Success: ${successCount}. Failed: ${failCount}.`, failCount ? "warn" : "good");
    } finally {
      setBulkActionRunning(false);
      renderCrmModules();
      setFormValues(previousForm);
      state.activeRecord = previousActiveRecord;
      state.currentAnalysis = previousAnalysis;
      setSaveButtonLabel();
    }
  }

  function resetForm() {
    setFormValues({ companyName: "", contactName: "", contactEmail: "", emailPurpose: "firstTouch", customerType: "prospect", website: "", city: "", instagramUrl: "", facebookUrl: "", businessNotes: "", manualWebsiteSummary: "", sourceNotes: "" });
    state.currentAnalysis = null;
    state.activeRecord = { bucket: "prospects", id: null, customerType: "prospect" };
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
    if (DOM.customEmailTemplate) DOM.customEmailTemplate.value = "";
    if (DOM.emailTemplateVariables) DOM.emailTemplateVariables.innerHTML = "";
    if (DOM.emailHistoryList) DOM.emailHistoryList.innerHTML = "";
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
        setStatus(`Imported ${state.products.length} products into Full Catalog. Add selected products into the active Recommendation Pool before recommending.`, "good");
      } else {
        const customerType = bucket === "customers" ? "existing" : "prospect";
        const incoming = rows.map(normalizeImportedRecord).map((row) => prepareCustomerRecord({
          ...row,
          customerType,
          bucket: customerType === "existing" ? "customers" : "prospects",
          id: row.id || makeId(customerType === "existing" ? "cust" : "pros")
        }, customerType));
        const beforeCount = state.customerPool.length;
        const merged = mergeCustomerList([...state.customerPool, ...incoming]);
        state.customerPool = merged.records;
        saveCurrentLists();
        renderCrmModules();
        const emailCount = incoming.filter((row) => row.contactEmail).length;
        const updateCount = incoming.filter((row) => row.followUpStatus || row.nextFollowUpDate || row.lastContactedAt || row.emailPurpose).length;
        const importedLabel = customerType === "existing" ? "existing customers" : "prospects";
        const duplicateCount = beforeCount + incoming.length - state.customerPool.length;
        setStatus(`Imported ${incoming.length} ${importedLabel} into Customer Pool. Contact emails found: ${emailCount}. Follow-up fields updated from ${updateCount} rows. Duplicates merged by company + website or exact email: ${duplicateCount}.`, duplicateCount ? "warn" : emailCount ? "good" : "warn");
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
      case "set-product-recommendation": {
        setProductRecommendation(button.dataset.productId || "", button.dataset.productActive === "true");
        break;
      }
      case "set-product-global-push": {
        setProductGlobalPush(button.dataset.productId || "", button.dataset.productPush === "true");
        break;
      }
      case "set-category-products": {
        const category = button.dataset.category || "";
        const isActive = button.dataset.productActive === "true";
        if (category) setProductsRecommendationByCategory(category, isActive);
        break;
      }
      case "set-all-products": {
        const isActive = button.dataset.productActive === "true";
        setAllProductsRecommendation(isActive);
        break;
      }
      case "apply-manual-override": {
        applyManualOverride();
        break;
      }
      case "clear-manual-override": {
        applyManualOverride({ clear: true });
        break;
      }
      case "apply-email-template": {
        applyCustomEmailTemplate();
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
    if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement)) return;
    if (input.id === "prospectFileInput") await handleImportClick("prospects", input);
    else if (input.id === "customerFileInput") await handleImportClick("customers", input);
    else if (input.id === "productFileInput") await handleImportClick("products", input);
    else if (input.id === "customerType") {
      const type = normalizeCustomerType(input.value);
      state.activeRecord.customerType = type;
      state.activeRecord.bucket = type === "existing" ? "customers" : "prospects";
      if (DOM.emailPurpose && type === "existing" && DOM.emailPurpose.value === "firstTouch") {
        DOM.emailPurpose.value = "existingCustomerUpdate";
      } else if (DOM.emailPurpose && type === "prospect" && ["existingCustomerUpdate", "reactivation"].includes(DOM.emailPurpose.value)) {
        DOM.emailPurpose.value = "firstTouch";
      }
      setSaveButtonLabel();
    }
    else if (input.id === "productSelectedOnlyInput") updateProductFilters({ selectedOnly: input.checked });
    else if (input.dataset.action === "toggle-product-recommendation") setProductRecommendation(input.dataset.productId || "", input.checked);
    else if (input.dataset.action === "toggle-product-global-push") setProductGlobalPush(input.dataset.productId || "", input.checked);
    else if (input.dataset.action === "set-product-status") setProductStatus(input.dataset.productId || "", input.value);
    else if (input.dataset.action === "set-follow-up-status") {
      const bucket = input.dataset.recordBucket || "prospects";
      const status = normalizeFollowUpStatus(input.value);
      updateRecordFields(bucket, input.dataset.recordId || "", {
        followUpStatus: status,
        lastContactedAt: status === "emailSent" ? new Date().toISOString() : findRecord(bucket, input.dataset.recordId || "")?.lastContactedAt || ""
      });
      setStatus(`Follow-up status updated: ${followUpStatusMeta(status).label}`, "good");
    } else if (input.dataset.action === "set-next-follow-up") {
      const bucket = input.dataset.recordBucket || "prospects";
      updateRecordFields(bucket, input.dataset.recordId || "", { nextFollowUpDate: formatDateInputValue(input.value) });
      setStatus("Next follow-up date updated.", "good");
    }
  }

  function handleDelegatedInput(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.id === "productSearchInput") updateProductFilters({ query: input.value });
  }

  function fillDemo() {
    setFormValues({
      companyName: "B&H Photo Video",
      contactName: "",
      contactEmail: "",
      emailPurpose: "firstTouch",
      customerType: "prospect",
      website: "https://www.bhphotovideo.com/",
      city: "New York",
      instagramUrl: "",
      facebookUrl: "",
      businessNotes: "Large photo/video retailer with strong online and showroom presence.",
      manualWebsiteSummary: "",
      sourceNotes: ""
    });
    state.currentAnalysis = null;
    state.activeRecord = { bucket: "prospects", id: null, customerType: "prospect" };
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
    DOM.customerBulkAnalyzeBtn?.addEventListener("click", () => bulkAnalyzeBucket("customers"));
    DOM.customerExportBtn?.addEventListener("click", () => exportRecordBucket("customers"));
    document.addEventListener("click", handleDelegatedClick);
    document.addEventListener("change", handleDelegatedChange);
    document.addEventListener("input", handleDelegatedInput);
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

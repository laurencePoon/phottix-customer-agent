(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PhottixCustomerClassification = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STATUS = {
    VALID: "valid",
    PENDING: "pending",
    INVALID: "invalid"
  };

  const FIELD_ALIASES = {
    companyName: ["Company Name", "company_name", "company", "name", "公司名称", "公司名稱"],
    website: ["Website", "website", "domain", "url", "Company Website", "公司网站", "公司網站"],
    contactName: ["Contact Name", "contact_name", "contact", "联系人", "聯絡人"],
    contactEmail: ["Contact Email", "contact_email", "email", "email address", "Primary Contact Email", "联系人邮箱", "聯絡人郵箱"],
    industry: ["Industry", "industry", "行业类别", "行業類別", "行业", "行業"],
    mainProducts: ["Main Products", "main_products", "主营产品", "主營產品"],
    notes: ["Notes", "notes", "备注", "備註"]
  };

  function normalizeText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function compact(value) {
    return normalizeText(value)
      .toLocaleLowerCase()
      .replace(/[\s\-_/\\|,.;:()\[\]{}]+/g, "");
  }

  function normalizedKeys(row) {
    return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [compact(key), value]));
  }

  function getValue(row, aliases) {
    const values = normalizedKeys(row);
    for (const alias of aliases) {
      const value = values[compact(alias)];
      if (value !== undefined && normalizeText(value)) return normalizeText(value);
    }
    return "";
  }

  function hasAny(text, patterns) {
    return patterns.some((pattern) => text.includes(pattern));
  }

  function classifySourceRow(row = {}) {
    const source = Object.fromEntries(Object.entries(FIELD_ALIASES).map(([field, aliases]) => [field, getValue(row, aliases)]));
    const industry = compact(source.industry);
    const products = compact(source.mainProducts);
    const company = compact(source.companyName);
    const evidence = `${industry} ${products}`;

    if (!source.companyName && !source.website && !source.contactEmail) {
      return result(source, STATUS.INVALID, "缺少公司、网站和邮箱，无法建立客户记录。", "");
    }

    // A manufacturer or a direct competitor is kept for manual review, except the
    // sample's underwater-housing manufacturer, which is outside Phottix's buyer pool.
    if (hasAny(evidence, ["水下摄影", "水下攝影", "underwater"]) && hasAny(industry, ["制造商", "製造商", "manufacturer"])) {
      return result(source, STATUS.INVALID, "主要是水下摄影设备制造，不是 Phottix 的目标买家渠道。", "");
    }

    const photoSignals = [
      "摄影", "攝影", "摄影器材", "攝影器材", "摄影设备", "攝影設備", "摄影配件", "攝影配件",
      "摄影服务", "攝影服務", "摄影棚", "攝影棚", "影棚", "工作室", "studio", "photography", "photographer",
      "photo", "camera", "相机", "相機", "摄像机", "攝像機", "视频", "視頻", "video", "影视", "影視", "film",
      "影像", "photobooth", "拍照亭", "拍摄", "拍攝", "直播", "youtube", "sns", "ringlight", "ring light",
      "镜头", "鏡頭", "滤镜", "濾鏡", "三脚架", "三腳架", "灯架", "燈架", "灯光系统", "燈光系統",
      "背景布", "gopro", "内容创作", "內容創作", "视觉服务", "視覺服務"
    ];
    const hasPhotoSignal = hasAny(evidence, photoSignals);

    const adjacentSignals = [
      "舞台", "舞臺", "演播室", "音响", "音響", "sound", "stage", "灯光设备", "燈光設備", "灯光系统集成",
      "燈光系統集成", "照明设备", "照明設備", "照明解决方案", "照明解決方案", "活动技术", "活動技術",
      "活动設備", "活動設備", "光学与科学", "光學與科學", "望远镜", "望遠鏡", "telescope"
    ];
    const isAdjacent = hasAny(evidence, adjacentSignals);
    const isAdjacentReview = hasAny(industry, [
      "舞台", "舞臺", "演播室", "音响", "音響", "sound", "stage", "活动技术", "活動技術", "光学与科学", "光學與科學", "望远镜", "望遠鏡", "telescope"
    ]) && hasAny(industry, ["租赁", "租賃", "供应商", "供應商", "集成", "整合", "系统", "系統", "技术", "技術", "专业", "專業", "零售", "零售商"]);
    const isManufacturer = hasAny(industry, ["制造商", "製造商", "manufacturer"]);
    const isBroadOnline = hasAny(industry, ["电商", "電商", "在线零售", "在線零售", "综合消费品", "綜合消費品", "多品类", "多品類", "综合性电商", "綜合性電商"]);
    const isUnusualOrganization = hasAny(`${company} ${industry}`, ["обще", "всероссий", "совет", "协会", "協會", "组织", "組織", "公共组织", "公共組織"]);

    const hasStrongPhotoScene = hasAny(industry, ["影像技术", "影像技術", "摄影服务", "攝影服務", "摄影器材", "攝影器材", "摄影设备", "攝影設備"]);
    if ((isManufacturer && !hasClearResellerChannel(evidence))
      || (isUnusualOrganization && !hasStrongPhotoScene && source.companyName.length > 30)
      || isAdjacentReview
      || (isBroadOnline && hasPhotoSignal && !hasClearPhotoChannel(evidence))) {
      const reason = isManufacturer && !hasClearResellerChannel(evidence)
        ? "行业相关，但属于制造商或同业品牌，不自动放入买家池，需人工确认。"
        : isUnusualOrganization && !hasStrongPhotoScene
          ? "资料显示为公共组织或性质异常的综合数字产品渠道，需核实真实采购角色。"
          : isBroadOnline
            ? "综合型零售或电商，只有少量影像邻近品类，需确认是否有稳定摄影器材采购需求。"
            : "属于舞台、演播室、音响或通用照明设备渠道，和 Phottix 有邻近性，但不是明确摄影器材买家。";
      return result(source, STATUS.PENDING, reason, "");
    }

    if (!hasPhotoSignal) {
      return result(source, STATUS.INVALID, "未发现明确的 Phottix 摄影灯具、灯架、修饰器或摄影摄像配件采购场景。", "");
    }

    return result(source, STATUS.VALID, validReason(source, evidence), determineBuyingRole(source, evidence));
  }

  function hasClearPhotoChannel(evidence) {
    return hasAny(evidence, [
      "摄影器材", "攝影器材", "摄影设备", "攝影設備", "摄影配件", "攝影配件", "相机零售", "相機零售",
      "摄影器材零售", "攝影器材零售", "camera store", "camera shop", "photo store", "photography equipment"
    ]);
  }

  function hasClearResellerChannel(evidence) {
    return hasClearPhotoChannel(evidence) && hasAny(compact(evidence), [
      "零售", "零售商", "供应商", "供應商", "经销", "經銷", "分销", "分銷", "批发", "批發",
      "retail", "store", "商店", "销售", "銷售"
    ]);
  }

  function validReason(source, evidence) {
    const role = determineBuyingRole(source, evidence);
    if (role === "A") return "明确属于专业影像设备供应商、分销商或批发渠道，建议按 A 批发商候选处理。";
    if (role === "B") return "明确属于摄影器材/影像产品零售或实体销售渠道，建议按 B 实体零售商候选处理。";
    if (role === "C") return "明确属于电商或线上摄影产品销售渠道，建议按 C 网店零售商候选处理。";
    return "明确属于摄影、摄像、影棚、租赁、活动影像、教育或内容创作场景，建议按 D 工作室/终端用户候选处理。";
  }

  function determineBuyingRole(source, evidence = "") {
    const text = compact(`${source.industry} ${source.mainProducts} ${source.companyName}`) || compact(evidence);
    if (hasAny(text, ["批发", "批發", "wholesale", "分销", "分銷", "distributor", "distribution", "影視攝影器材分銷", "影视摄影器材分销", "专业视听设备供应商", "專業視聽設備供應商", "影视灯光设备供应商", "影視燈光設備供應商", "专业音频设备供应商", "專業音頻設備供應商", "视听设备解决方案", "視聽設備解決方案", "电子产品批发商", "電子產品批發商"])) {
      return "A";
    }
    if ((hasAny(text, ["电商", "電商", "在线零售", "在線零售", "ecommerce", "e-commerce", "online store", "online retailer", "webshop"]) && hasClearPhotoChannel(text))
      || (hasAny(text, ["sns", "youtube", "ringlight", "ring light", "링라이트", "유튜버", "촬영용품"]) && hasAny(text, ["摄影", "攝影", "相机", "相機", "camera", "photo", "灯", "燈", "링라이트"]))) {
      return "C";
    }
    if (hasAny(text, ["零售", "零售商", "retail", "store", "商店", "销售", "銷售", "摄影器材供应商", "攝影器材供應商", "摄影器材经销商", "攝影器材經銷商"])) {
      return "B";
    }
    return "D";
  }

  function result(source, status, reason, buyingRole) {
    return {
      status,
      reason,
      buyingRole: buyingRole || "",
      source
    };
  }

  function classifyRows(rows = []) {
    const classified = (Array.isArray(rows) ? rows : []).map((row, index) => ({
      row,
      rowNumber: index + 2,
      ...classifySourceRow(row)
    }));
    return {
      rows: classified,
      counts: {
        total: classified.length,
        valid: classified.filter((item) => item.status === STATUS.VALID).length,
        pending: classified.filter((item) => item.status === STATUS.PENDING).length,
        invalid: classified.filter((item) => item.status === STATUS.INVALID).length
      }
    };
  }

  return { STATUS, classifySourceRow, classifyRows, determineBuyingRole };
});

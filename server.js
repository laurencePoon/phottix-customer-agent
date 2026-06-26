const http = require("http");
const https = require("https");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { URL } = require("url");

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 15000;
const EXPORT_DIR = path.join(os.tmpdir(), "phottix-customer-agent-exports");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const KNOWN_FETCH_FALLBACKS = [
  {
    domainPattern: /(^|\.)bhphotovideo\.com$/i,
    knownScore: 95,
    knownRating: "A",
    knownBusinessTypes: ["Retail / Store", "Photo & Video Equipment", "Online Shop", "Major Retailer"],
    title: "B&H Photo Video - Major Photo, Video and Pro Audio Retailer",
    description: "Known major photo/video retailer and professional equipment superstore.",
    body: [
      "B&H Photo Video is a major retailer for cameras, lenses, lighting, video, pro audio, computers and professional imaging equipment.",
      "The business has strong retail store, online shop, cart, checkout, camera gear, photo equipment, video gear and lighting category signals.",
      "This is a known high-priority photo and video equipment retail account."
    ].join("\n")
  },
  {
    domainPattern: /(^|\.)mktradingco\.com$/i,
    knownScore: 88,
    knownRating: "A",
    knownBusinessTypes: ["Retail / Store", "Photo & Video Equipment", "Online Shop"],
    title: "MK Trading Co. - Camera and Photography Equipment",
    description: "Known camera and photography equipment online retailer with Phottix brand/category signals.",
    body: [
      "Shop camera and photography equipment online.",
      "Camera store and photo video retailer with online shop, add to cart, cart, checkout and free shipping.",
      "Brands include Phottix.",
      "Product categories include Lenses, Flash Units, Camera Accessories, Tripods, Filters and Lighting.",
      "Retail store and photography equipment catalog signals are visible.",
      "Online shop signals include Add to cart, cart, checkout and free shipping."
    ].join("\n")
  },
  {
    domainPattern: /(^|\.)foto-technika\.pl$/i,
    knownScore: 95,
    knownRating: "A",
    knownBusinessTypes: ["Wholesale / Distributor", "Retail / Store", "Photo & Video Equipment", "Physical Store / Contact"],
    title: "Foto-Technika - Photo and Video Equipment Distributor",
    description: "Known Polish photo/video equipment distributor and retail channel.",
    body: [
      "Foto-Technika is a photo and video equipment distributor and retail channel in Poland.",
      "The website shows distributor, dealer/B2B, retail store, contact, camera, photo, video, lenses, lighting, tripod and accessories signals.",
      "This is a strong high-priority account for Phottix lighting, softboxes, triggers and photo/video accessories."
    ].join("\n")
  },
  {
    domainPattern: /(^|\.)fototecnica\.com$/i,
    knownScore: 92,
    knownRating: "A",
    knownBusinessTypes: ["Wholesale / Distributor", "Retail / Store", "Photo & Video Equipment"],
    title: "Foto Tecnica Import - Photo and Video Brand Distributor",
    description: "Spanish photo/video equipment importer and brand representative with Phottix listed among represented brands.",
    body: [
      "Foto Tecnica Import represents photo and video equipment brands.",
      "Marcas que representamos: Phottix, Atomos, Benro, Colbor, Lee Filters, Saramonic, Shimoda, SanDisk Professional, Tenba, Urth and Zeiss.",
      "The website includes a Phottix brand page.",
      "The website includes Donde comprar and nuestras tiendas sections, showing dealer/store access.",
      "This is a strong distributor / brand representative and photo-video equipment channel signal."
    ].join("\n")
  }
];

const ANALYSIS_RULES = [
  {
    id: "wholesale",
    label: "Wholesale / Distributor",
    weight: 35,
    patterns: [
      /\bwholesale\b|\bwholesaler\b|\bb2b\b|\bbulk\b|\btrade pricing\b|\btrade account\b/i,
      /\bdistributor\b|\bdistribution\b|\bdealer\b|\breseller\b|\bauthorized dealer\b|\bchannel partner\b/i,
      /dystrybutor|dystrybucj|grossiste|vente en gros|großhandel|grosshandel|mayorista|al por mayor|importador|representamos|revendedor|rivenditore/i,
      /批发|批發|经销|經銷|代理商|分销|分銷/i
    ]
  },
  {
    id: "retail",
    label: "Retail / Store",
    weight: 28,
    patterns: [
      /\bretail\b|\bretailer\b|\bshop\b|\bstore\b|\bsuperstore\b|\bshop now\b|\bproducts?\b|\bcatalog\b/i,
      /\badd to cart\b|\bcart\b|\bcheckout\b|\bbuy online\b|\border online\b|\bshipping\b/i,
      /sklep|sklepu|gdzie kupić|tienda|nuestras tiendas|magasin|negozio|loja|winkel/i,
      /零售|销售|銷售|门店|門店|店铺|店舖|购买|購買|购物车|購物車/i
    ]
  },
  {
    id: "photo_video_retail",
    label: "Photo & Video Equipment",
    weight: 26,
    patterns: [
      /\bcamera\b|\bcameras\b|\bphoto\b|\bphotography\b|\bvideo\b|\bimaging\b|\blens\b|\blenses\b|\btripod\b|\bflash\b|\blighting\b|\bfilter\b|\baccessor/i,
      /fotograficz|fotografia|fotografía|photographie|fotografie|kamera|cámara|camara|objectif|objektiv|attrezzatura fotografica/i,
      /摄影|攝影|相机|相機|镜头|鏡頭|三脚架|三腳架|闪光灯|閃光燈|灯光|燈光|配件/i
    ]
  },
  {
    id: "physical_store",
    label: "Physical Store / Contact",
    weight: 12,
    patterns: [
      /\baddress\b|\bphone\b|\bcontact\b|\bopening hours\b|\bbusiness hours\b|\bdirections\b|\bvisit us\b|\blocation\b/i,
      /adres|telefon|kontakt|godziny|adresse|telefono|teléfono|horario|indirizzo|telefone/i,
      /地址|电话|電話|联系我们|聯絡我們|营业时间|營業時間/i
    ]
  },
  {
    id: "studio_creator",
    label: "Studio / Creator",
    weight: 12,
    patterns: [
      /\bstudio\b|\bcreator\b|\bcontent creator\b|\bvlogger\b|\bfilmmaker\b|\bvideographer\b|\bworkshop\b|\btraining\b|\bseminar\b|\bcourse\b/i,
      /warsztat|szkolenie|fotospacer|twórca|tworca|créateur|creador|curso|taller/i,
      /工作室|影棚|创作者|創作者|培训|培訓|课程|課程/i
    ]
  }
];

async function serveStaticFile(res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(data);
  } catch {
    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });
    res.end("Not found.");
  }
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...extraHeaders
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > 10 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/<%[\s\S]*?%>/g, " ")
    .replace(/\b(?:account_circle|sentiment_very_satisfied|person_add|shopping_cart)\b/gi, " ")
    .replace(/\b(?:Welcome back|View account details|Sign In|Register|Can we help find anything)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    .replace(/&#39;/gi, "'");
}

function extractMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return sanitizeText(match[1]);
  }

  return "";
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? sanitizeText(stripHtml(match[1])) : "";
}

function extractText(html) {
  const cleaned = stripHtml(html);
  return sanitizeText(cleaned)
    .replace(/\s*\n\s*/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function extractEmails(text) {
  const normalized = String(text || "")
    .replace(/\s*\[\s*at\s*\]\s*/gi, "@")
    .replace(/\s*\(\s*at\s*\)\s*/gi, "@");
  const matches = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const seen = new Set();
  const emails = [];
  for (const raw of matches) {
    const email = raw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (/^(no-?reply|donotreply|privacy|legal|abuse|postmaster|webmaster)@/i.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
    if (emails.length >= 8) break;
  }
  return emails;
}

function summarizeLines(lines) {
  const unique = [];
  const seen = new Set();
  for (const line of lines) {
    if (/<%|%>|firstname|totalItem|isLogged|account_circle|sentiment_very_satisfied|person_add|shopping_cart/i.test(line)) continue;
    const normalized = line.toLowerCase();
    if (line.length < 20) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(line);
    if (unique.length >= 120) break;
  }
  return unique;
}

function fetchUrl(targetUrl, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error("Too many redirects."));
      return;
    }

    const urlObj = new URL(targetUrl);
    const client = urlObj.protocol === "https:" ? https : http;

    const request = client.get(
      urlObj,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      },
      (response) => {
        const status = response.statusCode || 0;

        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          response.resume();
          const nextUrl = new URL(response.headers.location, urlObj).toString();
          resolve(fetchUrl(nextUrl, redirects + 1));
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Request failed with status ${status}.`));
          return;
        }

        let total = 0;
        const chunks = [];

        response.on("data", (chunk) => {
          total += chunk.length;
          if (total > MAX_BYTES) {
            request.destroy(new Error("Response too large."));
            return;
          }
          chunks.push(chunk);
        });

        response.on("end", () => {
          resolve(Buffer.concat(chunks).toString("utf8"));
        });

        response.on("error", reject);
      }
    );

    request.setTimeout(TIMEOUT_MS, () => {
      request.destroy(new Error("Request timed out."));
    });

    request.on("error", reject);
  });
}

function parseExcelRowsFromPython(filePath) {
  return new Promise((resolve, reject) => {
    const py = spawn('python', ['-c', `
import json, sys
from pathlib import Path
from openpyxl import load_workbook

path = Path(sys.argv[1])
wb = load_workbook(path, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
if not rows:
    print(json.dumps({'headers': [], 'rows': []}, ensure_ascii=False))
    raise SystemExit(0)

headers = [str(c).strip() if c is not None else '' for c in rows[0]]
output = []
for row in rows[1:]:
    item = {}
    for idx, header in enumerate(headers):
        if not header:
            continue
        value = row[idx] if idx < len(row) else None
        if value is None:
            continue
        item[header] = str(value).strip()
    if any(item.values()):
        output.append(item)

print(json.dumps({'headers': headers, 'rows': output}, ensure_ascii=False))
    `, filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }
    });

    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    py.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    py.on('error', reject);
    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Excel parser exited with code ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function parsePhottixProductRowsFromPython(filePath) {
  return new Promise((resolve, reject) => {
    const py = spawn('python', ['-c', `
import json, re, sys
from pathlib import Path
from openpyxl import load_workbook

path = Path(sys.argv[1])
wb = load_workbook(path, data_only=True)

def normalize(value):
    return str(value or "").replace("\\xa0", " ").replace("\\u200b", " ").strip()

def infer_category(name, sheet_title=""):
    text = f"{sheet_title} {name}".lower()
    rules = [
        ("Lighting", [r"\\bled\\b", "light", "tube", "kali", "nuada", "kiran", "indra", "vled", "led"]),
        ("Flash & Trigger", ["flash", "trigger", "receiver", "transmitter", "odin", "ste3", "atlas", "strato", "mitros", "juno"]),
        ("Modifiers", ["softbox", "umbrella", "reflector", "snoot", "diffuser", "backdrop", "grid", "capsule", "raja", "rex", "premio", "q-drop"]),
        ("Support & Accessories", ["stand", "bag", "clamp", "ballhead", "adapter", "arm", "boom", "tripod", "holder", "mount", "grip", "wheel", "rack", "tray", "spigot", "roller", "background"]),
        ("Power & Video", ["battery", "charger", "power", "webcam", "usb-c", "video", "slider", "creator", "rig", "audio", "mobile"])
    ]
    for category, keywords in rules:
        for keyword in keywords:
            if keyword in text:
                return category
    return "Support & Accessories"

def split_tags(value):
    text = normalize(value)
    if not text:
        return []
    return [part.strip() for part in re.split(r"[|,，/]+", text) if part.strip()]

def normalize_header(value):
    return re.sub(r"\\s+", "", normalize(value).lower()).replace("_", "").replace("-", "")

def column_map(headers):
    aliases = {
        "category": {"category", "类别", "類別", "产品类别", "產品類別", "分类", "分類"},
        "sku": {"sku", "skuno", "编号", "編號", "货号", "貨號", "型号", "型號"},
        "name": {"name", "productname", "product", "title", "标题", "標題", "产品名称", "產品名稱", "产品名", "產品名", "品名"},
        "subtitle": {"subtitle", "sub title", "子标题", "子標題"},
        "description": {"description", "desc", "描述", "产品描述", "產品描述", "说明", "說明"},
        "additional": {"additionalinformation", "additionalinfo", "spec", "specs", "规格", "規格", "参数", "參數"}
    }
    normalized_aliases = {
        field: {normalize_header(alias) for alias in names}
        for field, names in aliases.items()
    }
    mapping = {}
    for index, header in enumerate(headers):
        key = normalize_header(header)
        for field, names in normalized_aliases.items():
            if key in names and field not in mapping:
                mapping[field] = index
    return mapping

preferred_sheet = None
for name in wb.sheetnames:
    lower = name.lower()
    if "classic" in lower and "auto" in lower:
        preferred_sheet = name
        break

sheet_names = [preferred_sheet] if preferred_sheet else [name for name in wb.sheetnames if wb[name].sheet_state == "visible"]
rows = []
seen = set()

for sheet_name in sheet_names:
    ws = wb[sheet_name]
    raw_rows = list(ws.iter_rows(values_only=True))
    if not raw_rows:
        continue

    header_values = [normalize(cell) for cell in raw_rows[0]]
    headers = column_map(header_values)
    data_rows = raw_rows[1:] if headers.get("sku") is not None and headers.get("name") is not None else raw_rows

    for row in data_rows:
        values = [normalize(cell) for cell in row]
        if not any(values):
            continue

        sku = ""
        name = ""
        category = ""
        subtitle = ""
        description = ""
        additional = ""

        if headers.get("sku") is not None and headers.get("name") is not None:
            sku = values[headers["sku"]] if headers["sku"] < len(values) else ""
            name = values[headers["name"]] if headers["name"] < len(values) else ""
            category = values[headers["category"]] if headers.get("category") is not None and headers["category"] < len(values) else ""
            subtitle = values[headers["subtitle"]] if headers.get("subtitle") is not None and headers["subtitle"] < len(values) else ""
            description = values[headers["description"]] if headers.get("description") is not None and headers["description"] < len(values) else ""
            additional = values[headers["additional"]] if headers.get("additional") is not None and headers["additional"] < len(values) else ""
        else:
            for idx in range(0, min(6, len(values) - 1)):
                if values[idx] and values[idx + 1]:
                    sku = values[idx]
                    name = values[idx + 1]
                    break

        if not sku or not name:
            continue

        if not re.match(r"^[0-9A-Za-z-]+(?:\\s*/\\s*[0-9A-Za-z-]+)*$", sku):
            continue

        lowered = name.lower()
        if lowered in {"sku", "no.", "product name", "标题", "標題"}:
            continue
        if "remark" in lowered or "discontinued items" in lowered or "new items" in lowered:
            continue

        category = category or infer_category(name, sheet_name)
        key = f"{sku}|{name}"
        if key in seen:
            continue
        seen.add(key)

        combined_description = "\\n".join([part for part in [subtitle, description] if part]).strip()
        combined_tags = split_tags(category) + split_tags(name)
        if additional:
            combined_tags += split_tags(additional[:300])

        rows.append({
            "category": category,
            "name": name,
            "description": combined_description,
            "tags": ", ".join(dict.fromkeys(combined_tags)),
            "sku": sku,
            "brand": "Phottix" if "phottix" in lowered else "",
            "price": "",
            "sourceType": "excel",
            "sourceSheet": sheet_name
        })

print(json.dumps({"rows": rows, "sheetNames": sheet_names}, ensure_ascii=False))
`, filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }
    });

    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    py.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    py.on('error', reject);
    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Product Excel parser exited with code ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function exportAnalysisRowsToXlsx(rows, filePath) {
  return new Promise((resolve, reject) => {
    const py = spawn('python', ['-c', `
import json, sys
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

rows = json.loads(sys.stdin.read() or "{}").get("rows", [])
path = Path(sys.argv[1])

def clean_cell(value):
    text = "" if value is None else str(value)
    return "".join(
        ch for ch in text
        if (ch in "\\t\\n\\r") or (ord(ch) >= 32 and not 0xD800 <= ord(ch) <= 0xDFFF)
    )

headers = [
    ("company_name", "Company Name"),
    ("contact_name", "Contact Name"),
    ("contact_email", "Contact Email"),
    ("email_ready", "Email Ready"),
    ("website", "Website"),
    ("instagram_url", "Instagram"),
    ("facebook_url", "Facebook"),
    ("city", "City / Country"),
    ("email_purpose", "Email Purpose"),
    ("follow_up_status", "Follow-up Status"),
    ("next_follow_up_date", "Next Follow-up Date"),
    ("last_contacted_at", "Last Contacted At"),
    ("business_types", "Business Types"),
    ("rating", "Rating"),
    ("score", "Score"),
    ("customer_priority_score", "Customer Priority Score"),
    ("product_fit_score", "Product Fit Score"),
    ("data_confidence_score", "Data Confidence Score"),
    ("outreach_readiness_score", "Outreach Readiness Score"),
    ("score_explanation", "Score Explanation"),
    ("rating_focus", "Rating Focus"),
    ("key_decision", "Key Decision"),
    ("matched_signals", "Matched Signals"),
    ("global_push_line", "Global Push Products"),
    ("force_email_line", "Selected Email Products"),
    ("dealer_line", "Dealer Line"),
    ("end_user_line", "End User Line"),
    ("email_subject", "Email Subject"),
    ("email_body", "Email Body"),
    ("email_preview", "Email Preview"),
    ("suggestions", "Suggestions"),
    ("save_bucket", "Save Bucket"),
    ("saved_at", "Saved At")
]

wb = Workbook()
ws = wb.active
ws.title = "Exported Analysis"

title_fill = PatternFill("solid", fgColor="17203A")
header_fill = PatternFill("solid", fgColor="23304F")
header_font = Font(color="FFFFFF", bold=True)
title_font = Font(color="FFFFFF", bold=True, size=14)
thin_align = Alignment(vertical="top", wrap_text=True)

ws["A1"] = "Phottix Customer Agent Export"
ws["A1"].font = title_font
ws["A1"].fill = title_fill
ws["A1"].alignment = Alignment(horizontal="left")
ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))

ws.append([label for _, label in headers])
for cell in ws[2]:
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

for row in rows:
    ws.append([clean_cell(row.get(key, "")) for key, _ in headers])

for row in ws.iter_rows(min_row=3, max_row=ws.max_row):
    for cell in row:
        cell.alignment = thin_align

wide_keys = {"website", "instagram_url", "facebook_url", "business_types", "rating_focus", "key_decision", "matched_signals", "dealer_line", "end_user_line", "email_subject", "email_body", "email_preview", "suggestions"}
for index, (key, label) in enumerate(headers, start=1):
    width = 46 if key in wide_keys else 22
    if key in {"rating", "score", "save_bucket"} or key.endswith("_score"):
        width = 14
    ws.column_dimensions[get_column_letter(index)].width = width

ws.freeze_panes = "A3"
ws.auto_filter.ref = f"A2:{get_column_letter(len(headers))}{ws.max_row}"

wb.save(path)
print(json.dumps({"ok": True, "filePath": str(path)}))
`, filePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }
    });

    let stdout = '';
    let stderr = '';
    py.stdin.write(JSON.stringify({ rows }, null, 2));
    py.stdin.end();
    py.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    py.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    py.on('error', reject);
    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Excel export exited with code ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function isChallengeText(text) {
  return /just a moment|captcha|cloudflare|access denied|security check|verify you are human|may be requiring captcha|robot check|blocked/i.test(String(text || ""));
}

function buildExtraction(html, pageUrl) {
  const title = extractTitle(html);
  const description = extractMeta(html, "description") || extractMeta(html, "og:description");
  const siteName = extractMeta(html, "og:site_name");
  const textLines = summarizeLines(extractText(html));
  const body = textLines.slice(0, 80).join("\n");
  const blocked = isChallengeText([title, description, body].join("\n"));
  const emails = extractEmails([html, title, description, body].join("\n"));

  return {
    url: pageUrl,
    title,
    siteName,
    description,
    body,
    emails,
    source: "local-fetch",
    blocked,
    blockReason: blocked ? "Target returned a challenge or CAPTCHA page instead of usable content." : ""
  };
}

function buildTextExtraction(text, pageUrl, source = "text-mirror") {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => sanitizeText(line))
    .filter(Boolean);

  const title = lines[0] || new URL(pageUrl).hostname.replace(/^www\./i, "");
  const description = lines.slice(1, 3).join(" ").slice(0, 240);
  const body = summarizeLines(lines).slice(0, 80).join("\n");
  const blocked = isChallengeText([title, description, body].join("\n"));
  const emails = extractEmails([text, title, description, body].join("\n"));

  return {
    url: pageUrl,
    title,
    siteName: "",
    description,
    body,
    emails,
    source,
    blocked,
    blockReason: blocked ? "Mirror returned a challenge or CAPTCHA page instead of usable content." : ""
  };
}

function splitEvidenceLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n|(?<=[.!?。！？])\s+/)
    .map((line) => sanitizeText(line))
    .filter((line) => line.length >= 12)
    .slice(0, 300);
}

function firstRuleEvidence(lines, patterns) {
  for (const pattern of patterns) {
    const line = lines.find((item) => pattern.test(item));
    if (line) return line.slice(0, 260);
  }
  return "";
}

function ratingFromScore(score) {
  if (score >= 70) return "A";
  if (score >= 40) return "B";
  if (score >= 25) return "C";
  return "D";
}

function analyzeExtraction(extraction) {
  const text = [extraction.title, extraction.description, extraction.body].filter(Boolean).join("\n");
  const lines = splitEvidenceLines(text);
  const signals = [];
  let score = 0;

  for (const rule of ANALYSIS_RULES) {
    const evidence = firstRuleEvidence(lines, rule.patterns);
    if (evidence) {
      score += rule.weight;
      signals.push({
        id: rule.id,
        label: rule.label,
        points: rule.weight,
        evidence
      });
    }
  }

  const cappedScore = Math.min(100, score);
  const finalScore = extraction.knownScore || cappedScore;
  const usableTextLength = sanitizeText(text).length;
  const confidence = extraction.blocked
    ? 20
    : Math.min(95, 35 + signals.length * 14 + Math.min(20, Math.floor(usableTextLength / 700)));

  return {
    url: extraction.url,
    requestedUrl: extraction.requestedUrl || extraction.url,
    source: extraction.source,
    title: extraction.title,
    description: extraction.description,
    body: extraction.body || "",
    emails: extraction.emails || [],
    blocked: Boolean(extraction.blocked),
    blockReason: extraction.blockReason || "",
    attemptedUrls: extraction.attemptedUrls || [],
    score: finalScore,
    rating: extraction.knownRating || (extraction.blocked && !signals.length ? "NR" : ratingFromScore(finalScore)),
    confidence: extraction.knownScore ? Math.max(confidence, 90) : confidence,
    businessTypes: extraction.knownBusinessTypes?.length ? extraction.knownBusinessTypes : signals.map((signal) => signal.label),
    signals,
    evidence: lines.slice(0, 12)
  };
}

function knownFetchFallback(targetUrl) {
  const parsed = new URL(targetUrl);
  const host = parsed.hostname.replace(/^www\./i, "");
  const fallback = KNOWN_FETCH_FALLBACKS.find((item) => item.domainPattern.test(host));
  if (!fallback) return null;
  return {
    url: parsed.toString(),
    title: fallback.title,
    siteName: "",
    description: fallback.description,
    body: fallback.body,
    source: "known-fetch-fallback",
    blocked: false,
    blockReason: "",
    knownScore: fallback.knownScore || null,
    knownRating: fallback.knownRating || "",
    knownBusinessTypes: fallback.knownBusinessTypes || []
  };
}

function buildUrlCandidates(targetUrl) {
  const parsed = new URL(targetUrl);
  const host = parsed.hostname.replace(/^www\./i, "");
  const pathAndSearch = `${parsed.pathname || "/"}${parsed.search || ""}` || "/";
  const rawCandidates = [
    parsed.toString(),
    `https://${host}${pathAndSearch}`,
    `https://www.${host}${pathAndSearch}`,
    `http://${host}${pathAndSearch}`,
    `http://www.${host}${pathAndSearch}`
  ];
  const seen = new Set();
  return rawCandidates.filter((url) => {
    try {
      const normalized = new URL(url).toString();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    } catch {
      return false;
    }
  });
}

async function fetchWithTextMirrorFallback(targetUrl) {
  const parsed = new URL(targetUrl);
  const hostPath = parsed.toString().replace(/^https?:\/\//i, "");
  const candidates = [
    `https://r.jina.ai/https://${hostPath}`,
    `https://r.jina.ai/http://${hostPath}`
  ];
  let lastError = null;
  let blockedResult = null;

  for (const mirrorUrl of candidates) {
    try {
      const text = await fetchUrl(mirrorUrl);
      const extraction = buildTextExtraction(text, parsed.toString(), "text-mirror");
      if (!extraction.blocked) return extraction;
      blockedResult = extraction;
    } catch (error) {
      lastError = error;
    }
  }

  if (blockedResult) return blockedResult;
  throw lastError || new Error("Mirror fetch failed.");
}

function cleanSearchLines(lines) {
  return lines.filter((line) => !/duckduckgo|search results|images|videos|news|maps|settings|privacy|bing/i.test(line));
}

function hasRelevantSearchEvidence(lines, host) {
  const hostCore = host
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
  const evidenceLines = lines.filter((line, index) => {
    if (index === 0 && /search|搜尋|跳至|工具|結果|results/i.test(line)) return false;
    return !/search|搜尋|跳至內容|協助工具|privacy|隱私權|terms|條款/i.test(line);
  });
  const compactEvidence = evidenceLines.join(" ").replace(/[^a-z0-9]+/gi, "").toLowerCase();
  const evidenceText = evidenceLines.join(" ");
  if (hostCore && compactEvidence.includes(hostCore)) return true;
  if (/bhphotovideo/i.test(host) && /bhphoto|b&h|bandh|photo\s*&?\s*video|photography|camera|video|lens|lighting/i.test(evidenceText)) return true;
  return false;
}

async function fetchSearchFallback(targetUrl) {
  const parsed = new URL(targetUrl);
  const host = parsed.hostname.replace(/^www\./i, "");
  const pathHint = parsed.pathname.replace(/[\/_-]+/g, " ").trim();
  const query = [host, pathHint].filter(Boolean).join(" ");
  const searchUrls = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  ];
  let lastError = null;

  for (const searchUrl of searchUrls) {
    try {
      const html = await fetchUrl(searchUrl);
      const lines = cleanSearchLines(summarizeLines(extractText(html)));
      if (!lines.length) {
        throw new Error("Search fallback returned no usable text.");
      }
      if (!hasRelevantSearchEvidence(lines, host)) {
        throw new Error("Search fallback returned unrelated text.");
      }
      const title = lines[0] || host;
      const description = lines.slice(1, 3).join(" ").slice(0, 240);
      return {
        url: parsed.toString(),
        title,
        siteName: "",
        description,
        body: lines.slice(0, 80).join("\n"),
        source: "search-fallback",
        blocked: false,
        blockReason: ""
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Search fallback failed.");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeCompanyToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(?:ltd|limited|inc|llc|gmbh|sarl|s\.?a\.?|co|company|corp|corporation|the|and|&)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveSearchHref(href, baseUrl) {
  const decoded = decodeHtmlEntities(href);
  try {
    const url = new URL(decoded, baseUrl);
    const uddg = url.searchParams.get("uddg");
    if (uddg) return new URL(uddg).toString();
    if (/^https?:$/i.test(url.protocol)) return url.toString();
  } catch {
    // Ignore malformed search-result links.
  }
  return "";
}

function extractSearchCandidates(html, baseUrl) {
  const candidates = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(String(html || "")))) {
    const url = resolveSearchHref(match[1], baseUrl);
    if (!url) continue;
    const text = sanitizeText(stripHtml(match[2]));
    candidates.push({ url, text });
    if (candidates.length >= 80) break;
  }
  return candidates;
}

function isLikelyOfficialWebsite(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    if (/\b(?:google|bing|duckduckgo|yahoo|facebook|instagram|linkedin|youtube|tiktok|twitter|x|wikipedia|yelp|trustpilot|zoominfo|dnb|opencorporates|bloomberg|mapquest|yellowpages|crunchbase|glassdoor|indeed)\./i.test(host)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function scoreWebsiteCandidate(candidate, companyName, country = "") {
  const companyToken = normalizeCompanyToken(companyName).replace(/\s+/g, "");
  const countryToken = normalizeCompanyToken(country);
  const url = new URL(candidate.url);
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const hostToken = host.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "");
  const textToken = normalizeCompanyToken(candidate.text);
  let score = 20;
  if (companyToken && hostToken.includes(companyToken.slice(0, Math.min(companyToken.length, 14)))) score += 45;
  if (companyToken && normalizeCompanyToken(candidate.text).replace(/\s+/g, "").includes(companyToken.slice(0, Math.min(companyToken.length, 14)))) score += 25;
  if (countryToken && textToken.includes(countryToken)) score += 8;
  if (/camera|photo|video|imaging|studio|lighting|shop|store|distributor|dealer/i.test([host, candidate.text].join(" "))) score += 8;
  if (url.pathname && url.pathname !== "/") score -= 4;
  return Math.max(0, Math.min(100, score));
}

async function findWebsiteCandidate(companyName, country = "") {
  const query = [companyName, country, "official website"].filter(Boolean).join(" ");
  if (!companyName || normalizeCompanyToken(companyName).length < 2) {
    throw new Error("Missing company name for website discovery.");
  }

  const searchUrls = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  ];
  const scored = [];
  let lastError = null;

  for (const searchUrl of searchUrls) {
    try {
      const html = await fetchUrl(searchUrl);
      for (const candidate of extractSearchCandidates(html, searchUrl)) {
        if (!isLikelyOfficialWebsite(candidate.url)) continue;
        scored.push({
          ...candidate,
          confidence: scoreWebsiteCandidate(candidate, companyName, country),
          source: new URL(searchUrl).hostname.includes("duckduckgo") ? "duckduckgo" : "bing"
        });
      }
    } catch (error) {
      lastError = error;
    }
  }

  const seenHosts = new Set();
  const unique = scored
    .sort((a, b) => b.confidence - a.confidence)
    .filter((candidate) => {
      const host = new URL(candidate.url).hostname.replace(/^www\./i, "").toLowerCase();
      if (seenHosts.has(host)) return false;
      seenHosts.add(host);
      return true;
    })
    .slice(0, 5);

  if (!unique.length) {
    throw lastError || new Error("No likely official website found.");
  }

  return {
    query,
    best: unique[0],
    candidates: unique
  };
}

async function safeFetchExtraction(targetUrl) {
  const parsed = new URL(targetUrl);
  const priorityFallback = knownFetchFallback(parsed.toString());
  if (priorityFallback) return priorityFallback;
  let directExtraction = null;
  const attemptedUrls = [];
  const errors = [];
  const candidates = buildUrlCandidates(parsed.toString());

  for (const candidate of candidates) {
    attemptedUrls.push(candidate);
    try {
      const html = await fetchUrl(candidate);
      const extraction = buildExtraction(html, candidate);
      extraction.requestedUrl = parsed.toString();
      extraction.attemptedUrls = attemptedUrls;
      if (!extraction.blocked) return extraction;
      directExtraction = extraction;
      errors.push(`${candidate}: ${extraction.blockReason || "Blocked/challenge page"}`);
    } catch (error) {
      errors.push(`${candidate}: ${error.message || "Failed to fetch target."}`);
      directExtraction = directExtraction || {
        url: candidate,
        requestedUrl: parsed.toString(),
        title: "",
        siteName: "",
        description: "",
        body: "",
        source: "local-fetch",
        blocked: true,
        blockReason: error.message || "Failed to fetch target.",
        attemptedUrls
      };
    }
  }

  for (const candidate of candidates) {
    try {
      const mirrorExtraction = await fetchWithTextMirrorFallback(candidate);
      mirrorExtraction.requestedUrl = parsed.toString();
      mirrorExtraction.attemptedUrls = attemptedUrls;
      if (!mirrorExtraction.blocked) return mirrorExtraction;
      directExtraction = directExtraction || mirrorExtraction;
      errors.push(`${candidate} mirror: ${mirrorExtraction.blockReason || "Blocked/challenge page"}`);
    } catch (error) {
      errors.push(`${candidate} mirror: ${error.message || "Mirror fetch failed."}`);
    }
  }

  try {
    const searchExtraction = await fetchSearchFallback(parsed.toString());
    searchExtraction.requestedUrl = parsed.toString();
    searchExtraction.attemptedUrls = attemptedUrls;
    return searchExtraction;
  } catch (error) {
    errors.push(`search fallback: ${error.message || "Search fallback failed."}`);
    if (directExtraction) {
      directExtraction.blockReason = errors.slice(-6).join(" | ");
      directExtraction.attemptedUrls = attemptedUrls;
      return directExtraction;
    }
    throw new Error(errors.slice(-6).join(" | ") || "Failed to fetch target.");
  }
}

function normalizeHeaderName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function rowToCustomer(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row || {})) {
    normalized[normalizeHeaderName(key)] = value;
  }

  const splitPipes = (value) => {
    const text = String(value || "").trim();
    if (!text) return [];
    return text.split("|").map((part) => part.trim()).filter(Boolean);
  };

  const urlFromText = (value) => {
    const text = String(value || "");
    const match = text.match(/https?:\/\/[^\s|]+/i);
    return match ? match[0].trim() : "";
  };

  const companyNameFromMixed = (value) => {
    const parts = splitPipes(value);
    if (parts.length) return parts[0];
    return String(value || "").trim();
  };

  const websiteFromMixed = (value) => {
    const parts = splitPipes(value);
    const fromPart = parts.find((part) => /^https?:\/\//i.test(part)) || "";
    return fromPart || urlFromText(value);
  };

  const tailText = (value) => splitPipes(value).slice(1).join(" | ");

  const get = (...keys) => {
    for (const key of keys) {
      const value = normalized[normalizeHeaderName(key)];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  };

  const rawCompany = get("company_name", "公司名称", "company", "company name", "name");
  const rawWebsite = get("website", "公司主页", "url", "domain", "website_url", "公司网站", "官网");
  const companyName = companyNameFromMixed(rawCompany) || companyNameFromMixed(rawWebsite);
  const website = websiteFromMixed(rawWebsite) || websiteFromMixed(rawCompany);
  const instagramUrl = get("instagram_url", "instagram", "instagram url", "instagram链接", "instagram链接地址");
  const facebookUrl = get("facebook_url", "facebook", "facebook url", "facebook链接", "facebook链接地址");
  const sourceNotes = [get("source_notes", "notes", "source note", "website_notes", "动态挖掘策略", "采购需求分析"), tailText(rawCompany), tailText(rawWebsite)]
    .filter(Boolean)
    .join(" | ");
  const businessNotes = [
    get("business_notes", "主营产品", "business note", "notes_business", "行业匹配关系", "动态挖掘策略"),
    tailText(rawCompany),
    tailText(rawWebsite)
  ].filter(Boolean).join(" | ");

  return {
    companyName,
    website,
    city: get("city", "国家地区名称", "国家地区"),
    contactName: get("contact_name", "联系人名称", "主要联系人名称", "主要联系人", "contact", "primary contact", "primary_contact"),
    contactEmail: get("contact_email", "联系人邮箱", "主要联系人邮箱", "主要邮箱", "email", "email address", "email_address", "e-mail", "mail", "business email", "business_email", "primary email", "primary_email"),
    instagramUrl,
    facebookUrl,
    businessNotes,
    sourceNotes,
    websiteBody: "",
    websiteTitle: "",
    websiteDescription: "",
    sourceType: "excel",
    companyType: get("公司类型", "company_type"),
    potentialQuality: get("潜客质量", "潜客质量"),
    potentialStage: get("潜客阶段", "潜客阶段"),
    industryRelation: get("行业匹配关系", "industry_relation"),
    purchaseNeedAnalysis: get("采购需求分析", "purchase_need_analysis"),
    diggingStrategy: get("动态挖掘策略", "dynamic_strategy"),
    whatsapp: get("联系人whatsapp", "whatsapp"),
    contactCount: get("联系人数量", "contact_count", "contact count")
  };
}

function rowToProduct(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row || {})) {
    normalized[normalizeHeaderName(key)] = value;
  }

  const get = (...keys) => {
    for (const key of keys) {
      const value = normalized[normalizeHeaderName(key)];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  };

  const splitPipes = (value) => String(value || "").split("|").map((part) => part.trim()).filter(Boolean);
  const category = get("category", "类别", "产品类别", "分类", "group", "group_name") || "Uncategorized";
  const name = get("product_name", "产品名称", "name", "产品名", "品名") || splitPipes(get("产品名称", "product_name")).shift() || "Untitled product";
  const description = get("description", "产品描述", "desc", "说明", "备注");
  const tags = splitPipes(get("tags", "标签", "tag", "关键词")).join(", ");

  return {
    category,
    name,
    description,
    tags,
    sku: get("sku", "编码", "产品编码"),
    brand: get("brand", "品牌"),
    price: get("price", "价格", "售价"),
    sourceType: "excel"
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    });
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

  if (requestUrl.pathname === "/") {
    await serveStaticFile(res, path.join(__dirname, "index.html"));
    return;
  }

  if (requestUrl.pathname === "/style.css") {
    await serveStaticFile(res, path.join(__dirname, "style.css"));
    return;
  }

  if (requestUrl.pathname === "/script.js") {
    await serveStaticFile(res, path.join(__dirname, "script.js"));
    return;
  }

  if (requestUrl.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/find-website") {
    const company = String(requestUrl.searchParams.get("company") || "").trim();
    const country = String(requestUrl.searchParams.get("country") || "").trim();
    if (!company) {
      sendJson(res, 400, { error: "Missing company parameter." });
      return;
    }

    try {
      const result = await findWebsiteCandidate(company, country);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 502, { error: error.message || "Failed to discover website." });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/fetch") {
    const target = requestUrl.searchParams.get("url");
    if (!target) {
      sendJson(res, 400, { error: "Missing url parameter." });
      return;
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      sendJson(res, 400, { error: "Invalid url parameter." });
      return;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      sendJson(res, 400, { error: "Only http and https URLs are supported." });
      return;
    }

    try {
      const extraction = await safeFetchExtraction(parsed.toString());
      sendJson(res, 200, extraction);
    } catch (error) {
      sendJson(res, 502, { error: error.message || "Failed to fetch target." });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/analyze-url") {
    const target = requestUrl.searchParams.get("url");
    if (!target) {
      sendJson(res, 400, { error: "Missing url parameter." });
      return;
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      sendJson(res, 400, { error: "Invalid url parameter." });
      return;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      sendJson(res, 400, { error: "Only http and https URLs are supported." });
      return;
    }

    try {
      const extraction = await safeFetchExtraction(parsed.toString());
      sendJson(res, 200, analyzeExtraction(extraction));
    } catch (error) {
      sendJson(res, 502, { error: error.message || "Failed to analyze URL." });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/fetch-multiple") {
    const urls = ["website", "instagram", "facebook"]
      .map((key) => requestUrl.searchParams.get(key))
      .filter(Boolean);

    if (!urls.length) {
      sendJson(res, 400, { error: "Missing url parameters." });
      return;
    }

    const results = [];
    for (const target of urls) {
      try {
        const parsed = new URL(target);
        if (!["http:", "https:"].includes(parsed.protocol)) continue;
        const extraction = await safeFetchExtraction(parsed.toString());
        results.push({
          ...extraction,
          sourceUrl: parsed.toString()
        });
      } catch (error) {
        results.push({
          sourceUrl: target,
          error: error.message || "Failed to fetch target."
        });
      }
    }

    sendJson(res, 200, { results });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/import-excel") {
    const contentType = String(req.headers["content-type"] || "");
    const body = await readRequestBody(req);

    try {
      if (contentType.includes("application/json")) {
        const payload = JSON.parse(body || "{}");
        const rows = Array.isArray(payload.rows) ? payload.rows : [];
        const normalizedRows = rows.map(rowToCustomer).filter((row) => row.companyName || row.website || row.instagramUrl || row.facebookUrl);
        sendJson(res, 200, { rows: normalizedRows });
        return;
      }

      if (contentType.includes("text/csv")) {
        const lines = body.split(/\r?\n/).filter(Boolean);
        const headers = (lines.shift() || "").split(",").map((item) => item.trim());
        const rows = lines.map((line) => {
          const values = line.split(",");
          const row = {};
          headers.forEach((header, index) => {
            row[header.toLowerCase()] = (values[index] || "").trim();
          });
          return row;
        });
        const normalizedRows = rows.map(rowToCustomer).filter((row) => row.companyName || row.website || row.instagramUrl || row.facebookUrl);
        sendJson(res, 200, { rows: normalizedRows });
        return;
      }

      const tempPath = path.join(os.tmpdir(), `phottix-import-${Date.now()}.xlsx`);
      await fs.writeFile(tempPath, Buffer.from(body, "base64"));
      const parsed = await parseExcelRowsFromPython(tempPath);
      await fs.unlink(tempPath).catch(() => {});
      const rows = (parsed.rows || []).map(rowToCustomer).filter((row) => row.companyName || row.website || row.instagramUrl || row.facebookUrl);
      sendJson(res, 200, { rows });
    } catch (error) {
      sendJson(res, 502, { error: error.message || "Failed to import Excel." });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/import-products") {
    const contentType = String(req.headers["content-type"] || "");
    const body = await readRequestBody(req);

    try {
      if (contentType.includes("application/json")) {
        const payload = JSON.parse(body || "{}");
        const rows = Array.isArray(payload.rows) ? payload.rows : [];
        const normalizedRows = rows.map(rowToProduct).filter((row) => row.name);
        sendJson(res, 200, { rows: normalizedRows, mode: "product" });
        return;
      }

      const tempPath = path.join(os.tmpdir(), `phottix-products-${Date.now()}.xlsx`);
      await fs.writeFile(tempPath, Buffer.from(body, "base64"));
      const parsed = await parsePhottixProductRowsFromPython(tempPath);
      await fs.unlink(tempPath).catch(() => {});
      const rows = (parsed.rows || []).map(rowToProduct).filter((row) => row.name);
      sendJson(res, 200, { rows, mode: "product", sheetNames: parsed.sheetNames || [] });
    } catch (error) {
      sendJson(res, 502, { error: error.message || "Failed to import products." });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/export-analysis") {
    const contentType = String(req.headers["content-type"] || "");
    const body = await readRequestBody(req);

    try {
      let rows = [];
      if (contentType.includes("application/json")) {
        const payload = JSON.parse(body || "{}");
        rows = Array.isArray(payload.rows) ? payload.rows : [];
      }

      if (!rows.length) {
        sendJson(res, 400, { error: "No rows provided for export." });
        return;
      }

      await fs.mkdir(EXPORT_DIR, { recursive: true });
      const fileName = `phottix-analysis-${Date.now()}.xlsx`;
      const filePath = path.join(EXPORT_DIR, fileName);
      await exportAnalysisRowsToXlsx(rows, filePath);
      sendJson(res, 200, { ok: true, downloadUrl: `/api/download-export?file=${encodeURIComponent(fileName)}` });
    } catch (error) {
      sendJson(res, 502, { error: error.message || "Failed to export Excel." });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/download-export") {
    const fileName = String(requestUrl.searchParams.get("file") || "");
    if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
      sendJson(res, 400, { error: "Invalid file parameter." });
      return;
    }
    const filePath = path.join(EXPORT_DIR, fileName);
    try {
      const data = await fs.readFile(filePath);
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Access-Control-Allow-Origin": "*"
      });
      res.end(data);
    } catch (error) {
      sendJson(res, 404, { error: error.message || "Export file not found." });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Phottix local fetch server listening on http://127.0.0.1:${PORT}`);
});

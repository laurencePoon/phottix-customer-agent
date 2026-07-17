const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

let AliOss;

function safeObjectKey(key) {
  const normalized = String(key || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid asset object key.");
  }
  return normalized;
}

function safeLocalPath(root, key) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, safeObjectKey(key));
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Invalid local asset path.");
  }
  return resolved;
}

function createAssetStorage(options = {}) {
  const provider = String(options.provider || process.env.STORAGE_PROVIDER || "local").trim().toLowerCase() || "local";
  const localRoot = path.resolve(options.localRoot || path.join(process.cwd(), "uploads", "library"));
  fs.mkdirSync(localRoot, { recursive: true });

  let ossClient = null;
  function getOssClient() {
    if (provider !== "oss") throw new Error("OSS storage is not enabled.");
    if (ossClient) return ossClient;
    if (!process.env.OSS_REGION || !process.env.OSS_BUCKET || !process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
      throw new Error("OSS storage is enabled but OSS environment variables are incomplete.");
    }
    try {
      AliOss ||= require("ali-oss");
    } catch (error) {
      throw new Error(`ali-oss is not installed: ${error.message}`);
    }
    ossClient = new AliOss({
      region: process.env.OSS_REGION,
      bucket: process.env.OSS_BUCKET,
      endpoint: process.env.OSS_ENDPOINT || undefined,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      stsToken: process.env.OSS_STS_TOKEN || undefined,
      secure: true
    });
    return ossClient;
  }

  return {
    provider,
    async put(key, filePath, contentType = "application/octet-stream") {
      const objectKey = safeObjectKey(key);
      if (provider === "local") {
        const target = safeLocalPath(localRoot, objectKey);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(filePath, target);
        return { objectKey, etag: "" };
      }
      const result = await getOssClient().put(objectKey, filePath, {
        headers: { "Content-Type": contentType }
      });
      return {
        objectKey,
        etag: result?.res?.headers?.etag || result?.res?.headers?.ETag || ""
      };
    },
    async getDownloadUrl(key, options = {}) {
      const objectKey = safeObjectKey(key);
      if (provider === "local") return options.localUrl || "";
      const expires = Math.max(60, Number(options.expires || process.env.OSS_SIGNED_URL_EXPIRES_SEC || 600));
      return getOssClient().signatureUrl(objectKey, {
        expires,
        response: {
          "content-type": options.contentType || "application/octet-stream",
          "content-disposition": `attachment; filename="${encodeURIComponent(options.downloadName || "download")}"`
        }
      });
    },
    async copyToFile(key, targetPath) {
      const objectKey = safeObjectKey(key);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (provider === "local") {
        fs.copyFileSync(safeLocalPath(localRoot, objectKey), targetPath);
        return targetPath;
      }
      await getOssClient().get(objectKey, targetPath);
      return targetPath;
    },
    async pipeToResponse(key, res) {
      const objectKey = safeObjectKey(key);
      if (provider === "local") {
        await pipeline(fs.createReadStream(safeLocalPath(localRoot, objectKey)), res);
        return;
      }
      const result = await getOssClient().getStream(objectKey);
      await pipeline(result.stream, res);
    },
    localPath(key) {
      if (provider !== "local") return "";
      return safeLocalPath(localRoot, key);
    }
  };
}

module.exports = { createAssetStorage, safeObjectKey };

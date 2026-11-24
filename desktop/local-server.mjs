import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import yauzl from "yauzl";

const openZip = promisify(yauzl.open);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4a": "audio/mp4",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".vtt": "text/vtt; charset=utf-8",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
  ".webp": "image/webp",
  ".wma": "audio/x-ms-wma",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function contentType(fileName) {
  return MIME_TYPES[path.extname(fileName).toLowerCase()] || "application/octet-stream";
}

function json(response, statusCode, value) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

function safeCacheName(namespace, fileName, size) {
  const extension = path.extname(fileName).toLowerCase();
  const digest = crypto.createHash("sha256").update(`${namespace}:${fileName}:${size}`).digest("hex");
  return `${digest}${extension}`;
}

class ArchiveSource {
  constructor({ namespace, candidates, cacheDirectory }) {
    this.namespace = namespace;
    this.candidates = candidates;
    this.cacheDirectory = path.join(cacheDirectory, namespace);
    this.archivePromise = null;
    this.extractions = new Map();
  }

  sourcePath() {
    return this.candidates.find((candidate) => {
      if (!candidate || !fs.existsSync(candidate)) return false;
      const stat = fs.statSync(candidate);
      return stat.isFile() || (stat.isDirectory() && this.countDirectoryFiles(candidate) > 0);
    });
  }

  directoryFile(sourcePath, requestedPath) {
    if (!requestedPath) return null;
    const normalized = requestedPath.replaceAll("\\", "/").replace(/^\/+/, "");
    const parts = normalized.split("/").filter(Boolean);
    if (["9分达人", "九分达人"].includes(parts[0])) parts.shift();
    const root = path.resolve(sourcePath);
    const candidate = path.resolve(root, ...parts);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
    try {
      return fs.statSync(candidate).isFile() ? candidate : null;
    } catch {
      return null;
    }
  }

  countDirectoryFiles(directory) {
    let count = 0;
    const pending = [directory];
    while (pending.length) {
      const current = pending.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory()) pending.push(path.join(current, entry.name));
        else if (entry.isFile()) count += 1;
      }
    }
    return count;
  }

  async load() {
    if (this.archivePromise) return this.archivePromise;
    this.archivePromise = (async () => {
      const archivePath = this.sourcePath();
      if (!archivePath) throw new Error("资料包未找到");
      if (fs.statSync(archivePath).isDirectory()) {
        return {
          archivePath,
          directory: true,
          entries: { size: this.countDirectoryFiles(archivePath) },
        };
      }
      const zipFile = await openZip(archivePath, {
        lazyEntries: true,
        autoClose: false,
        decodeStrings: false,
      });
      const entries = new Map();
      await new Promise((resolve, reject) => {
        zipFile.readEntry();
        zipFile.on("entry", (entry) => {
          const fileName = entry.fileName.toString("utf8");
          entries.set(fileName, { entry, fileName });
          zipFile.readEntry();
        });
        zipFile.once("end", resolve);
        zipFile.once("error", reject);
      });
      return { archivePath, entries, zipFile };
    })();
    return this.archivePromise;
  }

  async status() {
    const archivePath = this.sourcePath();
    if (!archivePath) return { available: false, entries: 0 };
    const { entries } = await this.load();
    return { available: true, entries: entries.size };
  }

  async materialize(requestedPath) {
    const source = await this.load();
    if (source.directory) {
      const filePath = this.directoryFile(source.archivePath, requestedPath);
      if (!filePath) throw new Error("资料文件不存在");
      return filePath;
    }
    const { entries, zipFile } = source;
    const archiveEntry = entries.get(requestedPath);
    if (!requestedPath || !archiveEntry || /\/$/.test(archiveEntry.fileName)) {
      throw new Error("资料文件不存在");
    }

    fs.mkdirSync(this.cacheDirectory, { recursive: true });
    const destination = path.join(
      this.cacheDirectory,
      safeCacheName(this.namespace, archiveEntry.fileName, archiveEntry.entry.uncompressedSize),
    );
    try {
      if (fs.statSync(destination).size === archiveEntry.entry.uncompressedSize) return destination;
    } catch {
      // Cache miss.
    }
    if (this.extractions.has(destination)) return this.extractions.get(destination);

    const extraction = (async () => {
      const temporary = `${destination}.part`;
      fs.rmSync(temporary, { force: true });
      const input = await new Promise((resolve, reject) => {
        zipFile.openReadStream(archiveEntry.entry, (error, stream) => error ? reject(error) : resolve(stream));
      });
      await pipeline(input, fs.createWriteStream(temporary));
      fs.renameSync(temporary, destination);
      return destination;
    })().finally(() => this.extractions.delete(destination));

    this.extractions.set(destination, extraction);
    return extraction;
  }
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;
  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;
  if (start == null && end != null) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else {
    start ??= 0;
    end = Math.min(end ?? size - 1, size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) return null;
  return { start, end };
}

function serveFile(request, response, filePath, downloadName = path.basename(filePath)) {
  let stat;
  try {
    stat = fs.statSync(filePath);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    response.statusCode = 404;
    response.end("File not found");
    return;
  }

  const range = parseRange(request.headers.range, stat.size);
  response.setHeader("Content-Type", contentType(downloadName));
  response.setHeader("Accept-Ranges", "bytes");
  response.setHeader("Cache-Control", "private, max-age=3600");
  response.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(path.basename(downloadName))}`);

  if (request.headers.range && !range) {
    response.statusCode = 416;
    response.setHeader("Content-Range", `bytes */${stat.size}`);
    response.end();
    return;
  }

  if (range) {
    response.statusCode = 206;
    response.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`);
    response.setHeader("Content-Length", String(range.end - range.start + 1));
  } else {
    response.statusCode = 200;
    response.setHeader("Content-Length", String(stat.size));
  }

  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = fs.createReadStream(filePath, range || undefined);
  stream.once("error", (error) => response.destroy(error));
  stream.pipe(response);
}

export async function startLocalServer({ distDirectory, resourcesDirectory, userDataDirectory, port = 0, aiOptions }) {
  const { createAiHandler } = await import("./ai-service.mjs");
  const handleAi = createAiHandler(aiOptions);
  const materialsDirectory = path.join(resourcesDirectory, "study-materials");
  const cacheDirectory = path.join(userDataDirectory, "material-cache");
  const projectDirectory = path.dirname(distDirectory);
  const archives = {
    "nine-score": new ArchiveSource({
      namespace: "nine-score",
      candidates: [
        process.env.NINE_SCORE_ZIP,
        path.join(materialsDirectory, "九分达人"),
        path.join(materialsDirectory, "9分达人.zip"),
        path.join(projectDirectory, "study-materials", "九分达人"),
        path.join(projectDirectory, "study-materials", "9分达人.zip"),
      ],
      cacheDirectory,
    }),
    "zyz-august": new ArchiveSource({
      namespace: "zyz-august",
      candidates: [
        process.env.ZYZ_AUGUST_ZIP,
        path.join(materialsDirectory, "[PDF] ZYZ 八月合集.zip"),
        path.join(projectDirectory, "study-materials", "[PDF] ZYZ 八月合集.zip"),
        path.join(projectDirectory, "work", "reading-source"),
      ],
      cacheDirectory,
    }),
  };

  const resolveApiFile = async (url) => {
    const match = /^\/api\/(nine-score|zyz-august)\/file$/.exec(url.pathname);
    if (!match) return null;
    const requestedPath = url.searchParams.get("path");
    const filePath = await archives[match[1]].materialize(requestedPath);
    return { filePath, downloadName: requestedPath };
  };

  const resolveStaticFile = (pathname) => {
    const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
    const candidate = path.resolve(distDirectory, relative);
    const root = path.resolve(distDirectory) + path.sep;
    if (candidate !== path.resolve(distDirectory) && !candidate.startsWith(root)) return null;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    return path.join(distDirectory, "index.html");
  };

  const server = http.createServer(async (request, response) => {
    try {
      if (await handleAi(request, response)) return;
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const statusMatch = /^\/api\/(nine-score|zyz-august)\/status$/.exec(url.pathname);
      if (statusMatch) {
        const status = await archives[statusMatch[1]].status();
        json(response, status.available ? 200 : 404, status);
        return;
      }
      const apiFile = await resolveApiFile(url);
      if (apiFile) {
        serveFile(request, response, apiFile.filePath, apiFile.downloadName);
        return;
      }
      const staticFile = resolveStaticFile(url.pathname);
      if (!staticFile) {
        response.statusCode = 403;
        response.end("Forbidden");
        return;
      }
      serveFile(request, response, staticFile);
    } catch (error) {
      json(response, 500, { available: false, message: error.message });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    origin,
    close: () => new Promise((resolve) => server.close(resolve)),
    async resolveLocalUrl(target) {
      const url = new URL(target, origin);
      const apiFile = await resolveApiFile(url);
      if (apiFile) return apiFile.filePath;
      return resolveStaticFile(url.pathname);
    },
  };
}

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createApiHandler } = require("./backend-api");

const ROOT_DIR = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8787);
const RAILWAY_VOLUME_PATH = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || "").trim();
const DATA_FILE = process.env.MVS_DATA_FILE
  || (RAILWAY_VOLUME_PATH ? path.join(RAILWAY_VOLUME_PATH, "app-db.json") : path.join(ROOT_DIR, "data", "app-db.json"));

const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
});

const api = createApiHandler({
  dataFile: DATA_FILE,
  startedAt: Date.now(),
});

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8"){
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(String(text || ""));
}

function serveRuntimeConfig(res){
  const body = `
window.MVS_RUNTIME_CONFIG = Object.assign(
  {},
  window.MVS_RUNTIME_CONFIG || {},
  {
    backendMode: "server",
    storageLabel: "Base no servidor",
    backupExtension: "json",
    backupFormatLabel: "Servidor JSON",
    serverBackend: true
  }
);
  `.trim();
  sendText(res, 200, body, "application/javascript; charset=utf-8");
}

function resolveStaticPath(urlPath){
  const cleanPath = decodeURIComponent(String(urlPath || "/"));
  const relativePath = cleanPath === "/" ? "/index.html" : cleanPath;
  const absolutePath = path.resolve(ROOT_DIR, `.${relativePath}`);
  const rootWithSep = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : `${ROOT_DIR}${path.sep}`;
  if (absolutePath !== ROOT_DIR && !absolutePath.startsWith(rootWithSep)) return null;
  return absolutePath;
}

function serveStatic(res, urlObj){
  const filePath = resolveStaticPath(urlObj.pathname);
  if (!filePath){
    sendText(res, 403, "Acesso negado.");
    return;
  }

  let finalPath = filePath;
  if (!fs.existsSync(finalPath) || fs.statSync(finalPath).isDirectory()){
    if (!path.extname(finalPath)){
      finalPath = path.join(ROOT_DIR, "index.html");
    } else {
      sendText(res, 404, "Arquivo não encontrado.");
      return;
    }
  }

  const ext = path.extname(finalPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const stream = fs.createReadStream(finalPath);
  stream.on("error", () => sendText(res, 500, "Falha ao ler arquivo."));
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const urlObj = new URL(req.url || "/", `http://${host}`);

  if (urlObj.pathname === "/runtime-config.js"){
    serveRuntimeConfig(res);
    return;
  }

  if (urlObj.pathname === "/health"){
    sendText(res, 200, "ok");
    return;
  }

  if (urlObj.pathname.startsWith("/api/")){
    await api.handle(req, res, urlObj);
    return;
  }

  serveStatic(res, urlObj);
});

server.listen(PORT, () => {
  console.log(`[mfas-pdv] servidor pronto em http://localhost:${PORT}`);
  console.log(`[mfas-pdv] base de dados: ${DATA_FILE}`);
});

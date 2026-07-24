const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://" + request.headers.host);
  const pathname = decodeURIComponent(url.pathname);
  const safePath = path.normalize(pathname === "/" ? "/index.html" : pathname);
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not Found" : "Server Error");
      return;
    }
    const etag = `"${crypto.createHash("sha256").update(content).digest("hex")}"`;
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304, { ETag: etag });
      response.end();
      return;
    }
    const isDocument = path.extname(filePath) === ".html" || path.extname(filePath) === ".webmanifest";
    const isVersioned = url.searchParams.has("v");
    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      ETag: etag,
      "Cache-Control": isDocument
        ? "no-cache"
        : isVersioned
          ? "public, max-age=31536000, immutable"
          : "no-cache",
    });
    response.end(content);
  });
});

server.listen(port, () => {
  console.log("AITextbook running at http://localhost:" + port);
});

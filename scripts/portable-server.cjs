#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const args = process.argv.slice(2);
const shouldOpen = !args.includes("--no-open");
const requestedDir = args.find((value) => !value.startsWith("--"));

const candidateRoots = [
  requestedDir ? path.resolve(process.cwd(), requestedDir) : null,
  path.resolve(path.dirname(process.execPath), "..", "app"),
  path.resolve(__dirname, "..", "out"),
].filter(Boolean);

const rootDir = candidateRoots.find((candidate) => fs.existsSync(candidate));

if (!rootDir) {
  console.error("Static build not found. Run `npm run build` first.");
  process.exit(1);
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const sanitizeUrlPath = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.posix.normalize(decoded);
  return normalized.startsWith("/") ? normalized.slice(1) : normalized;
};

const resolveFilePath = (urlPath) => {
  const safePath = sanitizeUrlPath(urlPath);
  const directPath = path.join(rootDir, safePath);

  const candidates = [
    directPath,
    `${directPath}.html`,
    path.join(directPath, "index.html"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  const fallback = path.join(rootDir, "index.html");
  return fs.existsSync(fallback) ? fallback : null;
};

const openBrowser = (url) => {
  const options = { detached: true, stdio: "ignore" };

  if (process.platform === "darwin") {
    spawn("open", [url], options).unref();
    return;
  }

  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], options).unref();
    return;
  }

  spawn("xdg-open", [url], options).unref();
};

const server = http.createServer((request, response) => {
  const filePath = resolveFilePath(request.url || "/");

  if (!filePath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal server error");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
    response.end(content);
  });
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();

  if (!address || typeof address === "string") {
    console.error("Failed to resolve server address.");
    process.exit(1);
  }

  const url = `http://127.0.0.1:${address.port}`;
  console.log(`Roadmap Impact Calculator is available at ${url}`);
  console.log(`Serving static files from ${rootDir}`);

  if (shouldOpen) {
    openBrowser(url);
  }
});

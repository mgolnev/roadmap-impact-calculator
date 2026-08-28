#!/usr/bin/env node

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "..", "out");

function loadLocalEnv() {
  for (const filename of [".env", ".env.local"]) {
    const envPath = path.resolve(currentDir, "..", filename);
    if (!existsSync(envPath)) continue;

    for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator <= 0) continue;
      const key = line.slice(0, separator).replace(/^export\s+/, "").trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
      let value = line.slice(separator + 1).trim();
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const {
  DatabaseNotConfiguredError,
  getRoadmapState,
  isDatabaseConfigured,
  saveRoadmapIdeas,
  saveRoadmapState,
} = await import("./lib/roadmap-db.mjs");

const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";
const maxRequestBytes = 10 * 1024 * 1024;

if (!existsSync(rootDir)) {
  console.error("Static build not found. Run `npm run build` first.");
  process.exit(1);
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
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

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function resolveStaticFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  if (decoded.split("/").includes("..")) return null;

  const normalized = path.posix.normalize(decoded).replace(/^\/+/, "");
  if (normalized === ".." || normalized.startsWith("../")) return null;

  const directPath = path.resolve(rootDir, normalized);
  if (directPath !== rootDir && !directPath.startsWith(`${rootDir}${path.sep}`)) return null;

  const candidates = [
    directPath,
    `${directPath}.html`,
    path.join(directPath, "index.html"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  const fallback = path.join(rootDir, "index.html");
  return existsSync(fallback) ? fallback : null;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function handleRoadmapApi(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, { row: await getRoadmapState() });
    return;
  }

  if (request.method === "PUT") {
    const body = await readJsonBody(request);
    if (!isObject(body?.payload)) {
      sendJson(response, 400, { error: "payload must be a JSON object" });
      return;
    }
    sendJson(response, 200, { row: await saveRoadmapState(body.payload) });
    return;
  }

  if (request.method === "PATCH") {
    const body = await readJsonBody(request);
    if (!Array.isArray(body?.ideas) || !isObject(body?.fallbackPayload)) {
      sendJson(response, 400, {
        error: "ideas must be an array and fallbackPayload must be a JSON object",
      });
      return;
    }
    sendJson(response, 200, {
      row: await saveRoadmapIdeas(body.ideas, body.fallbackPayload),
    });
    return;
  }

  response.writeHead(405, { Allow: "GET, PUT, PATCH" });
  response.end();
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  try {
    if (requestUrl.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, databaseConfigured: isDatabaseConfigured() });
      return;
    }

    if (requestUrl.pathname === "/api/roadmap") {
      await handleRoadmapApi(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    const rawPath = (request.url || "/").split("?", 1)[0];
    const filePath = resolveStaticFile(rawPath);
    if (!filePath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      sendJson(response, 503, { error: error.message });
      return;
    }

    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) console.error("[server] request failed", error);
    sendJson(response, statusCode, {
      error: statusCode >= 500 ? "Database request failed" : error.message,
    });
  }
});

server.listen(port, host, () => {
  console.log(`Roadmap Impact Calculator is available at http://${host}:${port}`);
  console.log(`Serving static files from ${rootDir}`);
  console.log(
    isDatabaseConfigured()
      ? "PostgreSQL configuration detected"
      : "PostgreSQL is not configured; shared roadmap API will return HTTP 503",
  );
});

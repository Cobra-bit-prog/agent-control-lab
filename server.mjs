import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./lib/policy.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const BILLING = {
  "/api/v1/billing/checkout": () => import("./api/v1/billing/checkout.js"),
  "/api/v1/billing/config": () => import("./api/v1/billing/config.js"),
  "/api/v1/billing/invoice": () => import("./api/v1/billing/invoice.js"),
  "/api/v1/billing/watch": () => import("./api/v1/billing/watch.js"),
  "/api/v1/billing/helius": () => import("./api/v1/billing/helius.js"),
  "/api/v1/billing/helius-setup": () => import("./api/v1/billing/helius-setup.js"),
  "/api/v1/storefront/pricing": () => import("./api/v1/storefront/pricing.js"),
};

function send(res, status, body, headers = {}) {
  const payload = Buffer.from(body);
  res.writeHead(status, {
    "Content-Length": payload.length,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    ...headers,
  });
  res.end(payload);
}

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  let rel = decoded.replace(/\\/g, "/");
  if (rel === "/") rel = "/index.html";
  if (rel === "/docs" || rel === "/docs/") rel = "/docs/index.html";
  if (rel === "/app" || rel === "/app/") rel = "/app/index.html";
  if (rel.endsWith("/") && rel !== "/") rel += "index.html";
  const abs = path.normalize(path.join(root, rel));
  if (!abs.startsWith(root)) return null;
  return abs;
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function queryOf(url) {
  const u = new URL(url, "http://lab.local");
  const q = {};
  for (const [k, v] of u.searchParams) q[k] = v;
  return q;
}

async function runVercel(modLoader, req, res, rawBody) {
  const mod = await modLoader();
  let parsed = {};
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = rawBody;
    }
  }
  const fakeReq = {
    method: req.method,
    headers: req.headers,
    body: parsed,
    query: queryOf(req.url || "/"),
    url: req.url,
  };
  let sent = false;
  const fakeRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(obj) {
      if (sent) return;
      sent = true;
      send(res, this.statusCode, JSON.stringify(obj), {
        ...this.headers,
        "Content-Type": "application/json; charset=utf-8",
      });
    },
    end(data) {
      if (sent) return;
      sent = true;
      send(res, this.statusCode, data || "", this.headers);
    },
  };
  await mod.default(fakeReq, fakeRes);
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";
  const pathname = new URL(url, "http://lab.local").pathname.replace(/\/+$/, "") || "/";

  if (url.startsWith("/api/")) {
    const body = await readBody(req);
    const billing = BILLING[pathname];
    if (billing) {
      await runVercel(billing, req, res, body);
      return;
    }
    const result = handleRequest({
      method: req.method,
      url,
      headers: req.headers,
      body,
    });
    if (result.status === 204) {
      send(res, 204, "", { "Content-Type": "text/plain" });
      return;
    }
    send(res, result.status, JSON.stringify(result.body), {
      "Content-Type": "application/json; charset=utf-8",
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method not allowed");
    return;
  }

  const file = safeFile(url);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }
  const ext = path.extname(file);
  const data = fs.readFileSync(file);
  send(res, 200, data, { "Content-Type": types[ext] || "application/octet-stream" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Agent Control lab http://127.0.0.1:${port}`);
});

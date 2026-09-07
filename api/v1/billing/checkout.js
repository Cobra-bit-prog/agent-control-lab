import { checkoutUsage, parsePlan, parseEmail, viewInvoice } from "../../../js/pay-core.js";
import { CORS } from "../../_lib/http.js";
import { checkoutConfigured, createInvoice } from "../../_lib/store.js";

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method === "GET") {
    res.status(200).json(checkoutUsage());
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use GET or POST." });
    return;
  }

  const apiKey = readNodeKey(req);
  if (!apiKey) {
    res.status(401).json({ error: "Missing API key." });
    return;
  }
  if (!checkoutConfigured()) {
    res.status(503).json({ error: "Checkout is not configured for Solana." });
    return;
  }

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const asset = String(body.asset || "usdc").toLowerCase();
  const chain = String(body.chain || "solana").toLowerCase();
  if (asset !== "usdc" || chain !== "solana") {
    res.status(400).json({
      error: "Human and agent checkout default is USDC on Solana. SOL/ETH are under Other.",
    });
    return;
  }

  try {
    const row = createInvoice({
      plan: parsePlan(body.plan),
      email: parseEmail(body.human_email || body.email),
      source: "agent",
    });
    const origin = originFromNode(req);
    res.status(200).json({
      ...viewInvoice(row, origin),
      agent_ok: true,
      human_pays: true,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Could not start checkout." });
  }
}

function applyCors(res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
}

function readNodeKey(req) {
  const header = req.headers.authorization || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return String(req.headers["x-api-key"] || "").trim();
}

function originFromNode(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

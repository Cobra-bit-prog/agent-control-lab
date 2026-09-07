import { parsePlan, parseEmail, viewInvoice, PLANS } from "../../../js/pay-core.js";
import { CORS } from "../../_lib/http.js";
import { checkoutConfigured, createInvoice, getInvoice, payoutAddress } from "../../_lib/store.js";
import { findMatchingUsdcPayment } from "../../_lib/rpc.js";
import { markPaid } from "../../_lib/store.js";

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const origin = originFromNode(req);

  if (req.method === "POST") {
    if (!checkoutConfigured()) {
      res.status(503).json({ error: "Checkout is not configured for Solana." });
      return;
    }
    const body = typeof req.body === "object" && req.body ? req.body : {};
    const email = parseEmail(body.email || body.human_email);
    try {
      const row = createInvoice({
        plan: parsePlan(body.plan),
        email,
        source: "human",
      });
      res.status(200).json(viewInvoice(row, origin));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || "Could not create invoice." });
    }
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Use GET or POST." });
    return;
  }

  const id = String(req.query?.id || req.query?.reference || "").trim();
  const row = getInvoice(id);
  if (!row) {
    res.status(404).json({ error: "Invoice not found." });
    return;
  }
  if (row.status !== "paid") {
    try {
      const match = await findMatchingUsdcPayment({
        reference: row.reference,
        recipient: payoutAddress(),
        amountUsdc: PLANS[row.plan].price,
      });
      if (match.kind === "paid") markPaid(row, match);
    } catch {
      /* keep pending; client may still poll RPC */
    }
  }
  res.status(200).json(viewInvoice(row, origin));
}

function originFromNode(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

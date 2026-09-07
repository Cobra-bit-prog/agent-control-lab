import { PLANS, parsePlan } from "../../../js/pay-core.js";
import { CORS } from "../../_lib/http.js";
import { findMatchingUsdcPayment } from "../../_lib/rpc.js";
import { getInvoice, markPaid, payoutAddress } from "../../_lib/store.js";

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Use GET or POST." });
    return;
  }

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const q = req.query || {};
  const reference = String(q.reference || body.reference || "").trim();
  const planId = parsePlan(q.plan || body.plan);
  const amountUsdc = Number(q.amount || body.amount || PLANS[planId].price);
  const id = String(q.id || body.id || "").trim();
  const row = id ? getInvoice(id) : getInvoice(reference);

  const target = {
    reference: row?.reference || reference,
    recipient: payoutAddress(),
    amountUsdc: row ? PLANS[parsePlan(row.plan)].price : amountUsdc,
  };
  if (!target.reference || !target.recipient) {
    res.status(400).json({ error: "Need reference and recipient." });
    return;
  }

  try {
    const match = await findMatchingUsdcPayment(target);
    if (row && match.kind === "paid") markPaid(row, match);
    res.status(200).json({
      id: row?.id || null,
      reference: target.reference,
      status: match.kind === "paid" ? "paid" : match.kind === "underpaid" ? "underpaid" : "pending",
      signature: match.signature || row?.signature || null,
      amount_usdc: target.amountUsdc,
      match: "solana-pay-reference",
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "Could not check payment." });
  }
}

import { paymentsFromHeliusPayload, PLANS, parsePlan } from "../../../js/pay-core.js";
import { CORS } from "../../_lib/http.js";
import { findByReference, listInvoices, markPaid, payoutAddress } from "../../_lib/store.js";

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Helius webhook is POST only." });
    return;
  }

  const secret = process.env.HELIUS_WEBHOOK_SECRET?.trim();
  if (secret) {
    const got =
      req.headers.authorization ||
      req.headers["x-helius-secret"] ||
      req.headers["authorization"] ||
      "";
    if (!String(got).includes(secret)) {
      res.status(401).json({ error: "Unauthorized webhook." });
      return;
    }
  }

  const recipient = payoutAddress();
  const payments = paymentsFromHeliusPayload(req.body, recipient);
  const paid = [];
  for (const pay of payments) {
    for (const key of pay.references) {
      const row = findByReference(key);
      if (!row) continue;
      const need = PLANS[parsePlan(row.plan)].price;
      if (pay.amountUsdc + 1e-9 >= need) {
        markPaid(row, { signature: pay.signature, amountUsdc: pay.amountUsdc });
        paid.push({ id: row.id, signature: pay.signature });
      }
    }
    if (!pay.references.length) {
      for (const row of listInvoices()) {
        if (row.status === "paid") continue;
        const need = PLANS[parsePlan(row.plan)].price;
        if (pay.amountUsdc + 1e-9 >= need && row.recipient === recipient) {
          /* Do not match by amount alone — skip unless reference is present. */
        }
      }
    }
  }

  res.status(200).json({ ok: true, matched: paid.length, paid });
}

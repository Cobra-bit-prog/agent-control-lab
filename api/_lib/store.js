import { parsePlan, PLANS, newPayReference, PAY_EXPIRY_MS, SOLANA_PAYOUT_ADDRESS } from "../../js/pay-core.js";

const mem = new Map();

/** Human USDC always lands on the production Phantom receive pubkey. */
export function payoutAddress() {
  const fromEnv = process.env.SOLANA_PAYOUT_ADDRESS?.trim();
  if (fromEnv && fromEnv !== SOLANA_PAYOUT_ADDRESS) {
    console.error(
      "[billing] SOLANA_PAYOUT_ADDRESS must be",
      SOLANA_PAYOUT_ADDRESS,
      "— ignoring override",
    );
  }
  return SOLANA_PAYOUT_ADDRESS;
}

export function checkoutConfigured() {
  return Boolean(payoutAddress());
}

function uid() {
  return `inv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function createInvoice(opts) {
  const recipient = payoutAddress();
  const planId = parsePlan(opts.plan);
  const plan = PLANS[planId];
  const now = Date.now();
  const row = {
    id: uid(),
    plan: plan.id,
    email: opts.email || null,
    source: opts.source || "human",
    amount_usdc: plan.price,
    recipient,
    reference: newPayReference(),
    status: "pending",
    signature: null,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + PAY_EXPIRY_MS).toISOString(),
    paid_at: null,
  };
  mem.set(row.id, row);
  mem.set(`ref:${row.reference}`, row);
  return row;
}

export function getInvoice(id) {
  if (!id) return null;
  return mem.get(id) || mem.get(`ref:${id}`) || null;
}

export function listInvoices() {
  return [...mem.values()].filter((row, i, all) => all.findIndex((r) => r.id === row.id) === i);
}

export function markPaid(row, match) {
  row.status = "paid";
  row.signature = match.signature;
  row.paid_at = new Date().toISOString();
  row.paid_amount_usdc = match.amountUsdc;
  mem.set(row.id, row);
  mem.set(`ref:${row.reference}`, row);
  return row;
}

export function findByReference(reference) {
  if (!reference) return null;
  return mem.get(`ref:${reference}`) || null;
}

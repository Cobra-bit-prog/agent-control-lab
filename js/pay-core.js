/** Solana Pay + Helius matching. Exact plan amount. Unique reference, never unique dust. */

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;
export const TRIAL_MS = 24 * 60 * 60 * 1000;
export const TRIAL_REMIND_MS = 20 * 60 * 60 * 1000;
export const PAY_EXPIRY_MS = 30 * 60 * 1000;

export const PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 29,
    agents: 5,
    historyDays: 30,
    blurb: "For operators running a small agent fleet.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 49,
    agents: 15,
    historyDays: 90,
    blurb: "Priority alerts and deeper history.",
  },
  team: {
    id: "team",
    name: "Team",
    price: 149,
    agents: 50,
    historyDays: 365,
    blurb: "Multiple seats and higher limits.",
  },
};

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parsePlan(value) {
  const id = String(value || "starter").toLowerCase();
  return PLANS[id] ? id : "starter";
}

export function parseEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return null;
  return email;
}

export function usdcBaseUnits(price) {
  return String(BigInt(price) * 10n ** BigInt(USDC_DECIMALS));
}

export function encodeBase58(bytes) {
  if (bytes.length === 0) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      const x = digits[j] * 256 + carry;
      digits[j] = x % 58;
      carry = (x / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  return "1".repeat(zeros) + digits.reverse().map((d) => B58[d]).join("");
}

export function newPayReference(randomBytes = defaultRandomBytes) {
  const bytes = randomBytes(32);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) {
    throw new Error("Reference needs 32 random bytes.");
  }
  return encodeBase58(bytes);
}

function defaultRandomBytes(n) {
  const bytes = new Uint8Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return bytes;
  }
  throw new Error("No CSPRNG available.");
}

export function buildSolanaPayUrl(opts) {
  const amount = Number(opts.amountUsdc);
  const q = new URLSearchParams({
    amount: String(amount),
    "spl-token": USDC_MINT,
    reference: opts.reference,
    label: "Agent Control",
    message: `Pay $${amount}`,
  });
  return `solana:${opts.recipient}?${q.toString()}`;
}

export function phantomBrowseUrl(solanaUrl, refUrl) {
  const ref = refUrl || "https://cobra-bit-prog.github.io/agent-control-lab/";
  return `https://phantom.app/ul/browse/${encodeURIComponent(solanaUrl)}?ref=${encodeURIComponent(ref)}`;
}

export function copyFor(price) {
  const n = Number(price);
  return {
    title: `Pay $${n}. Console stays on.`,
    body: `Send $${n} USDC on Solana. We unlock when it lands.`,
    cta: `Pay $${n}`,
    waiting: `Waiting for $${n} USDC on Solana.`,
    done: "Paid. Console is open.",
    warn: "Use a wallet. Do not send from Coinbase or Binance.",
    trialMail: "Your day is almost up. Pay $29 USDC on Solana to keep the console.",
  };
}

export function isForbiddenCustomerWord(text) {
  const banned = [
    /\bwatcher\b/i,
    /unique amount/i,
    /\bmemo\b/i,
    /\bwired\b/i,
    /\bmagnet\b/i,
    /package scanner/i,
    /\bbroadcast\b/i,
  ];
  return banned.some((re) => re.test(String(text || "")));
}

/** Token delta to recipient for USDC. Used to confirm the plan amount — not a special dust amount. */
export function usdcDeltaToOwner(tx, owner) {
  const sum = (rows) =>
    (rows ?? []).reduce((acc, row) => {
      if (row.mint !== USDC_MINT) return acc;
      if (row.owner && row.owner !== owner) return acc;
      const amt = row.uiTokenAmount?.amount;
      if (!amt) return acc;
      try {
        return acc + BigInt(amt);
      } catch {
        return acc;
      }
    }, 0n);
  return sum(tx?.meta?.postTokenBalances) - sum(tx?.meta?.preTokenBalances);
}

export function matchUsdcByReference(opts) {
  const expected = BigInt(usdcBaseUnits(opts.amountUsdc));
  const signatures = opts.signatures || [];
  let bestUnder = { kind: "none" };
  for (const item of signatures) {
    if (item.err) continue;
    const tx = item.tx;
    if (!tx || tx.meta?.err) continue;
    const delta = usdcDeltaToOwner(tx, opts.recipient);
    if (delta <= 0n) continue;
    const amountUsdc = Number(delta) / 1e6;
    if (delta >= expected) {
      return { kind: "paid", signature: item.signature, amountUsdc };
    }
    bestUnder = { kind: "underpaid", signature: item.signature, amountUsdc };
  }
  return bestUnder;
}

/** Helius enhanced + raw webhook → candidate payments keyed by reference accounts. */
export function paymentsFromHeliusPayload(body, recipient) {
  const events = normalizeHeliusEvents(body);
  const out = [];
  for (const ev of events) {
    const signature = ev.signature || ev.transactionSignature || "";
    const references = collectAccountKeys(ev);
    const amountUsdc = usdcAmountToRecipient(ev, recipient);
    if (!signature || amountUsdc <= 0) continue;
    out.push({ signature, amountUsdc, references, raw: ev });
  }
  return out;
}

function normalizeHeliusEvents(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.events)) return body.events;
  if (body && typeof body === "object") return [body];
  return [];
}

function collectAccountKeys(ev) {
  const keys = new Set();
  for (const row of ev.accountData || []) {
    if (row?.account) keys.add(row.account);
  }
  const msgKeys =
    ev.transaction?.transaction?.message?.accountKeys ||
    ev.transaction?.message?.accountKeys ||
    [];
  for (const k of msgKeys) {
    if (typeof k === "string") keys.add(k);
    else if (k?.pubkey) keys.add(k.pubkey);
  }
  return [...keys];
}

function usdcAmountToRecipient(ev, recipient) {
  let total = 0;
  for (const t of ev.tokenTransfers || []) {
    const mint = t.mint || t.tokenAddress;
    const to = t.toUserAccount || t.to;
    if (mint !== USDC_MINT) continue;
    if (recipient && to && to !== recipient) continue;
    const amt = Number(t.tokenAmount ?? t.amount ?? 0);
    if (Number.isFinite(amt) && amt > 0) total += amt;
  }
  if (total > 0) return total;
  const delta = usdcDeltaToOwner(
    { meta: { preTokenBalances: ev.meta?.preTokenBalances, postTokenBalances: ev.meta?.postTokenBalances } },
    recipient,
  );
  return Number(delta) / 1e6;
}

export function checkoutUsage() {
  return {
    usage: "POST /api/v1/billing/checkout with Authorization: Bearer <agent api key>",
    body: { plan: "starter", asset: "usdc", chain: "solana", human_email: "ops@example.com" },
    note: "Opens a pay request for the human principal. The human pays at pay_url. Not automatic payment. Not the human front door — humans use /pay.html.",
    wraps: "POST /api/v1/billing/checkout — agent key → pay request for that human",
  };
}

export function publicPricing() {
  return {
    product: "Agent Control",
    tagline: "External audit for your agents",
    trial: {
      days: 1,
      hours: 24,
      card: false,
      kyc: false,
      plan: "free",
      note: "1-day full console trial, no card, no KYC. Then Starter $29 / Pro $49 / Team $149.",
    },
    plans: Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      price_usd: p.price,
      agents: p.agents,
      history_days: p.historyDays,
      blurb: p.blurb,
    })),
    pay: {
      method: "solana-pay",
      asset: "USDC",
      chain: "solana",
      also: ["SOL", "ETH"],
      match: "solana-pay-reference",
      no_card: true,
      no_unique_amount: true,
      note: "Send $29 USDC on Solana. Scan or tap Pay. We unlock when it lands.",
    },
    storefront: {
      pricing: "GET /api/v1/storefront/pricing",
      checkout: "POST /api/v1/billing/checkout",
      invoice: "GET /api/v1/billing/invoice",
      helius: "POST /api/v1/billing/helius",
    },
  };
}

export function viewInvoice(row, origin) {
  const plan = PLANS[parsePlan(row.plan)];
  const copy = copyFor(plan.price);
  const payUrl = buildSolanaPayUrl({
    recipient: row.recipient,
    amountUsdc: plan.price,
    reference: row.reference,
  });
  const base = String(origin || "").replace(/\/$/, "");
  return {
    id: row.id,
    plan: plan.id,
    asset: "usdc",
    chain: "solana",
    amount_usdc: plan.price,
    amount_base_units: usdcBaseUnits(plan.price),
    exact_amount: String(plan.price),
    recipient: row.recipient,
    reference: row.reference,
    email: row.email || null,
    status: row.status,
    signature: row.signature || null,
    pay_url: payUrl,
    phantom_url: phantomBrowseUrl(payUrl, base ? `${base}/pay.html` : undefined),
    human_url: `${base}/pay.html?id=${encodeURIComponent(row.id)}`,
    copy,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

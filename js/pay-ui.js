import {
  PLANS,
  parsePlan,
  parseEmail,
  copyFor,
  newPayReference,
  buildSolanaPayUrl,
  phantomBrowseUrl,
  matchUsdcByReference,
  usdcBaseUnits,
  viewInvoice,
} from "./pay-core.js";
import { DEFAULT_RECIPIENT, RPC_URLS } from "./pay-config.js";
import { markPaid } from "./trial.js";

const STORE_KEY = "ac_invoices_v1";
const PAYOUT_KEY = "ac_payout";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function apiRoot() {
  return new URL("../api/v1/", import.meta.url).href.replace(/\/?$/, "/");
}

export function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveInvoice(row) {
  const all = loadStore();
  all[row.id] = row;
  if (row.reference) all[`ref:${row.reference}`] = row.id;
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
  return row;
}

export function readInvoice(id) {
  const all = loadStore();
  const row = all[id];
  if (row && typeof row === "object" && row.id) return row;
  const mapped = all[id] || all[`ref:${id}`];
  if (typeof mapped === "string") return all[mapped] || null;
  return null;
}

export async function fetchConfig() {
  const local = (typeof localStorage !== "undefined" && localStorage.getItem(PAYOUT_KEY)) || "";
  try {
    const res = await fetch(`${apiRoot()}billing/config`);
    if (res.ok) {
      const data = await res.json();
      return {
        recipient: data.recipient || local || DEFAULT_RECIPIENT,
        configured: Boolean(data.recipient || local || DEFAULT_RECIPIENT),
        helius: Boolean(data.helius),
      };
    }
  } catch {
    /* GH Pages has no API — use local config */
  }
  const recipient = local || DEFAULT_RECIPIENT;
  return { recipient, configured: Boolean(recipient), helius: false };
}

export function makeLocalInvoice({ plan, email, recipient, source }) {
  const planId = parsePlan(plan);
  const now = Date.now();
  const row = {
    id: `inv_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    plan: planId,
    email: parseEmail(email),
    source: source || "human",
    amount_usdc: PLANS[planId].price,
    amount_base_units: usdcBaseUnits(PLANS[planId].price),
    recipient,
    reference: newPayReference(),
    status: "pending",
    signature: null,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + 30 * 60 * 1000).toISOString(),
  };
  return saveInvoice(row);
}

export async function createInvoice({ plan, email, source }) {
  const cfg = await fetchConfig();
  try {
    const res = await fetch(`${apiRoot()}billing/invoice`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, email, human_email: email }),
    });
    if (res.ok) {
      const view = await res.json();
      const row = {
        id: view.id,
        plan: view.plan,
        email: view.email,
        source: source || "human",
        amount_usdc: view.amount_usdc,
        recipient: view.recipient,
        reference: view.reference,
        status: view.status,
        signature: view.signature,
        created_at: view.created_at,
        expires_at: view.expires_at,
      };
      return saveInvoice(row);
    }
  } catch {
    /* fall through to local invoice */
  }
  return makeLocalInvoice({
    plan,
    email,
    recipient: cfg.recipient || "",
    source,
  });
}

async function rpc(method, params) {
  let last = new Error("RPC error");
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const parsed = await res.json();
      if (parsed.error) throw new Error(parsed.error.message || "RPC error");
      return parsed.result;
    } catch (err) {
      last = err instanceof Error ? err : new Error("RPC error");
    }
  }
  throw last;
}

export async function watchInvoice(row) {
  if (!row || row.status === "paid") return row;
  try {
    const res = await fetch(
      `${apiRoot()}billing/watch?id=${encodeURIComponent(row.id)}&reference=${encodeURIComponent(row.reference)}&recipient=${encodeURIComponent(row.recipient)}&plan=${encodeURIComponent(row.plan)}`,
    );
    if (res.ok) {
      const data = await res.json();
        if (data.status === "paid") {
        row.status = "paid";
        row.signature = data.signature;
        markPaid();
        return saveInvoice(row);
      }
    }
  } catch {
    /* client RPC below */
  }
  try {
    const sigs = await rpc("getSignaturesForAddress", [row.reference, { limit: 8 }]);
    if (!Array.isArray(sigs) || !sigs.length) return row;
    const packed = [];
    for (const s of sigs.slice(0, 6)) {
      if (s.err) continue;
      const tx = await rpc("getTransaction", [
        s.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      packed.push({ signature: s.signature, err: s.err, tx });
    }
    const match = matchUsdcByReference({
      recipient: row.recipient,
      amountUsdc: PLANS[parsePlan(row.plan)].price,
      signatures: packed,
    });
    if (match.kind === "paid") {
      row.status = "paid";
      row.signature = match.signature;
      markPaid();
      return saveInvoice(row);
    }
  } catch {
    /* stay pending */
  }
  return row;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortAddr(addr) {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function drawQr(el, value) {
  el.innerHTML = "";
  if (!value) {
    el.textContent = "Payment QR is missing.";
    return;
  }
  if (typeof qrcode !== "function") {
    const img = document.createElement("img");
    img.width = 220;
    img.height = 220;
    img.alt = "Pay QR";
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(value)}`;
    el.appendChild(img);
    return;
  }
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  const svg = el.querySelector("svg");
  if (svg) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Pay QR");
    svg.classList.add("pay-qr");
  }
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    window.prompt("Copy this", value);
    return false;
  }
}

export function renderPayBlock(root, row, opts = {}) {
  const plan = PLANS[parsePlan(row.plan)];
  const copy = copyFor(plan.price);
  const origin = opts.origin || window.location.origin + window.location.pathname.replace(/[^/]+$/, "");
  const view = viewInvoice(row, origin.replace(/\/$/, ""));
  const paid = row.status === "paid";
  const configured = Boolean(row.recipient);

  root.innerHTML = `
    <div class="pay-card rounded-[20px] border border-border bg-surface p-6 shadow-[0_16px_40px_-20px_rgb(18_38_63/0.18)]">
      <p class="text-xs font-semibold uppercase tracking-[0.16em] text-navy">${esc(plan.name)}</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">${esc(paid ? copy.done : copy.title)}</h1>
      <p class="mt-2 text-muted">${esc(paid ? "The console stays on for 30 days. No auto-renewal." : copy.body)}</p>
      ${
        paid
          ? `<p class="mt-4 rounded-[14px] bg-[#dcfce7] px-3.5 py-3 text-sm font-medium text-[#166534]">${esc(copy.done)}</p>
             <a class="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg" href="app.html">Open console</a>`
          : `
      <dl class="mt-5 grid gap-3 sm:grid-cols-2">
        <div class="rounded-[14px] border border-border bg-elevated px-3.5 py-3">
          <dt class="text-xs text-muted">Amount</dt>
          <dd class="mt-0.5 text-lg font-semibold tabular-nums">$${plan.price} USDC</dd>
        </div>
        <div class="rounded-[14px] border border-border bg-elevated px-3.5 py-3">
          <dt class="text-xs text-muted">Network</dt>
          <dd class="mt-0.5 text-lg font-semibold">Solana</dd>
        </div>
      </dl>
      <div class="mt-5 flex justify-center">
        <div data-qr class="aspect-square w-full max-w-[220px] rounded-[16px] border border-border bg-white p-2"></div>
      </div>
      <div class="mt-4 rounded-[14px] border border-border bg-elevated px-3.5 py-3">
        <p class="text-xs text-muted">Address</p>
        <p class="mt-1 break-all font-mono text-xs leading-relaxed">${esc(row.recipient || "Checkout is not configured.")}</p>
        <button type="button" data-copy class="mt-2 text-sm font-semibold text-navy">Copy address</button>
      </div>
      <a data-pay class="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg ${configured ? "" : "pointer-events-none opacity-50"}" href="${configured ? esc(view.phantom_url) : "#"}">${esc(copy.cta)}</a>
      <p data-status class="mt-4 text-center text-sm font-medium text-navy">${esc(copy.waiting)}</p>
      <p class="mt-3 text-center text-xs text-muted">${esc(copy.warn)}</p>
      <details class="mt-5 rounded-[14px] border border-border bg-elevated px-3.5 py-3">
        <summary class="cursor-pointer text-sm font-medium text-navy">Other</summary>
        <p class="mt-2 text-sm text-muted">SOL and ETH sit under Other. Default is $${plan.price} USDC on Solana. Scan or tap Pay. We unlock when it lands.</p>
      </details>`
      }
    </div>
  `;

  if (!paid) {
    const qrBox = root.querySelector("[data-qr]");
    if (qrBox) drawQr(qrBox, view.pay_url);
    const copyBtn = root.querySelector("[data-copy]");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const ok = await copyText(row.recipient);
        copyBtn.textContent = ok ? "Copied" : "Copy address";
        setTimeout(() => {
          copyBtn.textContent = "Copy address";
        }, 1600);
      });
    }
  }
}

export async function mountPayScreen(root, options = {}) {
  const params = new URLSearchParams(window.location.search);
  const plan = parsePlan(options.plan || params.get("plan"));
  let email = parseEmail(options.email || params.get("email") || localStorage.getItem("ac_email"));
  let row = null;
  const id = options.id || params.get("id") || params.get("reference");
  if (id) row = readInvoice(id);
  if (!row && id) {
    try {
      const res = await fetch(`${apiRoot()}billing/invoice?id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const view = await res.json();
        row = saveInvoice({
          id: view.id,
          plan: view.plan,
          email: view.email,
          amount_usdc: view.amount_usdc,
          recipient: view.recipient,
          reference: view.reference,
          status: view.status,
          signature: view.signature,
          created_at: view.created_at,
          expires_at: view.expires_at,
        });
      }
    } catch {
      /* local only */
    }
  }
  if (!row) {
    row = await createInvoice({ plan, email, source: options.source || "human" });
    const url = new URL(window.location.href);
    url.searchParams.set("plan", row.plan);
    url.searchParams.set("id", row.id);
    history.replaceState({}, "", url);
  }

  const wrap = document.createElement("div");
  root.appendChild(wrap);

  const emailBox = document.createElement("form");
  emailBox.className = "mb-5";
  emailBox.innerHTML = `
    <label class="block text-sm font-medium text-navy">Email</label>
    <div class="mt-2 flex flex-col gap-2 sm:flex-row">
      <input name="email" type="email" required value="${email ? esc(email) : ""}" placeholder="you@company.com" class="h-11 flex-1 rounded-full border border-border bg-white px-4 text-sm text-fg outline-none" />
      <button type="submit" class="inline-flex h-11 items-center justify-center rounded-full border border-border bg-white px-5 text-sm font-semibold text-navy">Save</button>
    </div>
    <p class="mt-1 text-xs text-muted">Email only. No card. No KYC. Guest invoice is enough.</p>
  `;
  emailBox.addEventListener("submit", (e) => {
    e.preventDefault();
    const next = parseEmail(emailBox.email.value);
    if (!next) return;
    email = next;
    localStorage.setItem("ac_email", next);
    row.email = next;
    saveInvoice(row);
    const btn = emailBox.querySelector("button");
    btn.textContent = "Saved";
    setTimeout(() => {
      btn.textContent = "Save";
    }, 1200);
  });
  root.insertBefore(emailBox, wrap);

  const paint = async () => {
    row = (await watchInvoice(row)) || row;
    renderPayBlock(wrap, row);
    return row;
  };
  await paint();
  const timer = setInterval(paint, 4000);
  return () => clearInterval(timer);
}

void USDC_MINT;

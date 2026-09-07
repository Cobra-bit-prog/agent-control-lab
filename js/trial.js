import { TRIAL_MS, TRIAL_REMIND_MS, copyFor } from "./pay-core.js";

const KEY = "ac_trial_v1";

export function trialState(now = Date.now()) {
  let row;
  try {
    row = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    row = null;
  }
  const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
  if (params.get("t") === "24h" || params.get("lock") === "1") {
    row = row || { email: localStorage.getItem("ac_email"), startedAt: now - TRIAL_MS };
  } else if (params.get("t") === "20h") {
    row = row || { email: localStorage.getItem("ac_email"), startedAt: now - TRIAL_REMIND_MS };
  }
  if (!row || !row.startedAt) {
    return { phase: "none", email: null, startedAt: null, remainingMs: TRIAL_MS, mailDue: false };
  }
  const elapsed = now - Number(row.startedAt);
  const remainingMs = Math.max(0, TRIAL_MS - elapsed);
  const paid = localStorage.getItem("ac_plan_paid") === "1";
  if (paid) {
    return { phase: "paid", email: row.email, startedAt: row.startedAt, remainingMs: 0, mailDue: false };
  }
  if (elapsed >= TRIAL_MS) {
    return { phase: "lock", email: row.email, startedAt: row.startedAt, remainingMs: 0, mailDue: true };
  }
  return {
    phase: "open",
    email: row.email,
    startedAt: row.startedAt,
    remainingMs,
    mailDue: elapsed >= TRIAL_REMIND_MS,
  };
}

export function startTrial(email) {
  const row = { email: email || localStorage.getItem("ac_email"), startedAt: Date.now(), confirmedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(row));
  if (email) localStorage.setItem("ac_email", email);
  return row;
}

export function markPaid() {
  localStorage.setItem("ac_plan_paid", "1");
}

export function trialMailCopy() {
  return copyFor(29).trialMail;
}

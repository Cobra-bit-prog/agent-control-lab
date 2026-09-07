import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSandbox,
  handleRequest,
  KNOWN_PAYEE,
  LAB_KEY,
  LAB_AGENT,
  OPEN_KEY,
  OPEN_AGENT,
} from "../lib/policy.js";

const NEW_PAYEE = "NewPayee222222222222222222222222222";

function call(box, method, url, { key = LAB_KEY, body, now } = {}) {
  return handleRequest(
    {
      method,
      url,
      headers: key ? { authorization: `Bearer ${key}` } : {},
      body,
      now,
    },
    box,
  );
}

test("GET /api/v1/check documents the same check", () => {
  const box = createSandbox();
  const r = call(box, "GET", "/api/v1/check", { key: "" });
  assert.equal(r.status, 200);
  assert.match(r.body.usage, /POST \/api\/v1\/check/);
  assert.match(r.body.note, /check_transfer/);
});

test("missing API key matches live", () => {
  const box = createSandbox();
  const r = call(box, "POST", "/api/v1/check", {
    key: "",
    body: { to: KNOWN_PAYEE, value_usd: 10 },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, "Missing API key.");
});

test("known payee within job and daily cap is fine", () => {
  const box = createSandbox();
  const r = call(box, "POST", "/api/v1/check", {
    body: { to: KNOWN_PAYEE, value_usd: 20, job_id: "job_research" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.decision, "fine");
  assert.equal(r.body.must_abort, false);
  assert.equal(r.body.remaining_usd.job_usd, 48);
  assert.equal(r.body.remaining_usd.daily_usd, 300);
});

test("new payee waits on you", () => {
  const box = createSandbox();
  const r = call(box, "POST", "/api/v1/check", {
    body: { to: NEW_PAYEE, value_usd: 12, job_id: "job_research" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.decision, "wait");
  assert.equal(r.body.reason, "A new payee waits on you.");
  assert.ok(r.body.poll_url.startsWith("/api/v1/approvals/"));
  const left = call(box, "GET", "/api/v1/jobs/job_research");
  assert.equal(left.body.remaining_usd, 68);
});

test("over the job cap is stop", () => {
  const box = createSandbox();
  const r = call(box, "POST", "/api/v1/check", {
    body: { to: KNOWN_PAYEE, value_usd: 69, job_id: "job_research" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.decision, "stop");
  assert.equal(r.body.must_abort, true);
  assert.equal(r.body.reason, "Over the job cap.");
});

test("over the daily cap is stop even if the job has room", () => {
  const box = createSandbox();
  const r = call(box, "POST", "/api/v1/check", {
    body: { to: KNOWN_PAYEE, value_usd: 321, job_id: "job_research" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.decision, "stop");
  assert.equal(r.body.reason, "Over the daily cap.");
});

test("expired job is stop", () => {
  const box = createSandbox();
  const r = call(box, "POST", "/api/v1/check", {
    body: { to: KNOWN_PAYEE, value_usd: 5, job_id: "job_expired" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.decision, "stop");
  assert.equal(r.body.reason, "This job has ended.");
});

test("agent can read remaining on the job", () => {
  const box = createSandbox();
  const r = call(box, "GET", "/api/v1/jobs/job_research");
  assert.equal(r.status, 200);
  assert.equal(r.body.cap_usd, 80);
  assert.equal(r.body.spent_usd, 12);
  assert.equal(r.body.remaining_usd, 68);
  assert.equal(r.body.expired, false);
});

test("starter may have only one active job budget", () => {
  const box = createSandbox();
  const r = call(box, "POST", "/api/v1/jobs", {
    body: { name: "Second run", cap_usd: 40 },
  });
  assert.equal(r.status, 403);
  assert.match(r.body.error, /Starter includes 1 active job budget/);
});

test("create job with optional end time, then stop after it ends", () => {
  const box = createSandbox();
  const created = call(box, "POST", "/api/v1/jobs", {
    key: OPEN_KEY,
    body: { name: "Short run", cap_usd: 25, ends_at: 1_700_000_000_000 },
    now: 1_699_999_000_000,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Short run");
  assert.equal(created.body.remaining_usd, 25);
  const later = call(box, "POST", "/api/v1/check", {
    key: OPEN_KEY,
    body: { to: NEW_PAYEE, value_usd: 5, job_id: created.body.id },
    now: 1_700_000_000_001,
  });
  assert.equal(later.body.decision, "stop");
  assert.equal(later.body.reason, "This job has ended.");
});

test("verify returns only leash, cap, and human-sees-new-address flags", () => {
  const box = createSandbox();
  const yes = call(box, "GET", `/api/v1/verify/${LAB_AGENT}`, { key: "" });
  assert.equal(yes.status, 200);
  assert.deepEqual(Object.keys(yes.body).sort(), [
    "cap_exists",
    "human_sees_new_addresses",
    "leashed",
  ]);
  assert.equal(yes.body.leashed, true);
  assert.equal(yes.body.cap_exists, true);
  assert.equal(yes.body.human_sees_new_addresses, true);

  const byKey = call(box, "GET", `/api/v1/verify/${LAB_KEY}`, { key: "" });
  assert.deepEqual(byKey.body, yes.body);

  const no = call(box, "GET", `/api/v1/verify/${OPEN_AGENT}`, { key: "" });
  assert.equal(no.body.leashed, false);
  assert.equal(no.body.cap_exists, false);
  assert.equal(no.body.human_sees_new_addresses, false);

  const unknown = call(box, "GET", "/api/v1/verify/nobody", { key: "" });
  assert.deepEqual(unknown.body, {
    leashed: false,
    cap_exists: false,
    human_sees_new_addresses: false,
  });
});

test("policy check does not invent a second billing checkout", () => {
  const box = createSandbox();
  const r = call(box, "POST", "/api/v1/billing/checkout", {
    body: { plan: "starter" },
  });
  assert.equal(r.status, 404);
});

test("wait then allow once, then the same payee is fine", () => {
  const box = createSandbox();
  const wait = call(box, "POST", "/api/v1/check", {
    body: { to: NEW_PAYEE, value_usd: 8, job_id: "job_research" },
  });
  assert.equal(wait.body.decision, "wait");
  const allow = call(box, "POST", wait.body.poll_url, {
    body: { action: "allow_once" },
  });
  assert.equal(allow.body.status, "fine");
  const again = call(box, "POST", "/api/v1/check", {
    body: { to: NEW_PAYEE, value_usd: 8, job_id: "job_research" },
  });
  assert.equal(again.body.decision, "fine");
});

test("over-cap wins over a new payee", () => {
  const box = createSandbox();
  const r = call(box, "POST", "/api/v1/check", {
    body: { to: NEW_PAYEE, value_usd: 70, job_id: "job_research" },
  });
  assert.equal(r.body.decision, "stop");
  assert.equal(r.body.reason, "Over the job cap.");
});

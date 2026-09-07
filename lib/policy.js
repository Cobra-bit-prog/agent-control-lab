/**
 * Sandbox policy for Agent Control lab.
 * Same check as live: POST /api/v1/check (MCP check_transfer).
 * Decisions use customer words: fine / wait / stop.
 */

export const KNOWN_PAYEE = "PayeeKnown111111111111111111111111111";
export const LAB_KEY = "ack_lab_leashed";
export const LAB_AGENT = "agt_lab";
export const OPEN_KEY = "ack_lab_open";
export const OPEN_AGENT = "agt_open";

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return NaN;
  return Math.round(v * 100) / 100;
}

function lower(s) {
  return String(s || "").trim().toLowerCase();
}

function seed(now) {
  return {
    agents: {
      [LAB_KEY]: {
        key: LAB_KEY,
        agent_id: LAB_AGENT,
        leashed: true,
        daily_cap_usd: 400,
        daily_spent_usd: 80,
        known_payees: new Set([lower(KNOWN_PAYEE)]),
        human_sees_new_addresses: true,
        plan: "starter",
      },
      [OPEN_KEY]: {
        key: OPEN_KEY,
        agent_id: OPEN_AGENT,
        leashed: false,
        daily_cap_usd: null,
        daily_spent_usd: 0,
        known_payees: new Set(),
        human_sees_new_addresses: false,
        plan: "starter",
      },
    },
    jobs: {
      job_research: {
        id: "job_research",
        agent_id: LAB_AGENT,
        name: "License run",
        cap_usd: 80,
        spent_usd: 12,
        ends_at: null,
      },
      job_expired: {
        id: "job_expired",
        agent_id: LAB_AGENT,
        name: "Ended run",
        cap_usd: 50,
        spent_usd: 0,
        ends_at: now - 60_000,
      },
    },
    approvals: {},
    approvalSeq: 1,
    jobSeq: 1,
  };
}

function findAgent(state, agentOrKey) {
  const raw = String(agentOrKey || "").trim();
  if (!raw) return null;
  if (state.agents[raw]) return state.agents[raw];
  const want = lower(raw);
  return (
    Object.values(state.agents).find(
      (a) => lower(a.agent_id) === want || lower(a.key) === want,
    ) || null
  );
}

function jobExpired(job, now) {
  return job.ends_at != null && now >= job.ends_at;
}

function remainingOf(cap, spent) {
  if (cap == null) return null;
  return money(Math.max(0, cap - spent));
}

function publicJob(job, now) {
  const expired = jobExpired(job, now);
  return {
    id: job.id,
    name: job.name,
    cap_usd: job.cap_usd,
    spent_usd: money(job.spent_usd),
    remaining_usd: remainingOf(job.cap_usd, job.spent_usd),
    ends_at: job.ends_at,
    expired,
    active: !expired,
  };
}

function remainingPayload(agent, job, now) {
  const daily =
    agent.daily_cap_usd == null
      ? null
      : remainingOf(agent.daily_cap_usd, agent.daily_spent_usd);
  const out = { daily_usd: daily };
  if (job) out.job_usd = remainingOf(job.cap_usd, job.spent_usd);
  return out;
}

function usageCheck() {
  return {
    usage: "POST /api/v1/check with Authorization: Bearer ",
    body: {
      to: "destination address",
      value_usd: 250,
      job_id: "optional job budget id",
    },
    note: "Call this before settling. Answers fine, wait, or stop. Wait: poll poll_url. Stop: do not send. MCP check_transfer is this same check.",
  };
}

export function createSandbox(now = Date.now()) {
  const state = seed(now);

  function requireAgent(key) {
    const agent = findAgent(state, key);
    if (!agent) return { error: "Missing API key.", status: 401 };
    return { agent };
  }

  function verify(agentOrKey) {
    const agent = findAgent(state, agentOrKey);
    if (!agent) {
      return {
        leashed: false,
        cap_exists: false,
        human_sees_new_addresses: false,
      };
    }
    return {
      leashed: Boolean(agent.leashed),
      cap_exists: agent.daily_cap_usd != null,
      human_sees_new_addresses: Boolean(agent.human_sees_new_addresses),
    };
  }

  function listJobs(key, nowMs) {
    const auth = requireAgent(key);
    if (auth.error) return auth;
    const now = nowMs ?? Date.now();
    return {
      jobs: Object.values(state.jobs)
        .filter((j) => j.agent_id === auth.agent.agent_id)
        .map((j) => publicJob(j, now)),
      starter_active_job_limit: auth.agent.plan === "starter" ? 1 : null,
      note:
        auth.agent.plan === "starter"
          ? "Starter includes 1 active job budget. More on Pro."
          : null,
    };
  }

  function getJob(key, id, nowMs) {
    const auth = requireAgent(key);
    if (auth.error) return auth;
    const job = state.jobs[id];
    if (!job || job.agent_id !== auth.agent.agent_id) {
      return { error: "Job not found.", status: 404 };
    }
    return publicJob(job, nowMs ?? Date.now());
  }

  function createJob(key, body, nowMs) {
    const auth = requireAgent(key);
    if (auth.error) return auth;
    const now = nowMs ?? Date.now();
    const name = String(body?.name || "").trim();
    const cap_usd = money(body?.cap_usd);
    let ends_at = null;
    if (body?.ends_at != null && body.ends_at !== "") {
      const t =
        typeof body.ends_at === "number"
          ? body.ends_at
          : Date.parse(String(body.ends_at));
      if (!Number.isFinite(t)) {
        return { error: "End time is not a valid time.", status: 400 };
      }
      ends_at = t;
    }
    if (!name) return { error: "Job name is required.", status: 400 };
    if (!Number.isFinite(cap_usd) || cap_usd <= 0) {
      return { error: "Job cap must be a dollar amount greater than 0.", status: 400 };
    }
    const active = Object.values(state.jobs).filter(
      (j) => j.agent_id === auth.agent.agent_id && !jobExpired(j, now),
    );
    if (auth.agent.plan === "starter" && active.length >= 1) {
      return {
        error: "Starter includes 1 active job budget. More on Pro.",
        status: 403,
      };
    }
    state.jobSeq += 1;
    const id = `job_${state.jobSeq}`;
    const job = {
      id,
      agent_id: auth.agent.agent_id,
      name,
      cap_usd,
      spent_usd: 0,
      ends_at,
    };
    state.jobs[id] = job;
    return publicJob(job, now);
  }

  function check(key, body, nowMs) {
    const auth = requireAgent(key);
    if (auth.error) return auth;
    const agent = auth.agent;
    const now = nowMs ?? Date.now();
    const to = String(body?.to || "").trim();
    const value_usd = money(body?.value_usd);
    const job_id = body?.job_id ? String(body.job_id).trim() : "";
    if (!to) return { error: "Destination is required.", status: 400 };
    if (!Number.isFinite(value_usd) || value_usd <= 0) {
      return { error: "value_usd must be a dollar amount greater than 0.", status: 400 };
    }

    let job = null;
    if (job_id) {
      job = state.jobs[job_id];
      if (!job || job.agent_id !== agent.agent_id) {
        return {
          decision: "stop",
          must_abort: true,
          reason: "Job not found.",
          remaining_usd: remainingPayload(agent, null, now),
        };
      }
      if (jobExpired(job, now)) {
        return {
          decision: "stop",
          must_abort: true,
          job_id: job.id,
          reason: "This job has ended.",
          remaining_usd: remainingPayload(agent, job, now),
        };
      }
    }

    const dailyLeft = remainingOf(agent.daily_cap_usd, agent.daily_spent_usd);
    if (dailyLeft != null && value_usd > dailyLeft) {
      return {
        decision: "stop",
        must_abort: true,
        job_id: job ? job.id : undefined,
        reason: "Over the daily cap.",
        remaining_usd: remainingPayload(agent, job, now),
      };
    }
    if (job) {
      const jobLeft = remainingOf(job.cap_usd, job.spent_usd);
      if (jobLeft != null && value_usd > jobLeft) {
        return {
          decision: "stop",
          must_abort: true,
          job_id: job.id,
          reason: "Over the job cap.",
          remaining_usd: remainingPayload(agent, job, now),
        };
      }
    }

    const known = agent.known_payees.has(lower(to));
    if (!known && agent.human_sees_new_addresses) {
      const approval_id = `appr_${state.approvalSeq++}`;
      state.approvals[approval_id] = {
        id: approval_id,
        agent_id: agent.agent_id,
        to,
        value_usd,
        job_id: job ? job.id : null,
        status: "wait",
      };
      return {
        decision: "wait",
        must_abort: false,
        job_id: job ? job.id : undefined,
        reason: "A new payee waits on you.",
        approval_id,
        poll_url: `/api/v1/approvals/${approval_id}`,
        remaining_usd: remainingPayload(agent, job, now),
      };
    }

    agent.daily_spent_usd = money(agent.daily_spent_usd + value_usd);
    if (job) job.spent_usd = money(job.spent_usd + value_usd);
    return {
      decision: "fine",
      must_abort: false,
      job_id: job ? job.id : undefined,
      reason: "Within the cap. Known payee.",
      remaining_usd: remainingPayload(agent, job, now),
    };
  }

  function getApproval(key, id) {
    const auth = requireAgent(key);
    if (auth.error) return auth;
    const row = state.approvals[id];
    if (!row || row.agent_id !== auth.agent.agent_id) {
      return { error: "Not found.", status: 404 };
    }
    return {
      approval_id: row.id,
      status: row.status,
      to: row.to,
      value_usd: row.value_usd,
      job_id: row.job_id,
    };
  }

  function decideApproval(key, id, action) {
    const auth = requireAgent(key);
    if (auth.error) return auth;
    const row = state.approvals[id];
    if (!row || row.agent_id !== auth.agent.agent_id) {
      return { error: "Not found.", status: 404 };
    }
    if (row.status !== "wait") {
      return { approval_id: row.id, status: row.status };
    }
    if (action === "allow_once") {
      auth.agent.known_payees.add(lower(row.to));
      row.status = "fine";
      return {
        approval_id: row.id,
        status: "fine",
        note: "Allowed this once. Check again, then settle.",
      };
    }
    if (action === "block") {
      row.status = "stop";
      return { approval_id: row.id, status: "stop", note: "Stopped. Do not send." };
    }
    return { error: "Use allow_once or block.", status: 400 };
  }

  return {
    check,
    verify,
    listJobs,
    getJob,
    createJob,
    getApproval,
    decideApproval,
    usageCheck,
  };
}

export const sandbox = createSandbox();

function bearer(headers) {
  const h = headers?.authorization || headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : "";
}

function readBody(body) {
  if (body == null || body === "") return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return { __invalid_json: true };
    }
  }
  if (typeof body === "object") return body;
  return {};
}

/**
 * HTTP adapter used by the Vercel function and the local lab server.
 * @returns {{ status: number, body: object }}
 */
export function handleRequest(input, box = sandbox) {
  const method = String(input.method || "GET").toUpperCase();
  const url = new URL(String(input.url || "/"), "http://lab.local");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const headers = input.headers || {};
  const key = bearer(headers);
  const now = input.now ?? Date.now();

  if (method === "OPTIONS") {
    return { status: 204, body: {} };
  }

  if (path === "/api/v1/check" && method === "GET") {
    return { status: 200, body: box.usageCheck() };
  }
  if (path === "/api/v1/check" && method === "POST") {
    const body = readBody(input.body);
    if (body.__invalid_json) {
      return { status: 400, body: { error: "JSON body required." } };
    }
    if (!key) return { status: 401, body: { error: "Missing API key." } };
    const result = box.check(key, body, now);
    if (result.error) return { status: result.status || 400, body: { error: result.error } };
    return { status: 200, body: result };
  }

  const verifyMatch = path.match(/^\/api\/v1\/verify\/([^/]+)$/);
  if (verifyMatch && method === "GET") {
    return { status: 200, body: box.verify(decodeURIComponent(verifyMatch[1])) };
  }
  if (path === "/api/v1/verify" && method === "GET") {
    return {
      status: 200,
      body: {
        usage: "GET /api/v1/verify/:agent_or_key",
        returns: ["leashed", "cap_exists", "human_sees_new_addresses"],
        note: "Sellers keep their own checkout. We only answer these three.",
      },
    };
  }

  if (path === "/api/v1/jobs" && method === "GET") {
    if (!key) return { status: 401, body: { error: "Missing API key." } };
    const result = box.listJobs(key, now);
    if (result.error) return { status: result.status || 400, body: { error: result.error } };
    return { status: 200, body: result };
  }
  if (path === "/api/v1/jobs" && method === "POST") {
    if (!key) return { status: 401, body: { error: "Missing API key." } };
    const body = readBody(input.body);
    if (body.__invalid_json) {
      return { status: 400, body: { error: "JSON body required." } };
    }
    const result = box.createJob(key, body, now);
    if (result.error) return { status: result.status || 400, body: { error: result.error } };
    return { status: 201, body: result };
  }
  const jobMatch = path.match(/^\/api\/v1\/jobs\/([^/]+)$/);
  if (jobMatch && method === "GET") {
    if (!key) return { status: 401, body: { error: "Missing API key." } };
    const result = box.getJob(key, decodeURIComponent(jobMatch[1]), now);
    if (result.error) return { status: result.status || 404, body: { error: result.error } };
    return { status: 200, body: result };
  }

  const apprMatch = path.match(/^\/api\/v1\/approvals\/([^/]+)$/);
  if (apprMatch && method === "GET") {
    if (!key) return { status: 401, body: { error: "Missing API key." } };
    const result = box.getApproval(key, decodeURIComponent(apprMatch[1]));
    if (result.error) return { status: result.status || 404, body: { error: result.error } };
    return { status: 200, body: result };
  }
  if (apprMatch && method === "POST") {
    if (!key) return { status: 401, body: { error: "Missing API key." } };
    const body = readBody(input.body);
    const result = box.decideApproval(
      key,
      decodeURIComponent(apprMatch[1]),
      body.action,
    );
    if (result.error) return { status: result.status || 400, body: { error: result.error } };
    return { status: 200, body: result };
  }

  return { status: 404, body: { error: "Not found." } };
}

import { CORS } from "../../_lib/http.js";
import { payoutAddress } from "../../_lib/store.js";

/** Register (or reuse) a Helius enhanced webhook on the USDC receive wallet. */
export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST to register the Helius webhook." });
    return;
  }
  const apiKey = process.env.HELIUS_API_KEY?.trim();
  const recipient = payoutAddress();
  if (!apiKey || !recipient) {
    res.status(503).json({ error: "Need HELIUS_API_KEY and SOLANA_PAYOUT_ADDRESS." });
    return;
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const webhookURL =
    process.env.HELIUS_WEBHOOK_URL?.trim() ||
    `${proto}://${host}/api/v1/billing/helius`;

  try {
    const existing = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${apiKey}`);
    const list = existing.ok ? await existing.json() : [];
    const found = Array.isArray(list)
      ? list.find((w) => w.webhookURL === webhookURL)
      : null;
    if (found) {
      res.status(200).json({ ok: true, webhookID: found.webhookID, webhookURL, reused: true });
      return;
    }
    const created = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        webhookURL,
        accountAddresses: [recipient],
        webhookType: "enhanced",
        txnStatus: "finalized",
        transactionTypes: ["Any"],
      }),
    });
    const body = await created.json();
    if (!created.ok) {
      res.status(created.status).json({ error: body.error || body, webhookURL });
      return;
    }
    res.status(200).json({
      ok: true,
      webhookID: body.webhookID || body.webhookId,
      webhookURL,
      reused: false,
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "Helius setup failed." });
  }
}

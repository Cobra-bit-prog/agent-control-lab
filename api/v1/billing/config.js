import { CORS } from "../../_lib/http.js";
import { checkoutConfigured, payoutAddress } from "../../_lib/store.js";

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const addr = payoutAddress();
  res.status(200).json({
    configured: checkoutConfigured(),
    chain: "solana",
    asset: "usdc",
    match: "solana-pay-reference",
    no_unique_amount: true,
    recipient: addr,
    helius: Boolean(process.env.HELIUS_API_KEY),
  });
}

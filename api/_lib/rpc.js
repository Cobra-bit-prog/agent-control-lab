import { matchUsdcByReference } from "../../js/pay-core.js";

const DEFAULT_RPC = [
  process.env.SOLANA_RPC_URL,
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "",
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://solana.drpc.org",
].filter(Boolean);

export function rpcUrls() {
  return [...new Set(DEFAULT_RPC)];
}

export async function rpc(method, params) {
  let last = new Error("RPC error");
  for (const url of rpcUrls()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
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

export async function findMatchingUsdcPayment(opts) {
  const sigs = await rpc("getSignaturesForAddress", [opts.reference, { limit: 8 }]);
  if (!Array.isArray(sigs) || sigs.length === 0) return { kind: "none" };
  const packed = [];
  for (const s of sigs) {
    if (s.err) continue;
    try {
      const tx = await rpc("getTransaction", [
        s.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      packed.push({ signature: s.signature, err: s.err, tx });
    } catch {
      /* skip one signature; keep looking */
    }
  }
  return matchUsdcByReference({
    recipient: opts.recipient,
    amountUsdc: opts.amountUsdc,
    signatures: packed,
  });
}

import { SOLANA_PAYOUT_ADDRESS } from "./pay-core.js";

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** Same public receive pubkey as production Vercel SOLANA_PAYOUT_ADDRESS. */
export const DEFAULT_RECIPIENT = SOLANA_PAYOUT_ADDRESS;

export const RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://solana.drpc.org",
];

/** Lab pay config. Same USDC wallet for every invoice; Solana Pay reference is unique. */

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/**
 * Receiving wallet for USDC on Solana.
 * Override with SOLANA_PAYOUT_ADDRESS on the API, or localStorage ac_payout for a local lab.
 */
export const DEFAULT_RECIPIENT = "";

export const RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://solana.drpc.org",
];

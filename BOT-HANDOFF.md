# What changed — paste into Chief of Staff, Product designer, and Marketing

Date: 2026-09-07
Production: NOT changed. Live site remains https://agent-control.net
Public sandbox: https://cobra-bit-prog.github.io/agent-control-lab/

## This PR
The agent can pay. The job has a cap. A new payee waits on you.

1. x402 — 402 → POST /api/v1/check (MCP check_transfer) → fine / wait / stop → only then settle
2. Task budget — job $ cap + optional clock on top of daily cap. Starter: 1 active job.
3. Seller verify — GET /api/v1/verify/:agent_or_key (leashed, cap_exists, human_sees_new_addresses)

Human checkout (merged) stays one rail: $29 USDC on Solana. Scan or tap Pay. We unlock when it lands.

Solana Pay unique reference + Helius when it lands. No unique-amount matching. No in-page Phantom. No card. No KYC.

**Receive wallet (all human USDC):** `49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR`
Env: `SOLANA_PAYOUT_ADDRESS=49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR` (same public Phantom pubkey as production Vercel). Do not invent another receive address.

3-second pitch: Send $29 USDC on Solana. Scan or tap Pay. We unlock when it lands.

Copy
- Title: Pay $29. Console stays on.
- Body: Send $29 USDC on Solana. We unlock when it lands.
- CTA: Pay $29
- Waiting: Waiting for $29 USDC on Solana.
- Done: Paid. Console is open.
- Warn: Use a wallet. Do not send from Coinbase or Binance.
- Trial mail: Your day is almost up. Pay $29 USDC on Solana to keep the console.

Agent POST /api/v1/billing/checkout stays for agents/MCP/storefront.

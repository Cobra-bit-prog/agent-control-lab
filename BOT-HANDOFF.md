# What changed — paste into Chief of Staff, Product designer, and Marketing

Date: 2026-09-07
Production: NOT changed. Live site remains https://agent-control.net
Public sandbox: https://cobra-bit-prog.github.io/agent-control-lab/

## This PR (copy only)
Landing FAQ + pricing hygiene. No product behavior change.

- Competitor names stripped from FAQ (`agentaudit.dev`, SpendGuard, Turnkey). Generic product wording only.
- Pricing bullet “Policy + pre-sign hook” → “Checks before they pay”
- FAQ/how-it-works pre-sign jargon → “ask / checks before they pay”

HOLD (untouched): H1 “External audit for your agents” · sub “Not a package scanner — this is spend control for agent wallets”
KEEP (untouched): x402 block, job budget, Gate, Solana Pay recipient lock

## Still on this sandbox (from PR #5)
The agent can pay. The job has a cap. A new payee waits on you.

1. x402 — 402 → POST /api/v1/check (MCP check_transfer) → fine / wait / stop → only then settle
2. Task budget — job $ cap + optional clock on top of daily cap. Starter: 1 active job.
3. Seller verify — GET /api/v1/verify/:agent_or_key (leashed, cap_exists, human_sees_new_addresses)

Human checkout stays one rail: $29 USDC on Solana. Scan or tap Pay. We unlock when it lands.

**Receive wallet (all human USDC):** `49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR`
Env: `SOLANA_PAYOUT_ADDRESS=49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR`

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

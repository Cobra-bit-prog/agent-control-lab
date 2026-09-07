# What changed — paste into Chief of Staff, Product designer, and Marketing

Date: 2026-09-07
Production: NOT changed. Live site remains https://agent-control.net
Public sandbox: https://cobra-bit-prog.github.io/agent-control-lab/pay.html?plan=starter

## Decision
Human front door is one rail: $29 USDC on Solana. Scan or tap Pay. We unlock when it lands.

Solana Pay unique reference + Helius when it lands. No unique-amount matching. No in-page Phantom. No card. No KYC.

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

# Agent Control lab (sandbox)

Human checkout is Solana Pay + Helius. Unique **reference** per invoice. Exact **$29 / $49 / $149** USDC — not a special amount.

Live production is untouched: https://agent-control.net

## Receive wallet

All human USDC on Solana goes to the production Phantom receive pubkey:

```
SOLANA_PAYOUT_ADDRESS=49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR
```

QR, Pay deep link, and invoice `recipient` all target this address. Matching uses a unique Solana Pay reference — never a different receive wallet.

## Preview

- Pay screen: `pay.html?plan=starter`
- Trial lock: `app.html?lock=1`
- Hour-20 mail: `email/trial-ending.html`
- Public GitHub Pages (after this branch is on `gh-pages` / `main`): https://cobra-bit-prog.github.io/agent-control-lab/pay.html?plan=starter

Local: `python3 -m http.server 4173` then open `/pay.html?plan=starter`.

On Vercel set `SOLANA_PAYOUT_ADDRESS` to the value above (expected production value). Optional `HELIUS_API_KEY`, then `POST /api/v1/billing/helius-setup`.

## Agent API (not the human front door)

`POST /api/v1/billing/checkout` with `Authorization: Bearer <agent key>` still opens a pay request. Humans use `/pay.html`.

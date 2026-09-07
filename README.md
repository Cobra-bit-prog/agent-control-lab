# Agent Control lab (sandbox)

Human checkout is Solana Pay + Helius. Unique **reference** per invoice. Exact **$29 / $49 / $149** USDC — not a special amount.

Live production is untouched: https://agent-control.net

## Preview

- Pay screen: `pay.html?plan=starter`
- Trial lock: `app.html?lock=1`
- Hour-20 mail: `email/trial-ending.html`
- Public GitHub Pages (after this branch is on `gh-pages` / `main`): https://cobra-bit-prog.github.io/agent-control-lab/pay.html?plan=starter

Local: `python3 -m http.server 4173` then open `/pay.html?plan=starter`.

Set the USDC receive wallet (same address every invoice):

```js
localStorage.setItem("ac_payout", "<YOUR_SOLANA_USDC_WALLET>")
```

On Vercel: `SOLANA_PAYOUT_ADDRESS`, optional `HELIUS_API_KEY`, then `POST /api/v1/billing/helius-setup`.

## Agent API (not the human front door)

`POST /api/v1/billing/checkout` with `Authorization: Bearer <agent key>` still opens a pay request. Humans use `/pay.html`.

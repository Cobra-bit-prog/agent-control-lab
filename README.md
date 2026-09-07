# Agent Control lab (sandbox)

The agent can pay. The job has a cap. A new payee waits on you.

Live production is untouched: https://agent-control.net

## Human checkout (Solana Pay)

Unique **reference** per invoice. Exact **$29 / $49 / $149** USDC — not a special amount.

All human USDC on Solana goes to the production Phantom receive pubkey:

```
SOLANA_PAYOUT_ADDRESS=49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR
```

QR, Pay deep link, and invoice `recipient` all target this address. Matching uses a unique Solana Pay reference — never a different receive wallet. No in-page Phantom. No card. No KYC.

- Pay screen: `pay.html?plan=starter`
- Trial lock: `app.html?lock=1`
- Hour-20 mail: `email/trial-ending.html`

`POST /api/v1/billing/checkout` with `Authorization: Bearer <agent key>` still opens a pay request. Humans use `/pay.html`.

## Agent control surfaces

1. **x402** — sit on the pay loop. `402` → `POST /api/v1/check` (MCP `check_transfer`) → fine / wait / stop → only then settle.
2. **Task budget** — a dollar cap and a clock for the run, on top of the daily cap. Starter includes 1 active job budget.
3. **Seller verify** — `GET /api/v1/verify/:agent_or_key` answers only: leashed, cap exists, human sees new addresses.

- `/docs#x402` the check, 402 path, job budget, seller badge HTML
- `/app/` job name, $ cap, optional end time
- Demo key: `ack_lab_leashed`. Seeded job: `job_research`.

```bash
npm test
npm start   # http://127.0.0.1:4173
```

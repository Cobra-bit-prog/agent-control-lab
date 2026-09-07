import test from "node:test";
import assert from "node:assert/strict";
import {
  PLANS,
  usdcBaseUnits,
  copyFor,
  isForbiddenCustomerWord,
  matchUsdcByReference,
  paymentsFromHeliusPayload,
  buildSolanaPayUrl,
  newPayReference,
  viewInvoice,
  USDC_MINT,
  SOLANA_PAYOUT_ADDRESS,
} from "../js/pay-core.js";

test("plans are exact dollars, not unique dust", () => {
  assert.equal(PLANS.starter.price, 29);
  assert.equal(PLANS.pro.price, 49);
  assert.equal(PLANS.team.price, 149);
  assert.equal(usdcBaseUnits(29), "29000000");
  assert.notEqual(String(PLANS.starter.price), "29.000137");
});

test("copy uses customer words only", () => {
  const c = copyFor(29);
  assert.equal(c.title, "Pay $29. Console stays on.");
  assert.equal(c.body, "Send $29 USDC on Solana. We unlock when it lands.");
  assert.equal(c.cta, "Pay $29");
  assert.equal(c.waiting, "Waiting for $29 USDC on Solana.");
  assert.equal(c.done, "Paid. Console is open.");
  assert.equal(c.warn, "Use a wallet. Do not send from Coinbase or Binance.");
  assert.equal(c.trialMail, "Your day is almost up. Pay $29 USDC on Solana to keep the console.");
  for (const value of Object.values(c)) {
    assert.equal(isForbiddenCustomerWord(value), false);
  }
});

test("Solana Pay URL is $29 plus a unique reference to the Phantom receive wallet", () => {
  const a = newPayReference();
  const b = newPayReference();
  assert.notEqual(a, b);
  const url = buildSolanaPayUrl({
    recipient: "WrongWalletDoNotUse111111111111111111111",
    amountUsdc: 29,
    reference: a,
  });
  assert.match(url, /^solana:49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR\?/);
  assert.match(url, /amount=29/);
  assert.doesNotMatch(url, /29\.000/);
  assert.doesNotMatch(url, /WrongWallet/);
  assert.match(url, new RegExp(`spl-token=${USDC_MINT}`));
  assert.match(url, new RegExp(`reference=${a}`));
  assert.equal(SOLANA_PAYOUT_ADDRESS, "49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR");
});

function usdcTx(owner, amountBase) {
  return {
    meta: {
      preTokenBalances: [{ mint: USDC_MINT, owner, uiTokenAmount: { amount: "0" } }],
      postTokenBalances: [{ mint: USDC_MINT, owner, uiTokenAmount: { amount: String(amountBase) } }],
    },
  };
}

test("payment matches by reference without a special amount", () => {
  const paid = matchUsdcByReference({
    recipient: SOLANA_PAYOUT_ADDRESS,
    amountUsdc: 29,
    signatures: [
      { signature: "sigPaid", tx: usdcTx(SOLANA_PAYOUT_ADDRESS, 29_000_000) },
    ],
  });
  assert.equal(paid.kind, "paid");
  assert.equal(paid.signature, "sigPaid");
  assert.equal(paid.amountUsdc, 29);

  const otherInvoice = matchUsdcByReference({
    recipient: SOLANA_PAYOUT_ADDRESS,
    amountUsdc: 29,
    signatures: [],
  });
  assert.equal(otherInvoice.kind, "none");

  const uniqueDustWouldHaveBeen = 29_000_137;
  const exactPlan = matchUsdcByReference({
    recipient: SOLANA_PAYOUT_ADDRESS,
    amountUsdc: 29,
    signatures: [{ signature: "sigExact", tx: usdcTx(SOLANA_PAYOUT_ADDRESS, 29_000_000) }],
  });
  assert.equal(exactPlan.kind, "paid");
  assert.notEqual(uniqueDustWouldHaveBeen, 29_000_000);
});

test("Helius webhook matches the Solana Pay reference, not amount dust", () => {
  const reference = "HelRef11111111111111111111111111111111111";
  const body = [
    {
      signature: "heliusSig",
      accountData: [{ account: SOLANA_PAYOUT_ADDRESS }, { account: reference }],
      tokenTransfers: [
        {
          mint: USDC_MINT,
          toUserAccount: SOLANA_PAYOUT_ADDRESS,
          tokenAmount: 29,
        },
      ],
    },
  ];
  const payments = paymentsFromHeliusPayload(body, SOLANA_PAYOUT_ADDRESS);
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amountUsdc, 29);
  assert.ok(payments[0].references.includes(reference));
});

test("invoice view always names the Phantom receive pubkey", () => {
  const view = viewInvoice(
    {
      id: "inv_test",
      plan: "starter",
      recipient: "SomeOtherWallet111111111111111111111111",
      reference: "Ref111111111111111111111111111111111111111",
      status: "pending",
      email: "ops@example.com",
    },
    "https://example.test",
  );
  assert.equal(view.recipient, "49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR");
  assert.match(view.pay_url, /^solana:49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR\?/);
  assert.equal(view.amount_usdc, 29);
});

import assert from "node:assert/strict";
import test from "node:test";
import { payoutAddress, createInvoice } from "../api/_lib/store.js";
import {
  SOLANA_PAYOUT_ADDRESS,
  buildSolanaPayUrl,
  newPayReference,
} from "../js/pay-core.js";

test("human USDC still lands on the production receive pubkey", () => {
  assert.equal(
    SOLANA_PAYOUT_ADDRESS,
    "49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR",
  );
  assert.equal(payoutAddress(), SOLANA_PAYOUT_ADDRESS);
  const row = createInvoice({ plan: "starter", source: "agent" });
  assert.equal(row.recipient, SOLANA_PAYOUT_ADDRESS);
  const url = buildSolanaPayUrl({
    recipient: "WrongWalletDoNotUse111111111111111111111",
    amountUsdc: 29,
    reference: newPayReference(),
  });
  assert.match(url, /^solana:49QioAKPzo1Vij2jxdMqSR72cCZbqz2vAQSzrtt1S3nR\?/);
  assert.doesNotMatch(url, /WrongWallet/);
  assert.match(url, /reference=/);
});

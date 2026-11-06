import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  deriveProviderEventId,
  verifySasPayWebhookSignature,
  WEBHOOK_TOLERANCE_SECONDS,
} from "../src/lib/saspay-webhook";

describe("SasPay Webhook Signature & Timestamp Verification", () => {
  const secret = "whsec_test_apacci_secret_key_2026";
  const nowSeconds = 1793950000;
  const rawBody = JSON.stringify({
    event: "transaction.success",
    data: {
      id: "7c1a9b20-1111-4222-8333-444455556666",
      reference: "TXN-2026-000456",
      type: "PAIEMENT",
      status: "SUCCESS",
      amount: "25000.00",
      fee: "625.00",
      charged: "25625.00",
      net_amount: "25000.00",
      fee_charge_mode: "ADD_ON",
      currency: "XOF",
      country: "CI",
      network: "wave_ci",
      msisdn: "2250700000000",
    },
  });

  function signPayload(timestamp: string, body: string, signingSecret = secret): string {
    return crypto
      .createHmac("sha256", signingSecret)
      .update(`${timestamp}.${body}`, "utf8")
      .digest("hex");
  }

  it("accepts a valid HMAC-SHA256 signature within the 300s timestamp window", () => {
    const timestamp = String(nowSeconds - 45);
    const sig = signPayload(timestamp, rawBody);

    const res = verifySasPayWebhookSignature({
      rawBody,
      signatureHeader: sig,
      timestampHeader: timestamp,
      secret,
      nowSeconds,
    });

    expect(res.valid).toBe(true);
    expect(res.reason).toBeUndefined();
  });

  it("rejects a webhook when X-Webhook-Timestamp is older than 300 seconds", () => {
    const expiredTimestamp = String(nowSeconds - WEBHOOK_TOLERANCE_SECONDS - 1);
    const sig = signPayload(expiredTimestamp, rawBody);

    const res = verifySasPayWebhookSignature({
      rawBody,
      signatureHeader: sig,
      timestampHeader: expiredTimestamp,
      secret,
      nowSeconds,
    });

    expect(res.valid).toBe(false);
    expect(res.reason).toBe("timestamp_out_of_tolerance");
  });

  it("rejects a webhook when X-Webhook-Timestamp is more than 300 seconds in the future", () => {
    const futureTimestamp = String(nowSeconds + WEBHOOK_TOLERANCE_SECONDS + 10);
    const sig = signPayload(futureTimestamp, rawBody);

    const res = verifySasPayWebhookSignature({
      rawBody,
      signatureHeader: sig,
      timestampHeader: futureTimestamp,
      secret,
      nowSeconds,
    });

    expect(res.valid).toBe(false);
    expect(res.reason).toBe("timestamp_out_of_tolerance");
  });

  it("rejects a tampered raw body even if signature was valid for original body", () => {
    const timestamp = String(nowSeconds);
    const sig = signPayload(timestamp, rawBody);
    const tamperedBody = rawBody.replace('"25000.00"', '"250000.00"');

    const res = verifySasPayWebhookSignature({
      rawBody: tamperedBody,
      signatureHeader: sig,
      timestampHeader: timestamp,
      secret,
      nowSeconds,
    });

    expect(res.valid).toBe(false);
    expect(res.reason).toBe("invalid_signature");
  });

  it("rejects when signed with the wrong secret", () => {
    const timestamp = String(nowSeconds);
    const wrongSig = signPayload(timestamp, rawBody, "wrong_secret");

    const res = verifySasPayWebhookSignature({
      rawBody,
      signatureHeader: wrongSig,
      timestampHeader: timestamp,
      secret,
      nowSeconds,
    });

    expect(res.valid).toBe(false);
    expect(res.reason).toBe("invalid_signature");
  });

  it("derives a deterministic provider_event_id for deduplication", () => {
    const id1 = deriveProviderEventId(
      "transaction.success",
      { id: "7c1a9b20", status: "SUCCESS" },
      rawBody
    );
    const id2 = deriveProviderEventId(
      "transaction.success",
      { id: "7c1a9b20", status: "SUCCESS" },
      rawBody
    );
    expect(id1).toBe("transaction.success:7c1a9b20:SUCCESS");
    expect(id1).toBe(id2);
  });
});


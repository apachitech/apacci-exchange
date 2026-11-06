import crypto from "crypto";

/**
 * SasPay Webhook Signature & Timestamp Verification
 * Docs: https://docs.saspay.me/api-reference/webhooks
 *
 * Headers sent by SasPay:
 * - X-Webhook-Signature: lowercase hex sha256 HMAC
 * - X-Webhook-Timestamp: Unix timestamp in seconds
 * - X-Webhook-Event: event name (e.g., "transaction.success")
 *
 * Signed payload: `${timestamp}.${rawBody}`
 * Tolerance: 300 seconds (5 minutes)
 */

export const WEBHOOK_TOLERANCE_SECONDS = 300;

export interface WebhookVerificationResult {
  valid: boolean;
  reason?: "missing_headers" | "missing_secret" | "invalid_timestamp" | "timestamp_out_of_tolerance" | "invalid_signature";
}

export function verifySasPayWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  timestampHeader: string | null | undefined;
  secret: string | null | undefined;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): WebhookVerificationResult {
  const {
    rawBody,
    signatureHeader,
    timestampHeader,
    secret,
    nowSeconds = Math.floor(Date.now() / 1000),
    toleranceSeconds = WEBHOOK_TOLERANCE_SECONDS,
  } = params;

  if (!secret || secret.trim().length === 0) {
    return { valid: false, reason: "missing_secret" };
  }

  if (!signatureHeader || !timestampHeader) {
    return { valid: false, reason: "missing_headers" };
  }

  const timestampNum = Number(timestampHeader);
  if (!Number.isFinite(timestampNum) || !Number.isInteger(timestampNum) || timestampNum <= 0) {
    return { valid: false, reason: "invalid_timestamp" };
  }

  // 1. Check timestamp age against replay attacks (default 300s)
  if (Math.abs(nowSeconds - timestampNum) > toleranceSeconds) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
  }

  // 2. Compute expected HMAC-SHA256 over `${timestamp}.${rawBody}`
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(`${timestampHeader}.${rawBody}`, "utf8")
    .digest("hex");

  // 3. Constant-time comparison
  const receivedBuf = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");
  const expectedBuf = Buffer.from(expectedHex.toLowerCase(), "utf8");

  if (receivedBuf.length !== expectedBuf.length) {
    return { valid: false, reason: "invalid_signature" };
  }

  const isMatch = crypto.timingSafeEqual(receivedBuf, expectedBuf);
  if (!isMatch) {
    return { valid: false, reason: "invalid_signature" };
  }

  return { valid: true };
}

/**
 * Derives a deterministic unique provider_event_id for idempotency in `webhook_events`.
 * SasPay webhook envelope: `{ "event": "transaction.success", "data": { "id": "...", "status": "..." } }`
 */
export function deriveProviderEventId(
  eventType: string,
  parsedData: Record<string, unknown> | null | undefined,
  rawBody: string
): string {
  const txId = parsedData && typeof parsedData.id === "string" ? parsedData.id : null;
  const status = parsedData && typeof parsedData.status === "string" ? parsedData.status : null;
  if (txId && status) {
    return `${eventType}:${txId}:${status}`;
  }
  if (txId) {
    return `${eventType}:${txId}`;
  }
  const bodyHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex").slice(0, 32);
  return `${eventType}:${bodyHash}`;
}


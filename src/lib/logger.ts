/**
 * Structured server-side logger with automatic PII / phone number masking.
 * Never logs full MSISDNs, secret keys, or raw tokens.
 */

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "***";
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return "****";
  const prefix = cleaned.slice(0, Math.min(4, cleaned.length - 2));
  const suffix = cleaned.slice(-2);
  const maskedMiddle = "*".repeat(Math.max(3, cleaned.length - prefix.length - suffix.length));
  return `${prefix}${maskedMiddle}${suffix}`;
}

const SENSITIVE_KEYS = new Set([
  "phone",
  "msisdn",
  "customer_phone",
  "recipient_msisdn",
  "secret",
  "signing_secret",
  "authorization",
  "password",
  "otp",
]);

function sanitizeMeta(meta: unknown): unknown {
  if (meta === null || meta === undefined) return meta;
  if (typeof meta === "string") {
    // Mask strings that look like secret keys
    if (meta.startsWith("sk_live_") || meta.startsWith("sk_test_")) {
      return `${meta.slice(0, 10)}********`;
    }
    return meta;
  }
  if (Array.isArray(meta)) {
    return meta.map(sanitizeMeta);
  }
  if (typeof meta === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (lower.includes("phone") || lower.includes("msisdn")) {
        out[k] = typeof v === "string" ? maskPhone(v) : "***";
      } else if (SENSITIVE_KEYS.has(lower) || lower.includes("secret") || lower.includes("token")) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitizeMeta(v);
      }
    }
    return out;
  }
  return meta;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.info(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        message,
        ...(meta ? { meta: sanitizeMeta(meta) } : {}),
      })
    );
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(
      JSON.stringify({
        level: "warn",
        timestamp: new Date().toISOString(),
        message,
        ...(meta ? { meta: sanitizeMeta(meta) } : {}),
      })
    );
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        message,
        ...(meta ? { meta: sanitizeMeta(meta) } : {}),
      })
    );
  },
};


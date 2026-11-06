import { NextResponse } from "next/server";
import {
  deriveProviderEventId,
  verifySasPayWebhookSignature,
} from "@/lib/saspay-webhook";
import { createServiceRoleClient, createSupabaseTransactionStore } from "@/lib/supabase/admin";
import { verifyAndAdvanceTransaction, type SyncableTransaction } from "@/lib/transaction-sync";
import { logger } from "@/lib/logger";

/**
 * POST /api/webhooks/saspay
 *
 * Official SasPay Webhook Handler:
 * 1. Reads RAW request body (`await request.text()`) — never re-serialized JSON.
 * 2. Verifies HMAC-SHA256 with `SASPAY_WEBHOOK_SECRET` using constant-time comparison.
 * 3. Rejects timestamps older than 300 seconds (`X-Webhook-Timestamp`).
 * 4. Stores raw event in `webhook_events` with unique `provider_event_id` and ignores duplicates.
 * 5. Confirms status server-side via SasPay `/verify/` before marking `paid` or starting a payout.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-webhook-signature");
  const timestampHeader = request.headers.get("x-webhook-timestamp");
  const eventHeader = request.headers.get("x-webhook-event");
  const secret = process.env.SASPAY_WEBHOOK_SECRET;

  const verification = verifySasPayWebhookSignature({
    rawBody,
    signatureHeader,
    timestampHeader,
    secret,
  });

  let parsedPayload: Record<string, unknown> | null = null;
  try {
    parsedPayload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    parsedPayload = null;
  }

  const eventType =
    (typeof parsedPayload?.event === "string" ? parsedPayload.event : null) ||
    eventHeader ||
    "unknown";

  const eventData =
    parsedPayload && typeof parsedPayload.data === "object" && parsedPayload.data !== null
      ? (parsedPayload.data as Record<string, unknown>)
      : null;

  const providerEventId = deriveProviderEventId(eventType, eventData, rawBody);

  // Attempt to record the raw webhook in Supabase (if configured)
  let adminDb: ReturnType<typeof createServiceRoleClient> | null = null;
  try {
    adminDb = createServiceRoleClient();
  } catch {
    adminDb = null;
  }

  if (!verification.valid) {
    logger.warn("Rejected SasPay webhook due to invalid signature or expired timestamp", {
      eventType,
      reason: verification.reason,
      providerEventId,
    });

    if (adminDb) {
      await adminDb.from("webhook_events").upsert(
        {
          provider_event_id: `rejected:${providerEventId}:${Date.now()}`,
          event_type: eventType,
          raw_payload: rawBody,
          parsed_payload: parsedPayload,
          signature_header: signatureHeader || "",
          timestamp_header: timestampHeader || "",
          signature_valid: false,
          processed: false,
          error_message: `Verification failed: ${verification.reason}`,
        },
        { onConflict: "provider_event_id", ignoreDuplicates: true }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: verification.reason || "invalid_webhook_signature",
          message: "Webhook signature or timestamp verification failed.",
        },
      },
      { status: 403 }
    );
  }

  if (!adminDb) {
    return NextResponse.json({ success: true, status: "accepted_no_db" }, { status: 200 });
  }

  // Insert webhook event; if `provider_event_id` already exists and is processed, ignore duplicate
  const { data: existingEvent } = await adminDb
    .from("webhook_events")
    .select("id, processed")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();

  if (existingEvent?.processed) {
    logger.info("Ignoring duplicate SasPay webhook event", { providerEventId, eventType });
    return NextResponse.json({ success: true, deduplicated: true }, { status: 200 });
  }

  const { data: webhookRow } = await adminDb
    .from("webhook_events")
    .upsert(
      {
        provider_event_id: providerEventId,
        event_type: eventType,
        raw_payload: rawBody,
        parsed_payload: parsedPayload,
        signature_header: signatureHeader || "",
        timestamp_header: timestampHeader || "",
        signature_valid: true,
        processed: false,
      },
      { onConflict: "provider_event_id" }
    )
    .select("id")
    .single();

  // Process the verified webhook event
  try {
    if (eventType === "webhook.test") {
      logger.info("Received SasPay webhook.test event successfully", { providerEventId });
    } else if (eventData && typeof eventData.id === "string") {
      const saspayTxId = eventData.id;
      const txType = typeof eventData.type === "string" ? eventData.type : "";

      // Locate matching Apacci Exchange transaction by saspay_payment_id, saspay_payout_id, or checkout status
      const { data: matchedTx } = await adminDb
        .from("transactions")
        .select("*")
        .or(`saspay_payment_id.eq.${saspayTxId},saspay_payout_id.eq.${saspayTxId}`)
        .maybeSingle();

      const store = createSupabaseTransactionStore();

      if (matchedTx) {
        await verifyAndAdvanceTransaction(
          store,
          matchedTx as SyncableTransaction,
          "webhook",
          txType === "PAIEMENT" ? saspayTxId : undefined
        );
      } else if (txType === "PAIEMENT") {
        // If payin came via hosted checkout and `saspay_payment_id` wasn't linked yet,
        // scan active `payment_pending` transactions and reconcile via checkout status + verifyPayment.
        const { data: pendingTxs } = await adminDb
          .from("transactions")
          .select("*")
          .eq("status", "payment_pending")
          .order("created_at", { ascending: false })
          .limit(20);

        for (const pendingTx of pendingTxs || []) {
          await verifyAndAdvanceTransaction(
            store,
            pendingTx as SyncableTransaction,
            "webhook"
          );
        }
      }
    }

    if (webhookRow?.id) {
      await adminDb
        .from("webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", webhookRow.id);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("Error processing SasPay webhook event", {
      providerEventId,
      eventType,
      error: errMsg,
    });
    if (webhookRow?.id) {
      await adminDb
        .from("webhook_events")
        .update({ error_message: errMsg })
        .eq("id", webhookRow.id);
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}


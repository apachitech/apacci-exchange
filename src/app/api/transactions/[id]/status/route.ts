import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient, createSupabaseTransactionStore } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isSasPayConfigured, confirmPaymentOtp, retryPayment, SasPayError, mapSasPayErrorToUserMessage } from "@/lib/saspay";
import { verifyAndAdvanceTransaction, type SyncableTransaction } from "@/lib/transaction-sync";
import { transitionTransaction } from "@/lib/state-machine";
import { getAdminSandboxStore } from "@/lib/admin-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!isSupabaseConfigured()) {
    const sandbox = getAdminSandboxStore();
    const tx = sandbox.transactions.find((t) => t.id === id);
    if (!tx) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Transaction introuvable." } },
        { status: 404 }
      );
    }
    const events = sandbox.events.filter((e) => e.transaction_id === id);
    return NextResponse.json({
      success: true,
      data: {
        transaction: tx,
        events,
      },
    });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "unauthorized", message: "Non authentifié." } },
      { status: 401 }
    );
  }

  // Fetch transaction using user's RLS-scoped client (or admin if role === admin)
  const adminDb = createServiceRoleClient();
  const { data: profile } = await adminDb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  const { data: tx, error } = await adminDb
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !tx || (!isAdmin && tx.user_id !== user.id)) {
    return NextResponse.json(
      { success: false, error: { code: "not_found", message: "Transaction introuvable." } },
      { status: 404 }
    );
  }

  // NEVER trust browser redirect: if transaction is in a non-terminal state and SasPay is configured,
  // verify server-side against SasPay before returning the current state.
  if (
    isSasPayConfigured() &&
    ["payment_pending", "paid", "payout_pending"].includes(tx.status)
  ) {
    const store = createSupabaseTransactionStore();
    await verifyAndAdvanceTransaction(store, tx as SyncableTransaction, "system");
  }

  const [{ data: refreshedTx }, { data: events }] = await Promise.all([
    adminDb.from("transactions").select("*").eq("id", id).maybeSingle(),
    adminDb
      .from("transaction_events")
      .select("*")
      .eq("transaction_id", id)
      .order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      transaction: refreshedTx ?? tx,
      events: events ?? [],
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: { code: "supabase_not_configured" } },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "unauthorized", message: "Non authentifié." } },
      { status: 401 }
    );
  }

  const adminDb = createServiceRoleClient();
  const { data: tx } = await adminDb
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tx) {
    return NextResponse.json(
      { success: false, error: { code: "not_found", message: "Transaction introuvable." } },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");
  const store = createSupabaseTransactionStore();

  // 1. Confirm post-push OTP via POST /payments/{payment_id}/confirm-otp/
  if (action === "confirm_otp") {
    const otp = String(body.otp || "").trim();
    if (!otp || !tx.saspay_payment_id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "missing_otp", message: "Veuillez saisir le code OTP." },
        },
        { status: 400 }
      );
    }

    try {
      await confirmPaymentOtp(tx.saspay_payment_id, { otp });
      await verifyAndAdvanceTransaction(
        store,
        tx as SyncableTransaction,
        "user",
        tx.saspay_payment_id
      );
      const updated = await store.getTransactionById(id);
      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      const code = err instanceof SasPayError ? err.errorCode : "otp_confirmation_failed";
      return NextResponse.json(
        {
          success: false,
          error: { code, message: mapSasPayErrorToUserMessage(code, "fr") },
        },
        { status: 422 }
      );
    }
  }

  // 2. Retry failed inbound payment via POST /payments/{payment_id}/retry/ with Idempotency-Key
  if (action === "retry_payment") {
    if (tx.status !== "payment_failed" || !tx.saspay_payment_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "not_retryable",
            message: "Ce paiement ne peut pas être relancé.",
          },
        },
        { status: 409 }
      );
    }

    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey
        ? body.idempotencyKey
        : `apacci-payin-retry-${tx.id}-${Date.now()}`;

    try {
      await transitionTransaction(store, {
        transactionId: tx.id,
        toStatus: "retry",
        actorType: "user",
        actorId: user.id,
        reason: "User requested inbound payment retry",
      });

      const retryRes = await retryPayment(
        tx.saspay_payment_id,
        {},
        idempotencyKey
      );

      await transitionTransaction(store, {
        transactionId: tx.id,
        toStatus: "payment_pending",
        actorType: "system",
        actorId: user.id,
        reason: "Inbound payment retried via POST /payments/{id}/retry/",
        extraFields: {
          saspay_checkout_url: retryRes.checkout_url || tx.saspay_checkout_url,
          failure_code: null,
          failure_reason: null,
        },
      });

      return NextResponse.json({
        success: true,
        checkoutUrl: retryRes.checkout_url || "",
      });
    } catch (err) {
      const code = err instanceof SasPayError ? err.errorCode : "retry_failed";
      return NextResponse.json(
        {
          success: false,
          error: { code, message: mapSasPayErrorToUserMessage(code, "fr") },
        },
        { status: 422 }
      );
    }
  }

  return NextResponse.json(
    { success: false, error: { code: "unknown_action" } },
    { status: 400 }
  );
}


import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient, createSupabaseTransactionStore } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { isSasPayConfigured } from "@/lib/saspay";
import { verifyAndAdvanceTransaction, type SyncableTransaction } from "@/lib/transaction-sync";
import { logger } from "@/lib/logger";

// GET /api/cron/reconcile
// Vercel Cron endpoint running every 10 minutes (schedule: "*/10 * * * *").
// Protected with Authorization: Bearer <CRON_SECRET>.
// Re-checks transactions stuck in payment_pending, paid, or payout_pending and advances them.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";

  if (!cronSecret || cronSecret.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: { code: "cron_secret_not_configured" } },
      { status: 500 }
    );
  }

  const expected = `Bearer ${cronSecret.trim()}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  const isAuthorized = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: { code: "unauthorized", message: "Invalid CRON_SECRET." } },
      { status: 401 }
    );
  }

  if (!isSupabaseConfigured() || !isSasPayConfigured()) {
    return NextResponse.json({
      success: true,
      reconciledCount: 0,
      note: "Skipped reconciliation because Supabase or SasPay credentials are not set.",
    });
  }

  const adminDb = createServiceRoleClient();
  const store = createSupabaseTransactionStore();

  // Find transactions stuck in pending/intermediate states for at least 60 seconds
  const cutoffIso = new Date(Date.now() - 60_000).toISOString();

  const { data: stuckTransactions, error } = await adminDb
    .from("transactions")
    .select("*")
    .in("status", ["payment_pending", "paid", "payout_pending"])
    .lte("updated_at", cutoffIso)
    .order("updated_at", { ascending: true })
    .limit(40);

  if (error) {
    logger.error("Reconciliation cron query failed", { error: error.message });
    return NextResponse.json(
      { success: false, error: { code: "db_error", message: error.message } },
      { status: 500 }
    );
  }

  const results: Array<{ id: string; reference: string; before: string; after: string }> = [];

  for (const tx of stuckTransactions || []) {
    const before = tx.status as string;
    const after = await verifyAndAdvanceTransaction(
      store,
      tx as SyncableTransaction,
      "cron"
    );
    results.push({
      id: tx.id,
      reference: tx.reference,
      before,
      after,
    });
  }

  logger.info("Completed reconciliation cron run", {
    checked: results.length,
    advanced: results.filter((r) => r.before !== r.after).length,
  });

  return NextResponse.json({
    success: true,
    checkedCount: results.length,
    results,
  });
}

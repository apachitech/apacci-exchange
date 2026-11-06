import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  createSupabaseTransactionStore,
} from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getBalances,
  isSasPayConfigured,
  createWalletTransfer,
} from "@/lib/saspay";
import {
  transitionTransaction,
  type TransactionStatus,
} from "@/lib/state-machine";
import { executePayoutFromPaid } from "@/lib/payout-orchestrator";
import { adminUpdateUserSchema, updateSettingsSchema } from "@/lib/validation";
import {
  getAdminSandboxStore,
  type AdminUserRecord,
  type AdminRecipientRecord,
  type AdminTxRecord,
  type AdminWalletRecord,
  type AdminCmsContentRecord,
  type AdminCorridorOverrideRecord,
} from "@/lib/admin-store";
import { addMoney, formatMoney, parseScaled } from "@/lib/money";
import { getServerSessionCookie } from "@/lib/auth-session";
import { logger } from "@/lib/logger";

function subtractMoney(a: string, b: string): string {
  const diff = parseScaled(a) - parseScaled(b);
  return formatMoney(diff > 0n ? diff : 0n);
}

function multiplyMoneyByRate(amount: string, rate: string): string {
  const scale = 100_000_000n;
  const prod = (parseScaled(amount) * parseScaled(rate) + scale / 2n) / scale;
  return formatMoney(prod);
}

async function resolveAdminContext() {
  if (!isSupabaseConfigured()) {
    const sandbox = getAdminSandboxStore();
    const sessionCookie = await getServerSessionCookie();

    if (!sessionCookie) {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: {
              code: "unauthorized",
              message:
                "Authentification requise. Veuillez vous connecter avec un compte administrateur.",
            },
          },
          { status: 401 }
        ),
      };
    }

    const activeUser =
      sandbox.users.find((u) => u.id === sessionCookie.userId) ||
      sandbox.users.find(
        (u) => u.email.toLowerCase() === sessionCookie.email.toLowerCase()
      );

    if (!activeUser) {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: {
              code: "unauthorized",
              message:
                "Authentification requise. Veuillez vous connecter avec un compte administrateur.",
            },
          },
          { status: 401 }
        ),
      };
    }

    if (activeUser.role !== "admin") {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: {
              code: "forbidden",
              message: `Accès refusé : votre compte (${activeUser.full_name} — rôle "${activeUser.role}") n'a pas les privilèges Administrateur.`,
            },
          },
          { status: 403 }
        ),
      };
    }

    return {
      mode: "sandbox" as const,
      user: {
        id: activeUser.id,
        email: activeUser.email,
      },
      sandbox,
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: {
            code: "unauthorized",
            message: "Authentification requise.",
          },
        },
        { status: 401 }
      ),
    };
  }

  const adminDb = createServiceRoleClient();
  const { data: profile } = await adminDb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: {
            code: "forbidden",
            message: "Accès réservé aux administrateurs Apacci Exchange.",
          },
        },
        { status: 403 }
      ),
    };
  }

  return {
    mode: "supabase" as const,
    user,
    profile,
    adminDb,
    sandbox: getAdminSandboxStore(),
  };
}

export async function GET() {
  const ctx = await resolveAdminContext();
  if ("errorResponse" in ctx) return ctx.errorResponse;

  const sandbox = ctx.sandbox;

  if (ctx.mode === "sandbox") {
    let balances = sandbox.wallets;
    if (isSasPayConfigured()) {
      try {
        const balRes = await getBalances(1, 100);
        if (balRes.results && balRes.results.length > 0) {
          balances = balRes.results.map((b) => ({
            id: b.id,
            country: b.country,
            currency: b.currency,
            available_amount: b.available_amount,
            pending_amount: b.pending_amount,
            is_frozen: b.is_frozen,
            updated_at: b.updated_at,
          }));
        }
      } catch {
        // Keep sandbox wallets
      }
    }

    return NextResponse.json({
      success: true,
      mode: "sandbox",
      data: {
        transactions: sandbox.transactions,
        users: sandbox.users,
        recipients: sandbox.recipients,
        balances,
        walletTransfers: sandbox.walletTransfers,
        cmsContents: sandbox.cmsContents,
        corridorOverrides: sandbox.corridorOverrides,
        settings: sandbox.settings,
        events: sandbox.events,
        webhooks: sandbox.webhooks,
      },
    });
  }

  // Supabase mode
  const { adminDb } = ctx;
  const [
    { data: transactions },
    { data: users },
    { data: recipients },
    { data: settings },
    { data: events },
    { data: webhooks },
    { data: cmsContents },
    { data: corridorOverrides },
    { data: walletLedger },
  ] = await Promise.all([
    adminDb
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    adminDb
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    adminDb
      .from("recipients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    adminDb.from("settings").select("*").eq("id", 1).maybeSingle(),
    adminDb
      .from("transaction_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    adminDb
      .from("webhook_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    adminDb
      .from("cms_contents")
      .select("*")
      .order("priority", { ascending: true }),
    adminDb
      .from("corridor_overrides")
      .select("*")
      .order("iso_code", { ascending: true }),
    adminDb
      .from("wallet_ledger")
      .select("*")
      .order("country", { ascending: true }),
  ]);

  let balances: unknown[] = walletLedger || sandbox.wallets;
  if (isSasPayConfigured()) {
    try {
      const balRes = await getBalances(1, 100);
      if (balRes.results && balRes.results.length > 0) {
        balances = balRes.results;
      }
    } catch {
      // Fallback to wallet_ledger
    }
  }

  return NextResponse.json({
    success: true,
    mode: "supabase",
    data: {
      transactions: transactions || [],
      users: users || [],
      recipients: recipients || [],
      settings: settings || sandbox.settings,
      events: events || [],
      webhooks: webhooks || [],
      balances,
      walletTransfers: sandbox.walletTransfers,
      cmsContents: cmsContents || sandbox.cmsContents,
      corridorOverrides: corridorOverrides || sandbox.corridorOverrides,
    },
  });
}

export async function POST(request: Request) {
  const ctx = await resolveAdminContext();
  if ("errorResponse" in ctx) return ctx.errorResponse;
  const { user, sandbox } = ctx;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "invalid_json", message: "Corps JSON invalide." },
      },
      { status: 400 }
    );
  }

  const action = String(body.action || "");
  const now = new Date().toISOString();

  // Helper to append an audit event
  const recordAudit = (
    transactionId: string,
    fromStatus: string | null,
    toStatus: string,
    reason: string
  ) => {
    sandbox.events.unshift({
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      transaction_id: transactionId,
      from_status: fromStatus,
      to_status: toStatus,
      actor_type: "admin",
      reason,
      created_at: now,
    });
  };

  // ============================================================================
  // 1. TRANSACTIONS CRUD & LIFECYCLE MANAGEMENT
  // ============================================================================

  if (action === "create_transaction") {
    const p = (body.payload || {}) as Record<string, unknown>;
    const sendAmount = String(p.send_amount || "25000.00").includes(".")
      ? String(p.send_amount || "25000.00")
      : `${p.send_amount}.00`;
    const feeAmount = String(p.fee_amount || "625.00").includes(".")
      ? String(p.fee_amount || "625.00")
      : `${p.fee_amount}.00`;
    const exchangeRate = String(p.exchange_rate || "1.00000000");
    const totalCharged = addMoney(sendAmount, feeAmount);
    const payoutAmount = multiplyMoneyByRate(sendAmount, exchangeRate);

    const newTx: AdminTxRecord = {
      id: `tx-${Date.now()}`,
      reference:
        String(p.reference || "").trim() ||
        `APC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
          1000 + Math.random() * 9000
        )}`,
      user_id: String(p.user_id || sandbox.users[0]?.id || "usr-client-002"),
      recipient_id: String(p.recipient_id || sandbox.recipients[0]?.id || "rec-001"),
      sender_country: "CI",
      sender_currency: "XOF",
      destination_country: String(p.destination_country || "ML").toUpperCase(),
      destination_currency: String(p.destination_currency || "XOF").toUpperCase(),
      destination_network: String(p.destination_network || "orange_ml"),
      destination_network_name: String(
        p.destination_network_name || p.destination_network || "Orange Money"
      ),
      recipient_name: String(p.recipient_name || "Bénéficiaire"),
      recipient_msisdn: String(p.recipient_msisdn || "+22370000000"),
      send_amount: sendAmount,
      fee_amount: feeAmount,
      total_charged: totalCharged,
      net_send_amount: sendAmount,
      exchange_rate: exchangeRate,
      payout_amount: payoutAmount,
      fee_charge_mode: "ADD_ON",
      status: (p.status as TransactionStatus) || "created",
      failure_code: null,
      failure_reason: null,
      created_at: now,
    };

    if (ctx.mode === "supabase") {
      const { data, error } = await ctx.adminDb
        .from("transactions")
        .insert({
          reference: newTx.reference,
          user_id: newTx.user_id,
          recipient_id: newTx.recipient_id,
          sender_country: newTx.sender_country,
          sender_currency: newTx.sender_currency,
          destination_country: newTx.destination_country,
          destination_currency: newTx.destination_currency,
          destination_network: newTx.destination_network,
          destination_network_name: newTx.destination_network_name,
          recipient_name: newTx.recipient_name,
          recipient_msisdn: newTx.recipient_msisdn,
          send_amount: newTx.send_amount,
          fee_amount: newTx.fee_amount,
          total_charged: newTx.total_charged,
          net_send_amount: newTx.net_send_amount,
          exchange_rate: newTx.exchange_rate,
          payout_amount: newTx.payout_amount,
          fee_charge_mode: newTx.fee_charge_mode,
          status: newTx.status,
          payment_idempotency_key: `admin-tx-${Date.now()}`,
        })
        .select("*")
        .single();
      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data });
    }

    sandbox.transactions.unshift(newTx);
    recordAudit(
      newTx.id,
      null,
      newTx.status,
      `Admin (${user.email}) created transaction ${newTx.reference}`
    );
    return NextResponse.json({ success: true, data: newTx });
  }

  if (action === "update_transaction") {
    const txId = String(body.transactionId || "");
    const p = (body.payload || {}) as Record<string, unknown>;

    if (ctx.mode === "supabase") {
      const { data, error } = await ctx.adminDb
        .from("transactions")
        .update({
          recipient_name: p.recipient_name,
          recipient_msisdn: p.recipient_msisdn,
          destination_network: p.destination_network,
          destination_network_name: p.destination_network_name,
          status: p.status,
          failure_code: p.failure_code ?? null,
          failure_reason: p.failure_reason ?? null,
          updated_at: now,
        })
        .eq("id", txId)
        .select("*")
        .single();
      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data });
    }

    const idx = sandbox.transactions.findIndex((t) => t.id === txId);
    if (idx === -1) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Transaction introuvable." } },
        { status: 404 }
      );
    }

    const prev = sandbox.transactions[idx];
    const nextStatus = (p.status as TransactionStatus) || prev.status;
    sandbox.transactions[idx] = {
      ...prev,
      recipient_name:
        p.recipient_name !== undefined ? String(p.recipient_name) : prev.recipient_name,
      recipient_msisdn:
        p.recipient_msisdn !== undefined
          ? String(p.recipient_msisdn)
          : prev.recipient_msisdn,
      destination_country:
        p.destination_country !== undefined
          ? String(p.destination_country).toUpperCase()
          : prev.destination_country,
      destination_currency:
        p.destination_currency !== undefined
          ? String(p.destination_currency).toUpperCase()
          : prev.destination_currency,
      destination_network:
        p.destination_network !== undefined
          ? String(p.destination_network)
          : prev.destination_network,
      destination_network_name:
        p.destination_network_name !== undefined
          ? String(p.destination_network_name)
          : prev.destination_network_name,
      status: nextStatus,
      failure_code:
        p.failure_code !== undefined
          ? (p.failure_code as string | null)
          : prev.failure_code,
      failure_reason:
        p.failure_reason !== undefined
          ? (p.failure_reason as string | null)
          : prev.failure_reason,
    };

    if (prev.status !== nextStatus) {
      recordAudit(
        txId,
        prev.status,
        nextStatus,
        `Admin updated transaction ${prev.reference} status to ${nextStatus}`
      );
    }

    return NextResponse.json({ success: true, data: sandbox.transactions[idx] });
  }

  if (action === "delete_transaction") {
    const txId = String(body.transactionId || "");
    if (ctx.mode === "supabase") {
      const { error } = await ctx.adminDb.from("transactions").delete().eq("id", txId);
      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }
    sandbox.transactions = sandbox.transactions.filter((t) => t.id !== txId);
    return NextResponse.json({ success: true });
  }

  // Retry failed payout (`payout_failed` -> `retry` -> `payout_pending` / `completed`)
  if (action === "retry_payout") {
    const transactionId = String(body.transactionId || "");
    if (!transactionId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "missing_tx_id", message: "ID de transaction manquant." },
        },
        { status: 400 }
      );
    }

    if (ctx.mode === "supabase") {
      const store = createSupabaseTransactionStore();
      await transitionTransaction(store, {
        transactionId,
        toStatus: "retry",
        actorType: "admin",
        actorId: user.id,
        reason: "Admin triggered manual payout retry",
        metadata: { admin_email: user.email },
        extraFields: { saspay_payout_id: null },
      });

      const payoutResult = await executePayoutFromPaid(store, {
        transactionId,
        actorType: "admin",
        actorId: user.id,
      });

      return NextResponse.json({
        success: true,
        data: payoutResult,
      });
    }

    const tx = sandbox.transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Transaction introuvable." } },
        { status: 404 }
      );
    }

    recordAudit(tx.id, tx.status, "retry", "Admin triggered manual payout retry");
    recordAudit(
      tx.id,
      "retry",
      "completed",
      "Sandbox SasPay payout retry succeeded with fresh Idempotency-Key"
    );
    tx.status = "completed";
    tx.failure_code = null;
    tx.failure_reason = null;

    return NextResponse.json({
      success: true,
      data: { status: tx.status, transaction: tx },
    });
  }

  // Mark transaction status (`refunded`, `manual_review`, `completed`, `paid`)
  if (action === "set_status") {
    const transactionId = String(body.transactionId || "");
    const toStatus = String(body.toStatus || "") as TransactionStatus;
    const reason = String(body.reason || `Admin updated status to ${toStatus}`);

    if (ctx.mode === "supabase") {
      const store = createSupabaseTransactionStore();
      const res = await transitionTransaction(store, {
        transactionId,
        toStatus,
        actorType: "admin",
        actorId: user.id,
        reason,
        metadata: { admin_email: user.email },
      });
      return NextResponse.json({ success: true, data: res });
    }

    const tx = sandbox.transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Transaction introuvable." } },
        { status: 404 }
      );
    }

    recordAudit(tx.id, tx.status, toStatus, reason);
    tx.status = toStatus;
    return NextResponse.json({ success: true, data: tx });
  }

  if (action === "trigger_reconciliation") {
    let reconciledCount = 0;
    for (const tx of sandbox.transactions) {
      if (tx.status === "payment_pending" || tx.status === "paid" || tx.status === "payout_pending") {
        const prev = tx.status;
        tx.status = "completed";
        reconciledCount++;
        recordAudit(
          tx.id,
          prev,
          "completed",
          "Admin manual reconciliation verified transaction with SasPay"
        );
      }
    }
    return NextResponse.json({
      success: true,
      data: { reconciledCount },
    });
  }

  // ============================================================================
  // 2. USERS & KYC CRUD (`profiles`)
  // ============================================================================

  if (action === "create_user") {
    const p = (body.payload || {}) as Record<string, unknown>;
    const email = String(p.email || "").trim().toLowerCase();
    const fullName = String(p.full_name || "").trim();

    if (!email || !fullName) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "validation_error", message: "Nom complet et email requis." },
        },
        { status: 400 }
      );
    }

    const newUser: AdminUserRecord = {
      id: `usr-${Date.now()}`,
      email,
      full_name: fullName,
      phone: String(p.phone || "+2250700000000"),
      country_code: String(p.country_code || "CI").toUpperCase(),
      role: p.role === "admin" ? "admin" : "client",
      kyc_status:
        (p.kyc_status as AdminUserRecord["kyc_status"]) || "unverified",
      custom_tx_limit_xof: p.custom_tx_limit_xof
        ? String(p.custom_tx_limit_xof)
        : null,
      custom_monthly_limit_xof: p.custom_monthly_limit_xof
        ? String(p.custom_monthly_limit_xof)
        : null,
      created_at: now,
    };

    if (ctx.mode === "supabase") {
      const { data, error } = await ctx.adminDb
        .from("profiles")
        .insert({
          id: crypto.randomUUID(),
          email: newUser.email,
          full_name: newUser.full_name,
          phone: newUser.phone,
          country_code: newUser.country_code,
          role: newUser.role,
          kyc_status: newUser.kyc_status,
          custom_tx_limit_xof: newUser.custom_tx_limit_xof,
          custom_monthly_limit_xof: newUser.custom_monthly_limit_xof,
        })
        .select("*")
        .single();
      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data });
    }

    sandbox.users.unshift(newUser);
    logger.info("Admin created user profile", {
      adminId: user.id,
      createdEmail: newUser.email,
      role: newUser.role,
    });
    return NextResponse.json({ success: true, data: newUser });
  }

  if (action === "update_user" || action === "update_user_kyc") {
    const targetUserId = String(body.userId || "");
    const p = (body.payload || {}) as Record<string, unknown>;

    if (!targetUserId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "validation_error", message: "ID utilisateur requis." },
        },
        { status: 400 }
      );
    }

    if (ctx.mode === "supabase") {
      const updateFields: Record<string, unknown> = { updated_at: now };
      if (p.full_name !== undefined) updateFields.full_name = p.full_name;
      if (p.email !== undefined) updateFields.email = p.email;
      if (p.phone !== undefined) updateFields.phone = p.phone;
      if (p.country_code !== undefined) updateFields.country_code = p.country_code;
      if (p.role !== undefined) updateFields.role = p.role;
      if (p.kycStatus !== undefined || p.kyc_status !== undefined) {
        updateFields.kyc_status = p.kycStatus || p.kyc_status;
      }
      if (p.kyc_rejection_reason !== undefined) {
        updateFields.kyc_rejection_reason = p.kyc_rejection_reason;
      }
      if (p.kyc_provisioned !== undefined) {
        updateFields.kyc_provisioned = Boolean(p.kyc_provisioned);
      }
      if (p.customTxLimitXof !== undefined || p.custom_tx_limit_xof !== undefined) {
        updateFields.custom_tx_limit_xof =
          p.customTxLimitXof ?? p.custom_tx_limit_xof ?? null;
      }
      if (
        p.customMonthlyLimitXof !== undefined ||
        p.custom_monthly_limit_xof !== undefined
      ) {
        updateFields.custom_monthly_limit_xof =
          p.customMonthlyLimitXof ?? p.custom_monthly_limit_xof ?? null;
      }

      const { data: updatedProfile, error } = await ctx.adminDb
        .from("profiles")
        .update(updateFields)
        .eq("id", targetUserId)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data: updatedProfile });
    }

    const idx = sandbox.users.findIndex((u) => u.id === targetUserId);
    if (idx === -1) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Utilisateur introuvable." } },
        { status: 404 }
      );
    }

    const prev = sandbox.users[idx];
    sandbox.users[idx] = {
      ...prev,
      full_name: p.full_name !== undefined ? String(p.full_name) : prev.full_name,
      email: p.email !== undefined ? String(p.email) : prev.email,
      phone: p.phone !== undefined ? String(p.phone) : prev.phone,
      country_code:
        p.country_code !== undefined
          ? String(p.country_code).toUpperCase()
          : prev.country_code,
      role:
        p.role === "admin" || p.role === "client" ? p.role : prev.role,
      kyc_status:
        ((p.kycStatus || p.kyc_status) as AdminUserRecord["kyc_status"]) ||
        prev.kyc_status,
      kyc_provisioned:
        p.kyc_provisioned !== undefined
          ? Boolean(p.kyc_provisioned)
          : (p.kycStatus || p.kyc_status) === "verified"
          ? true
          : (p.kycStatus || p.kyc_status) === "rejected" ||
            (p.kycStatus || p.kyc_status) === "unverified"
          ? false
          : prev.kyc_provisioned,
      kyc_rejection_reason:
        p.kyc_rejection_reason !== undefined
          ? p.kyc_rejection_reason
            ? String(p.kyc_rejection_reason)
            : null
          : prev.kyc_rejection_reason,
      custom_tx_limit_xof:
        p.custom_tx_limit_xof !== undefined
          ? p.custom_tx_limit_xof
            ? String(p.custom_tx_limit_xof)
            : null
          : p.customTxLimitXof !== undefined
          ? p.customTxLimitXof
            ? String(p.customTxLimitXof)
            : null
          : prev.custom_tx_limit_xof,
      custom_monthly_limit_xof:
        p.custom_monthly_limit_xof !== undefined
          ? p.custom_monthly_limit_xof
            ? String(p.custom_monthly_limit_xof)
            : null
          : p.customMonthlyLimitXof !== undefined
          ? p.customMonthlyLimitXof
            ? String(p.customMonthlyLimitXof)
            : null
          : prev.custom_monthly_limit_xof,
    };

    return NextResponse.json({ success: true, data: sandbox.users[idx] });
  }

  if (action === "delete_user") {
    const targetUserId = String(body.userId || "");
    if (ctx.mode === "supabase") {
      const { error } = await ctx.adminDb
        .from("profiles")
        .delete()
        .eq("id", targetUserId);
      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }
    sandbox.users = sandbox.users.filter((u) => u.id !== targetUserId);
    return NextResponse.json({ success: true });
  }

  // ============================================================================
  // 3. RECIPIENTS CRUD (`recipients`)
  // ============================================================================

  if (action === "create_recipient") {
    const p = (body.payload || {}) as Record<string, unknown>;
    const newRec: AdminRecipientRecord = {
      id: `rec-${Date.now()}`,
      user_id: String(p.user_id || sandbox.users[0]?.id || "usr-client-002"),
      full_name: String(p.full_name || "").trim(),
      country_code: String(p.country_code || "ML").toUpperCase(),
      currency: String(p.currency || "XOF").toUpperCase(),
      network_code: String(p.network_code || "orange_ml"),
      network_name: String(p.network_name || p.network_code || "Orange Money"),
      msisdn: String(p.msisdn || "").trim(),
      is_active: p.is_active !== false,
      created_at: now,
    };

    if (!newRec.full_name || !newRec.msisdn) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "validation_error", message: "Nom et numéro MSISDN requis." },
        },
        { status: 400 }
      );
    }

    if (ctx.mode === "supabase") {
      const { data, error } = await ctx.adminDb
        .from("recipients")
        .insert({
          user_id: newRec.user_id,
          full_name: newRec.full_name,
          country_code: newRec.country_code,
          currency: newRec.currency,
          network_code: newRec.network_code,
          network_name: newRec.network_name,
          msisdn: newRec.msisdn,
          is_active: newRec.is_active,
        })
        .select("*")
        .single();
      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data });
    }

    sandbox.recipients.unshift(newRec);
    return NextResponse.json({ success: true, data: newRec });
  }

  if (action === "update_recipient") {
    const recipientId = String(body.recipientId || "");
    const p = (body.payload || {}) as Record<string, unknown>;

    if (ctx.mode === "supabase") {
      const { data, error } = await ctx.adminDb
        .from("recipients")
        .update({
          full_name: p.full_name,
          country_code: p.country_code,
          currency: p.currency,
          network_code: p.network_code,
          network_name: p.network_name,
          msisdn: p.msisdn,
          is_active: p.is_active,
          updated_at: now,
        })
        .eq("id", recipientId)
        .select("*")
        .single();
      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data });
    }

    const idx = sandbox.recipients.findIndex((r) => r.id === recipientId);
    if (idx === -1) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Bénéficiaire introuvable." } },
        { status: 404 }
      );
    }

    const prev = sandbox.recipients[idx];
    sandbox.recipients[idx] = {
      ...prev,
      full_name: p.full_name !== undefined ? String(p.full_name) : prev.full_name,
      country_code:
        p.country_code !== undefined
          ? String(p.country_code).toUpperCase()
          : prev.country_code,
      currency:
        p.currency !== undefined
          ? String(p.currency).toUpperCase()
          : prev.currency,
      network_code:
        p.network_code !== undefined ? String(p.network_code) : prev.network_code,
      network_name:
        p.network_name !== undefined ? String(p.network_name) : prev.network_name,
      msisdn: p.msisdn !== undefined ? String(p.msisdn) : prev.msisdn,
      is_active:
        p.is_active !== undefined ? Boolean(p.is_active) : prev.is_active,
    };

    return NextResponse.json({ success: true, data: sandbox.recipients[idx] });
  }

  if (action === "delete_recipient") {
    const recipientId = String(body.recipientId || "");
    if (ctx.mode === "supabase") {
      const { error } = await ctx.adminDb
        .from("recipients")
        .delete()
        .eq("id", recipientId);
      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }
    sandbox.recipients = sandbox.recipients.filter((r) => r.id !== recipientId);
    return NextResponse.json({ success: true });
  }

  // ============================================================================
  // 4. WALLETS & INTER-WALLET TRANSFERS CRUD (`wallet_ledger` & SasPay)
  // ============================================================================

  if (action === "create_wallet") {
    const p = (body.payload || {}) as Record<string, unknown>;
    const country = String(p.country || "").toUpperCase();
    const currency = String(p.currency || "XOF").toUpperCase();
    const available = String(p.available_amount || "0.00").includes(".")
      ? String(p.available_amount || "0.00")
      : `${p.available_amount}.00`;
    const pending = String(p.pending_amount || "0.00").includes(".")
      ? String(p.pending_amount || "0.00")
      : `${p.pending_amount}.00`;

    if (!country || country.length !== 2) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "validation_error", message: "Code pays ISO-2 requis (ex: CI, ML, ZA)." },
        },
        { status: 400 }
      );
    }

    const existing = sandbox.wallets.findIndex((w) => w.country === country);
    const newWallet: AdminWalletRecord = {
      id: existing >= 0 ? sandbox.wallets[existing].id : `wal-${country.toLowerCase()}`,
      country,
      currency,
      available_amount: available,
      pending_amount: pending,
      is_frozen: Boolean(p.is_frozen),
      updated_at: now,
    };

    if (existing >= 0) {
      sandbox.wallets[existing] = newWallet;
    } else {
      sandbox.wallets.push(newWallet);
    }

    return NextResponse.json({ success: true, data: newWallet });
  }

  if (action === "update_wallet") {
    const walletId = String(body.walletId || "");
    const p = (body.payload || {}) as Record<string, unknown>;
    const idx = sandbox.wallets.findIndex(
      (w) => w.id === walletId || w.country === walletId.toUpperCase()
    );
    if (idx === -1) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Wallet introuvable." } },
        { status: 404 }
      );
    }

    const prev = sandbox.wallets[idx];
    const fmt = (val: unknown, fallback: string) => {
      if (val === undefined || val === null || val === "") return fallback;
      const s = String(val).trim();
      return s.includes(".") ? s : `${s}.00`;
    };

    sandbox.wallets[idx] = {
      ...prev,
      currency:
        p.currency !== undefined
          ? String(p.currency).toUpperCase()
          : prev.currency,
      available_amount: fmt(p.available_amount, prev.available_amount),
      pending_amount: fmt(p.pending_amount, prev.pending_amount),
      is_frozen:
        p.is_frozen !== undefined ? Boolean(p.is_frozen) : prev.is_frozen,
      updated_at: now,
    };

    return NextResponse.json({ success: true, data: sandbox.wallets[idx] });
  }

  if (action === "delete_wallet") {
    const walletId = String(body.walletId || "");
    sandbox.wallets = sandbox.wallets.filter((w) => w.id !== walletId);
    return NextResponse.json({ success: true });
  }

  // Inter-Wallet Transfer (`POST /wallet-transfers/` with `Idempotency-Key`)
  if (action === "inter_wallet_transfer") {
    const sourceCountry = String(body.sourceCountry || "").toUpperCase();
    const destinationCountry = String(body.destinationCountry || "").toUpperCase();
    const rawAmount = String(body.amount || "").trim();
    const idempotencyKey = String(body.idempotencyKey || crypto.randomUUID());

    if (!sourceCountry || !destinationCountry || !rawAmount) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "validation_error",
            message: "Pays source, pays destination et montant décimal requis.",
          },
        },
        { status: 400 }
      );
    }

    const amount = rawAmount.includes(".") ? rawAmount : `${rawAmount}.00`;

    if (isSasPayConfigured()) {
      try {
        const result = await createWalletTransfer(
          {
            from_country: sourceCountry,
            to_country: destinationCountry,
            from_amount: amount,
          },
          idempotencyKey
        );

        sandbox.walletTransfers.unshift({
          id: result.id,
          from_country: result.from_country,
          from_currency: result.from_currency,
          to_country: result.to_country,
          to_currency: result.to_currency,
          from_amount: result.from_amount,
          exchange_rate: result.exchange_rate,
          to_amount: result.to_amount,
          status: result.status,
          idempotency_key: idempotencyKey,
          created_at: result.created_at || now,
        });

        return NextResponse.json({ success: true, data: result });
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "wallet_transfer_error",
              message:
                err instanceof Error
                  ? err.message
                  : "Échec du transfert inter-wallet SasPay.",
            },
          },
          { status: 502 }
        );
      }
    }

    // Sandbox execution: debit source wallet, credit destination wallet
    const srcWallet = sandbox.wallets.find((w) => w.country === sourceCountry);
    const dstWallet = sandbox.wallets.find((w) => w.country === destinationCountry);

    const corrOverride = sandbox.corridorOverrides.find(
      (c) => c.iso_code === destinationCountry
    );
    const fxRate = corrOverride ? corrOverride.custom_rate_from_xof : "1.00000000";
    const convertedAmount = multiplyMoneyByRate(amount, fxRate);

    if (srcWallet) {
      try {
        srcWallet.available_amount = subtractMoney(srcWallet.available_amount, amount);
        srcWallet.updated_at = now;
      } catch {
        // Keep current balance if insufficient in demo
      }
    }

    if (dstWallet) {
      dstWallet.available_amount = addMoney(
        dstWallet.available_amount,
        convertedAmount
      );
      dstWallet.updated_at = now;
    } else {
      sandbox.wallets.push({
        id: `wal-${destinationCountry.toLowerCase()}`,
        country: destinationCountry,
        currency: corrOverride?.currency || "XOF",
        available_amount: convertedAmount,
        pending_amount: "0.00",
        is_frozen: false,
        updated_at: now,
      });
    }

    const transferRecord = {
      id: `wt-${Date.now()}`,
      from_country: sourceCountry,
      from_currency: srcWallet?.currency || "XOF",
      to_country: destinationCountry,
      to_currency: dstWallet?.currency || corrOverride?.currency || "XOF",
      from_amount: amount,
      exchange_rate: fxRate,
      to_amount: convertedAmount,
      status: "COMPLETED",
      idempotency_key: idempotencyKey,
      created_at: now,
    };

    sandbox.walletTransfers.unshift(transferRecord);
    return NextResponse.json({ success: true, data: transferRecord });
  }

  // ============================================================================
  // 5. CMS / SITE CONTENTS CRUD (`cms_contents`)
  // ============================================================================

  if (action === "create_content") {
    const p = (body.payload || {}) as Record<string, unknown>;
    const titleFr = String(p.title_fr || "").trim();
    const bodyFr = String(p.body_fr || "").trim();

    if (!titleFr || !bodyFr) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "validation_error",
            message: "Le titre (FR) et le contenu (FR) sont obligatoires.",
          },
        },
        { status: 400 }
      );
    }

    const slug =
      String(p.slug || "").trim() ||
      titleFr
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
        `-${Date.now().toString().slice(-4)}`;

    const newItem: AdminCmsContentRecord = {
      id: `cms-${Date.now()}`,
      slug,
      category:
        (p.category as AdminCmsContentRecord["category"]) || "announcement",
      title_fr: titleFr,
      title_en: String(p.title_en || titleFr).trim(),
      body_fr: bodyFr,
      body_en: String(p.body_en || bodyFr).trim(),
      is_published: p.is_published !== false,
      priority: Number(p.priority ?? 10),
      created_at: now,
      updated_at: now,
    };

    if (ctx.mode === "supabase") {
      const { data, error } = await ctx.adminDb
        .from("cms_contents")
        .insert({
          slug: newItem.slug,
          category: newItem.category,
          title_fr: newItem.title_fr,
          title_en: newItem.title_en,
          body_fr: newItem.body_fr,
          body_en: newItem.body_en,
          is_published: newItem.is_published,
          priority: newItem.priority,
          updated_by: user.id,
        })
        .select("*")
        .single();
      if (!error && data) {
        return NextResponse.json({ success: true, data });
      }
    }

    sandbox.cmsContents.unshift(newItem);
    return NextResponse.json({ success: true, data: newItem });
  }

  if (action === "update_content") {
    const contentId = String(body.contentId || "");
    const p = (body.payload || {}) as Record<string, unknown>;

    const idx = sandbox.cmsContents.findIndex((c) => c.id === contentId);
    if (idx >= 0) {
      const prev = sandbox.cmsContents[idx];
      sandbox.cmsContents[idx] = {
        ...prev,
        slug: p.slug !== undefined ? String(p.slug) : prev.slug,
        category:
          (p.category as AdminCmsContentRecord["category"]) || prev.category,
        title_fr: p.title_fr !== undefined ? String(p.title_fr) : prev.title_fr,
        title_en: p.title_en !== undefined ? String(p.title_en) : prev.title_en,
        body_fr: p.body_fr !== undefined ? String(p.body_fr) : prev.body_fr,
        body_en: p.body_en !== undefined ? String(p.body_en) : prev.body_en,
        is_published:
          p.is_published !== undefined
            ? Boolean(p.is_published)
            : prev.is_published,
        priority:
          p.priority !== undefined ? Number(p.priority) : prev.priority,
        updated_at: now,
      };
      return NextResponse.json({ success: true, data: sandbox.cmsContents[idx] });
    }

    if (ctx.mode === "supabase") {
      const { data, error } = await ctx.adminDb
        .from("cms_contents")
        .update({
          ...p,
          updated_by: user.id,
          updated_at: now,
        })
        .eq("id", contentId)
        .select("*")
        .single();
      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json(
      { success: false, error: { code: "not_found", message: "Contenu introuvable." } },
      { status: 404 }
    );
  }

  if (action === "delete_content") {
    const contentId = String(body.contentId || "");
    sandbox.cmsContents = sandbox.cmsContents.filter((c) => c.id !== contentId);
    if (ctx.mode === "supabase") {
      await ctx.adminDb.from("cms_contents").delete().eq("id", contentId);
    }
    return NextResponse.json({ success: true });
  }

  // ============================================================================
  // 6. CORRIDORS & EXCHANGE RATES CRUD (`corridor_overrides`)
  // ============================================================================

  if (action === "upsert_corridor") {
    const p = (body.payload || {}) as Record<string, unknown>;
    const isoCode = String(p.iso_code || "").toUpperCase();
    if (!isoCode || isoCode.length !== 2) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "validation_error", message: "Code pays ISO-2 requis." },
        },
        { status: 400 }
      );
    }

    const existingIdx = sandbox.corridorOverrides.findIndex(
      (c) => c.iso_code === isoCode
    );
    const record: AdminCorridorOverrideRecord = {
      id:
        existingIdx >= 0
          ? sandbox.corridorOverrides[existingIdx].id
          : `corr-${isoCode.toLowerCase()}`,
      iso_code: isoCode,
      country_name: String(
        p.country_name ||
          (existingIdx >= 0
            ? sandbox.corridorOverrides[existingIdx].country_name
            : isoCode)
      ),
      currency: String(
        p.currency ||
          (existingIdx >= 0
            ? sandbox.corridorOverrides[existingIdx].currency
            : "XOF")
      ).toUpperCase(),
      custom_rate_from_xof: String(p.custom_rate_from_xof || "1.00000000"),
      fee_spread_percent: String(p.fee_spread_percent || "0.000"),
      is_enabled: p.is_enabled !== false,
      payout_rail_note: String(p.payout_rail_note || ""),
      updated_at: now,
    };

    if (existingIdx >= 0) {
      sandbox.corridorOverrides[existingIdx] = record;
    } else {
      sandbox.corridorOverrides.push(record);
    }

    return NextResponse.json({ success: true, data: record });
  }

  if (action === "delete_corridor") {
    const corridorId = String(body.corridorId || "");
    sandbox.corridorOverrides = sandbox.corridorOverrides.filter(
      (c) => c.id !== corridorId && c.iso_code !== corridorId.toUpperCase()
    );
    return NextResponse.json({ success: true });
  }

  // ============================================================================
  // 7. GLOBAL PLATFORM SETTINGS (`settings`)
  // ============================================================================

  if (action === "update_settings") {
    const parsed = updateSettingsSchema.safeParse(body.settings);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "validation_error",
            message:
              parsed.error.issues[0]?.message || "Paramètres invalides.",
          },
        },
        { status: 400 }
      );
    }

    const s = parsed.data;
    sandbox.settings = {
      fee_charge_mode: s.feeChargeMode,
      platform_fee_percent: s.platformFeePercent,
      platform_fee_fixed_xof: s.platformFeeFixedXof,
      unverified_tx_limit_xof: s.unverifiedTxLimitXof,
      unverified_monthly_limit_xof: s.unverifiedMonthlyLimitXof,
      verified_tx_limit_xof: s.verifiedTxLimitXof,
      verified_monthly_limit_xof: s.verifiedMonthlyLimitXof,
    };

    if (ctx.mode === "supabase") {
      const { data: updated, error } = await ctx.adminDb
        .from("settings")
        .update({
          fee_charge_mode: s.feeChargeMode,
          platform_fee_percent: s.platformFeePercent,
          platform_fee_fixed_xof: s.platformFeeFixedXof,
          unverified_tx_limit_xof: s.unverifiedTxLimitXof,
          unverified_monthly_limit_xof: s.unverifiedMonthlyLimitXof,
          verified_tx_limit_xof: s.verifiedTxLimitXof,
          verified_monthly_limit_xof: s.verifiedMonthlyLimitXof,
          updated_by: user.id,
          updated_at: now,
        })
        .eq("id", 1)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "db_error", message: error.message } },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: updated });
    }

    logger.info("Admin updated global platform settings", {
      adminId: user.id,
      settings: s,
    });

    return NextResponse.json({ success: true, data: sandbox.settings });
  }

  return NextResponse.json(
    {
      success: false,
      error: { code: "unknown_action", message: `Action admin inconnue: ${action}` },
    },
    { status: 400 }
  );
}

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient, createSupabaseTransactionStore } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createTransactionSchema } from "@/lib/validation";
import {
  getDynamicCorridors,
  computeCrossExchangeRate,
  convertAmountToXof,
} from "@/lib/corridors";
import {
  addMoney,
  calculateQuote,
  compareMoney,
  findMatchingTier,
  type FeeChargeMode,
} from "@/lib/money";
import {
  createCheckoutSession,
  createSoftpayPayment,
  mapSasPayErrorToUserMessage,
  SasPayError,
} from "@/lib/saspay";
import { transitionTransaction } from "@/lib/state-machine";
import { getAdminSandboxStore } from "@/lib/admin-store";
import { getServerSessionCookie } from "@/lib/auth-session";
import { isSasPayConfigured } from "@/lib/saspay";
import { logger } from "@/lib/logger";

export async function GET() {
  if (!isSupabaseConfigured()) {
    const sessionCookie = await getServerSessionCookie();
    if (!sessionCookie) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "unauthorized",
            message:
              "Authentification requise. Veuillez vous connecter pour consulter vos transactions.",
          },
        },
        { status: 401 }
      );
    }

    const sandbox = getAdminSandboxStore();
    const userTxs =
      sessionCookie.role === "admin"
        ? sandbox.transactions
        : sandbox.transactions.filter((tx) => tx.user_id === sessionCookie.userId);
    return NextResponse.json({ success: true, data: userTxs });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "unauthorized", message: "Veuillez vous connecter." } },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "db_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit({
    key: `payment:${ip}`,
    limit: 10,
    windowMs: 60_000,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "rate_limited",
          message: "Trop de tentatives de paiement. Veuillez patienter une minute.",
        },
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "invalid_json", message: "Corps JSON invalide." } },
      { status: 400 }
    );
  }

  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message || "Données invalides.",
        },
      },
      { status: 400 }
    );
  }

  const {
    sendAmount,
    senderCountry: requestedSenderCountry,
    destinationCountry,
    destinationNetwork,
    paymentMethod,
    senderNetwork,
    senderPhone,
    virtualCardProvider,
    cardHolderName,
    prepaymentOtp,
    recipientId,
    newRecipient,
    idempotencyKey,
  } = parsed.data;

  // Re-compute quote and validate sender & destination corridors on the server
  const corridors = await getDynamicCorridors();
  const sender =
    corridors.senders.find((c) => c.isoCode === requestedSenderCountry) ||
    corridors.senderCountry;
  const dest = corridors.destinations.find(
    (c) => c.isoCode === destinationCountry
  );

  if (!dest || !dest.isDestinationAvailable) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "corridor_unavailable",
          message: `Le corridor vers ${destinationCountry} n'est pas actif.`,
        },
      },
      { status: 422 }
    );
  }

  const net = dest.networks.find(
    (n) => n.code === destinationNetwork && n.payoutAvailable
  );

  if (!net) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "invalid_method",
          message: "Le réseau mobile money sélectionné n'est pas disponible.",
        },
      },
      { status: 422 }
    );
  }

  const crossExchangeRate = computeCrossExchangeRate(sender, dest);
  const sendAmountInXof = convertAmountToXof(sendAmount, sender);

  // Sandbox mode fallback when Supabase is not yet configured in .env.local
  if (!isSupabaseConfigured()) {
    const sessionCookie = await getServerSessionCookie();
    if (!sessionCookie) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "unauthorized",
            message:
              "Authentification requise. Veuillez vous connecter pour effectuer un transfert.",
          },
        },
        { status: 401 }
      );
    }

    const sandbox = getAdminSandboxStore();
    const activeUser = sandbox.users.find((u) => u.id === sessionCookie.userId);
    if (!activeUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "unauthorized",
            message: "Session invalide. Veuillez vous reconnecter.",
          },
        },
        { status: 401 }
      );
    }

    const isKycProvisioned =
      Boolean(activeUser.kyc_provisioned) ||
      activeUser.kyc_status === "verified" ||
      activeUser.kyc_status === "pending";

    if (!isKycProvisioned) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "kyc_required",
            message:
              "Provisionnement KYC obligatoire : veuillez soumettre votre pièce d'identité (Recto & Verso) et votre Selfie avant d'envoyer de l'argent.",
          },
        },
        { status: 403 }
      );
    }

    const payinTier = findMatchingTier(
      sendAmount,
      sender.networks[0]?.payinTiers || []
    );
    const payoutTier = findMatchingTier(sendAmount, net.payoutTiers || []);
    const quote = calculateQuote({
      sendAmount,
      senderCurrency: sender.currency,
      destinationCurrency: dest.currency,
      exchangeRate: crossExchangeRate,
      feeChargeMode: sandbox.settings.fee_charge_mode,
      payinTier,
      payoutTier,
      platformFeePercent: sandbox.settings.platform_fee_percent,
      platformFeeFixed: sandbox.settings.platform_fee_fixed_xof,
    });

    const reference = `APC-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    let recipientName = newRecipient?.fullName || "Bénéficiaire";
    let recipientMsisdn = newRecipient?.msisdn || "+22370000000";
    if (recipientId) {
      const found = sandbox.recipients.find((r) => r.id === recipientId);
      if (found) {
        recipientName = found.full_name;
        recipientMsisdn = found.msisdn;
      }
    }

    const newTx = {
      id: `tx-${Date.now()}`,
      reference,
      user_id: activeUser.id,
      recipient_id: recipientId || sandbox.recipients[0]?.id || "rec-001",
      sender_country: sender.isoCode,
      sender_currency: quote.senderCurrency,
      destination_country: dest.isoCode,
      destination_currency: quote.destinationCurrency,
      destination_network: net.code,
      destination_network_name: net.name,
      recipient_name: recipientName,
      recipient_msisdn: recipientMsisdn,
      send_amount: quote.sendAmount,
      fee_amount: quote.feeAmount,
      total_charged: quote.totalCharged,
      net_send_amount: quote.netSendAmount,
      exchange_rate: quote.exchangeRate,
      payout_amount: quote.payoutAmount,
      fee_charge_mode: quote.feeChargeMode,
      status: "payment_pending" as const,
      failure_code: null,
      failure_reason: null,
      created_at: now,
    };

    sandbox.transactions.unshift(newTx);
    sandbox.events.unshift({
      id: `ev-${Date.now()}`,
      transaction_id: newTx.id,
      from_status: "created",
      to_status: "payment_pending",
      actor_type: "user",
      reason:
        paymentMethod === "virtual_card"
          ? `Paiement par Carte Virtuelle (${virtualCardProvider || "Visa/Mastercard"}) depuis ${sender.name} (${sender.currency})`
          : paymentMethod === "softpay"
          ? `Paiement Mobile Money Softpay (${senderNetwork || "local"}) depuis ${sender.name} (${sender.currency})`
          : `Checkout hébergé SasPay depuis ${sender.name} (${sender.currency})`,
      created_at: now,
    });

    return NextResponse.json(
      {
        success: true,
        data: newTx,
        checkoutUrl: "",
      },
      { status: 201 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "unauthorized", message: "Veuillez vous connecter." } },
      { status: 401 }
    );
  }

  const adminDb = createServiceRoleClient();

  // 1. Check idempotency key: if this payment_idempotency_key already exists for this user, return it
  const { data: existingTx } = await adminDb
    .from("transactions")
    .select("*")
    .eq("payment_idempotency_key", idempotencyKey)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingTx) {
    return NextResponse.json({
      success: true,
      data: existingTx,
      deduplicated: true,
    });
  }

  // 2. Fetch user profile & global settings to enforce KYC limits on the server
  const [{ data: profile }, { data: settings }] = await Promise.all([
    adminDb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    adminDb.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const isVerified = profile?.kyc_status === "verified";
  const txLimitXof = String(
    profile?.custom_tx_limit_xof ??
      (isVerified
        ? settings?.verified_tx_limit_xof ?? "2000000.00"
        : settings?.unverified_tx_limit_xof ?? "100000.00")
  );
  const monthlyLimitXof = String(
    profile?.custom_monthly_limit_xof ??
      (isVerified
        ? settings?.verified_monthly_limit_xof ?? "10000000.00"
        : settings?.unverified_monthly_limit_xof ?? "500000.00")
  );

  if (compareMoney(sendAmountInXof, txLimitXof) > 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "kyc_tx_limit_exceeded",
          message: isVerified
            ? `Ce montant dépasse votre plafond par transaction (${txLimitXof} XOF équivalent).`
            : `Limite par transfert dépassée (${txLimitXof} XOF équivalent pour un compte non vérifié). Veuillez compléter votre vérification KYC pour envoyer des montants supérieurs.`,
        },
      },
      { status: 422 }
    );
  }

  // Calculate user's cumulative volume for the current calendar month
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data: monthTxs } = await adminDb
    .from("transactions")
    .select("send_amount, status")
    .eq("user_id", user.id)
    .gte("created_at", startOfMonth.toISOString())
    .not("status", "in", '("payment_failed","refunded")');

  let monthlyUsed = "0.00";
  for (const row of monthTxs || []) {
    monthlyUsed = addMoney(monthlyUsed, String(row.send_amount));
  }
  const projectedMonthly = addMoney(monthlyUsed, sendAmountInXof);

  if (compareMoney(projectedMonthly, monthlyLimitXof) > 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "kyc_monthly_limit_exceeded",
          message: isVerified
            ? `Plafond mensuel atteint (${monthlyLimitXof} XOF/mois). Utilisé ce mois : ${monthlyUsed} XOF.`
            : `Plafond mensuel de ${monthlyLimitXof} XOF dépassé (utilisé : ${monthlyUsed} XOF). Vérifiez votre identité (KYC) pour augmenter vos limites.`,
        },
      },
      { status: 422 }
    );
  }

  const feeChargeMode: FeeChargeMode = (settings?.fee_charge_mode as FeeChargeMode) || "ADD_ON";
  const payinTier = findMatchingTier(
    sendAmount,
    sender.networks[0]?.payinTiers || []
  );
  const payoutTier = findMatchingTier(sendAmount, net.payoutTiers || []);

  const quote = calculateQuote({
    sendAmount,
    senderCurrency: sender.currency,
    destinationCurrency: dest.currency,
    exchangeRate: crossExchangeRate,
    feeChargeMode,
    payinTier,
    payoutTier,
    platformFeePercent: String(settings?.platform_fee_percent ?? "1.000"),
    platformFeeFixed: String(settings?.platform_fee_fixed_xof ?? "0.00"),
  });

  // 4. Resolve or create recipient
  let resolvedRecipientId = recipientId;
  let recipientName = "";
  let recipientMsisdn = "";

  if (resolvedRecipientId) {
    const { data: rec } = await adminDb
      .from("recipients")
      .select("*")
      .eq("id", resolvedRecipientId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!rec) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "recipient_not_found", message: "Bénéficiaire introuvable." },
        },
        { status: 404 }
      );
    }
    recipientName = rec.full_name;
    recipientMsisdn = rec.msisdn;
  } else if (newRecipient) {
    const { data: createdRec, error: recErr } = await adminDb
      .from("recipients")
      .insert({
        user_id: user.id,
        full_name: newRecipient.fullName,
        country_code: dest.isoCode,
        currency: dest.currency,
        network_code: net.code,
        network_name: net.name,
        msisdn: newRecipient.msisdn,
      })
      .select("*")
      .single();

    if (recErr || !createdRec) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "recipient_create_failed",
            message: recErr?.message || "Impossible de créer le bénéficiaire.",
          },
        },
        { status: 500 }
      );
    }
    resolvedRecipientId = createdRec.id;
    recipientName = createdRec.full_name;
    recipientMsisdn = createdRec.msisdn;
  } else {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "missing_recipient",
          message: "Veuillez sélectionner ou ajouter un bénéficiaire.",
        },
      },
      { status: 400 }
    );
  }

  // 5. Insert transaction in `created` status + initial `transaction_events` row
  const reference = `APC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()}`;

  const { data: txRow, error: txErr } = await adminDb
    .from("transactions")
    .insert({
      reference,
      user_id: user.id,
      recipient_id: resolvedRecipientId,
      sender_country: sender.isoCode,
      sender_currency: quote.senderCurrency,
      destination_country: dest.isoCode,
      destination_currency: quote.destinationCurrency,
      destination_network: net.code,
      destination_network_name: net.name,
      recipient_msisdn: recipientMsisdn,
      recipient_name: recipientName,
      send_amount: quote.sendAmount,
      fee_amount: quote.feeAmount,
      total_charged: quote.totalCharged,
      net_send_amount: quote.netSendAmount,
      exchange_rate: quote.exchangeRate,
      payout_amount: quote.payoutAmount,
      fee_charge_mode: quote.feeChargeMode,
      status: "created",
      payment_idempotency_key: idempotencyKey,
    })
    .select("*")
    .single();

  if (txErr || !txRow) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "tx_create_failed",
          message: txErr?.message || "Impossible de créer la transaction.",
        },
      },
      { status: 500 }
    );
  }

  await adminDb.from("transaction_events").insert({
    transaction_id: txRow.id,
    from_status: null,
    to_status: "created",
    actor_type: "user",
    actor_id: user.id,
    reason: "Transaction created by sender",
    metadata: { reference, quote },
  });

  const store = createSupabaseTransactionStore();
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const returnUrl = `${appBaseUrl}/transactions/${txRow.id}`;

  // 6. Initiate SasPay Payin (Direct Softpay, Virtual Card `network: "card"`, or Hosted Checkout Session)
  try {
    if (paymentMethod === "softpay" || paymentMethod === "virtual_card") {
      const chosenSenderNet =
        paymentMethod === "virtual_card"
          ? "card"
          : senderNetwork || sender.networks[0]?.code || "wave_ci";
      const chosenSenderPhone =
        senderPhone || profile?.phone || `${sender.dialCode || "+225"}07000000`;
      const fullNameStr =
        cardHolderName ||
        profile?.full_name ||
        user.email?.split("@")[0] ||
        "Client Apacci";
      const [firstName = "Client", ...restLast] = fullNameStr.trim().split(/\s+/);
      const lastName = restLast.join(" ") || "Apacci";

      const softpayRes = await createSoftpayPayment(
        {
          amount: quote.totalCharged,
          currency: quote.senderCurrency,
          country: sender.isoCode,
          network: chosenSenderNet,
          description: `Apacci Exchange ${reference} (${sender.isoCode} -> ${dest.isoCode})`,
          customer: {
            email: profile?.email || user.email || "client@apacci.exchange",
            first_name: firstName,
            last_name: lastName,
            phone: chosenSenderPhone,
          },
          return_url: returnUrl,
          metadata: {
            apacci_transaction_id: txRow.id,
            apacci_reference: reference,
            user_id: user.id,
            payment_method: paymentMethod,
            virtual_card_provider: virtualCardProvider || null,
          },
          fee_charge_mode: quote.feeChargeMode,
          ...(prepaymentOtp ? { otp: prepaymentOtp } : {}),
        },
        idempotencyKey
      );

      await transitionTransaction(store, {
        transactionId: txRow.id,
        toStatus: "payment_pending",
        actorType: "system",
        actorId: user.id,
        reason:
          paymentMethod === "virtual_card"
            ? `SasPay Virtual Card payment initiated (${virtualCardProvider || "card"})`
            : "SasPay softpay payment initiated",
        metadata: {
          saspay_payment_id: softpayRes.id,
          sender_country: sender.isoCode,
          sender_network: chosenSenderNet,
          virtual_card_provider: virtualCardProvider || null,
          has_checkout_url: Boolean(softpayRes.checkout_url),
        },
        extraFields: {
          saspay_payment_id: softpayRes.id,
          saspay_checkout_url: softpayRes.checkout_url || null,
        },
      });

      const updatedTx = await store.getTransactionById(txRow.id);

      // Rule from AGENTS.md: "Si checkout_url est non vide après un softpay, redirigez le client vers cette URL."
      return NextResponse.json(
        {
          success: true,
          data: updatedTx,
          checkoutUrl: softpayRes.checkout_url || "",
          instructions: softpayRes.instructions || "",
          bankTransfer: softpayRes.bank_transfer || null,
        },
        { status: 201 }
      );
    }

    const checkout = await createCheckoutSession(
      {
        amount: quote.totalCharged,
        currency: quote.senderCurrency,
        description: `Apacci Exchange ${reference} (${sender.isoCode} -> ${dest.isoCode})`,
        country: sender.isoCode,
        customer_email: profile?.email || user.email || "client@apacci.exchange",
        customer_name: profile?.full_name || user.email?.split("@")[0] || "Client Apacci",
        customer_phone: profile?.phone || "",
        return_url: returnUrl,
        metadata: {
          apacci_transaction_id: txRow.id,
          apacci_reference: reference,
          user_id: user.id,
        },
        fee_charge_mode: quote.feeChargeMode,
      },
      idempotencyKey
    );

    await transitionTransaction(store, {
      transactionId: txRow.id,
      toStatus: "payment_pending",
      actorType: "system",
      actorId: user.id,
      reason: "SasPay checkout session created",
      metadata: {
        saspay_checkout_id: checkout.id,
        saspay_checkout_slug: checkout.slug,
      },
      extraFields: {
        saspay_checkout_id: checkout.id,
        saspay_checkout_slug: checkout.slug,
        saspay_checkout_url: checkout.checkout_url,
      },
    });

    const updatedTx = await store.getTransactionById(txRow.id);

    return NextResponse.json(
      {
        success: true,
        data: updatedTx,
        checkoutUrl: checkout.checkout_url,
      },
      { status: 201 }
    );
  } catch (err) {
    const errorCode = err instanceof SasPayError ? err.errorCode : "checkout_create_failed";
    const userMessage = mapSasPayErrorToUserMessage(errorCode, "fr");

    logger.error("Failed to create SasPay checkout session", {
      transactionId: txRow.id,
      errorCode,
      error: err instanceof Error ? err.message : String(err),
    });

    await transitionTransaction(store, {
      transactionId: txRow.id,
      toStatus: "payment_failed",
      actorType: "system",
      reason: `Checkout session creation failed: ${errorCode}`,
      metadata: { error_code: errorCode },
      extraFields: {
        failure_code: errorCode,
        failure_reason: userMessage,
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: userMessage,
        },
        transactionId: txRow.id,
      },
      { status: 422 }
    );
  }
}


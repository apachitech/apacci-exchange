import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getAdminSandboxStore,
  type AdminUserRecord,
  type SavedVirtualCardRecord,
} from "@/lib/admin-store";
import {
  SESSION_COOKIE_NAME,
  encodeSessionCookie,
  getServerSessionCookie,
} from "@/lib/auth-session";
import { addMoney } from "@/lib/money";
import { logger } from "@/lib/logger";

export async function GET() {
  const sandbox = getAdminSandboxStore();

  if (!isSupabaseConfigured()) {
    const sessionCookie = await getServerSessionCookie();
    if (!sessionCookie) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "unauthorized",
            message:
              "Authentification requise. Veuillez vous connecter pour accéder à votre profil.",
          },
        },
        { status: 401 }
      );
    }

    const activeUser =
      sandbox.users.find((u) => u.id === sessionCookie.userId) ||
      sandbox.users.find(
        (u) => u.email.toLowerCase() === sessionCookie.email.toLowerCase()
      );

    if (!activeUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "unauthorized",
            message: "Session invalide ou expirée. Veuillez vous reconnecter.",
          },
        },
        { status: 401 }
      );
    }

    sandbox.activeUserId = activeUser.id;

    const isVerified = activeUser.kyc_status === "verified";
    const txLimitXof =
      activeUser.custom_tx_limit_xof ||
      (isVerified
        ? sandbox.settings.verified_tx_limit_xof
        : sandbox.settings.unverified_tx_limit_xof);
    const monthlyLimitXof =
      activeUser.custom_monthly_limit_xof ||
      (isVerified
        ? sandbox.settings.verified_monthly_limit_xof
        : sandbox.settings.unverified_monthly_limit_xof);

    let monthlyUsedXof = "0.00";
    for (const tx of sandbox.transactions) {
      if (
        tx.user_id === activeUser.id &&
        tx.status !== "payment_failed" &&
        tx.status !== "refunded"
      ) {
        monthlyUsedXof = addMoney(monthlyUsedXof, tx.send_amount);
      }
    }

    return NextResponse.json({
      success: true,
      mode: "sandbox",
      data: {
        profile: activeUser,
        limits: {
          txLimitXof,
          monthlyLimitXof,
          monthlyUsedXof,
        },
        availableProfiles: sandbox.users.map((u) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          country_code: u.country_code,
          role: u.role,
          kyc_status: u.kyc_status,
          kyc_provisioned: Boolean(u.kyc_provisioned),
        })),
      },
    });
  }

  // Supabase Mode
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "unauthorized", message: "Veuillez vous connecter." },
      },
      { status: 401 }
    );
  }

  const adminDb = createServiceRoleClient();
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

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data: monthTxs } = await adminDb
    .from("transactions")
    .select("send_amount, status")
    .eq("user_id", user.id)
    .gte("created_at", startOfMonth.toISOString())
    .not("status", "in", '("payment_failed","refunded")');

  let monthlyUsedXof = "0.00";
  for (const row of monthTxs || []) {
    monthlyUsedXof = addMoney(monthlyUsedXof, String(row.send_amount));
  }

  return NextResponse.json({
    success: true,
    mode: "supabase",
    data: {
      profile,
      limits: {
        txLimitXof,
        monthlyLimitXof,
        monthlyUsedXof,
      },
      availableProfiles: [],
    },
  });
}

export async function POST(request: Request) {
  const sandbox = getAdminSandboxStore();
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
  const payload = (body.payload || {}) as Record<string, unknown>;
  const now = new Date().toISOString();

  // 1. Switch active demo user profile in Sandbox mode
  if (action === "switch_demo_profile") {
    const targetUserId = String(body.userId || "");
    const found = sandbox.users.find((u) => u.id === targetUserId);
    if (!found) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "not_found", message: "Profil démo introuvable." },
        },
        { status: 404 }
      );
    }
    sandbox.activeUserId = found.id;
    const res = NextResponse.json({ success: true, data: found });
    res.cookies.set(
      SESSION_COOKIE_NAME,
      encodeSessionCookie({
        userId: found.id,
        email: found.email,
        role: found.role,
        fullName: found.full_name,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      }
    );
    return res;
  }

  // Resolve target user from authenticated session
  const sessionCookie = await getServerSessionCookie();
  if (!isSupabaseConfigured() && !sessionCookie) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unauthorized",
          message:
            "Authentification requise. Veuillez vous connecter pour modifier votre profil.",
        },
      },
      { status: 401 }
    );
  }

  let activeUser: AdminUserRecord =
    (sessionCookie &&
      sandbox.users.find((u) => u.id === sessionCookie.userId)) ||
    sandbox.users.find((u) => u.id === sandbox.activeUserId) ||
    sandbox.users[0];

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "unauthorized", message: "Veuillez vous connecter." },
        },
        { status: 401 }
      );
    }
    const adminDb = createServiceRoleClient();

    if (action === "submit_kyc") {
      const idRecto = String(payload.kyc_id_recto_url || "").trim();
      const idVerso = String(payload.kyc_id_verso_url || "").trim();
      const selfieUrl = String(payload.kyc_selfie_url || "").trim();

      if (!idRecto || !idVerso || !selfieUrl) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "missing_kyc_photos",
              message:
                "Veuillez fournir les 3 photos obligatoires : Pièce d'identité (Recto), Pièce d'identité (Verso) et votre Selfie biométrique.",
            },
          },
          { status: 400 }
        );
      }

      const targetStatus = payload.instantVerify ? "verified" : "pending";
      const { data: updated, error } = await adminDb
        .from("profiles")
        .update({
          full_name: payload.full_name,
          phone: payload.phone,
          country_code: payload.country_code,
          date_of_birth: payload.date_of_birth || null,
          nationality: payload.nationality,
          address_line: payload.address_line,
          city: payload.city,
          occupation: payload.occupation,
          source_of_funds: payload.source_of_funds,
          kyc_document_type: payload.kyc_document_type,
          kyc_document_number: payload.kyc_document_number,
          kyc_issuing_country: payload.kyc_issuing_country,
          kyc_document_expiry: payload.kyc_document_expiry || null,
          kyc_id_recto_url: idRecto,
          kyc_id_verso_url: idVerso,
          kyc_selfie_url: selfieUrl,
          kyc_selfie_verified: true,
          kyc_provisioned: true,
          kyc_status: targetStatus,
          kyc_submitted_at: now,
          updated_at: now,
        })
        .eq("id", user.id)
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

    const { data: updated, error } = await adminDb
      .from("profiles")
      .update({
        ...payload,
        updated_at: now,
      })
      .eq("id", user.id)
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

  // Sandbox Mode Mutations
  const idx = sandbox.users.findIndex((u) => u.id === activeUser.id);

  if (action === "update_personal") {
    activeUser = {
      ...activeUser,
      full_name:
        payload.full_name !== undefined
          ? String(payload.full_name)
          : activeUser.full_name,
      phone:
        payload.phone !== undefined ? String(payload.phone) : activeUser.phone,
      country_code:
        payload.country_code !== undefined
          ? String(payload.country_code).toUpperCase()
          : activeUser.country_code,
      date_of_birth:
        payload.date_of_birth !== undefined
          ? String(payload.date_of_birth)
          : activeUser.date_of_birth,
      nationality:
        payload.nationality !== undefined
          ? String(payload.nationality).toUpperCase()
          : activeUser.nationality,
      address_line:
        payload.address_line !== undefined
          ? String(payload.address_line)
          : activeUser.address_line,
      city:
        payload.city !== undefined ? String(payload.city) : activeUser.city,
      occupation:
        payload.occupation !== undefined
          ? String(payload.occupation)
          : activeUser.occupation,
      source_of_funds:
        payload.source_of_funds !== undefined
          ? String(payload.source_of_funds)
          : activeUser.source_of_funds,
    };
    if (idx >= 0) sandbox.users[idx] = activeUser;
    return NextResponse.json({ success: true, data: activeUser });
  }

  if (action === "submit_kyc") {
    const docNumber = String(payload.kyc_document_number || "").trim();
    const fullName = String(payload.full_name || activeUser.full_name || "").trim();
    const idRecto = String(
      payload.kyc_id_recto_url || activeUser.kyc_id_recto_url || ""
    ).trim();
    const idVerso = String(
      payload.kyc_id_verso_url || activeUser.kyc_id_verso_url || ""
    ).trim();
    const selfieUrl = String(
      payload.kyc_selfie_url || activeUser.kyc_selfie_url || ""
    ).trim();

    if (!docNumber || !fullName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "validation_error",
            message:
              "Veuillez renseigner votre nom complet et votre numéro de pièce d'identité.",
          },
        },
        { status: 400 }
      );
    }

    if (!idRecto || !idVerso || !selfieUrl) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "missing_kyc_photos",
            message:
              "Veuillez fournir les 3 photos obligatoires pour le KYC : 1) Photo Pièce d'Identité (Recto), 2) Photo Pièce d'Identité (Verso), et 3) Votre Selfie biométrique.",
          },
        },
        { status: 400 }
      );
    }

    const nextStatus = payload.instantVerify ? "verified" : "pending";
    activeUser = {
      ...activeUser,
      full_name: fullName,
      phone:
        payload.phone !== undefined ? String(payload.phone) : activeUser.phone,
      country_code:
        payload.country_code !== undefined
          ? String(payload.country_code).toUpperCase()
          : activeUser.country_code,
      date_of_birth:
        payload.date_of_birth !== undefined
          ? String(payload.date_of_birth)
          : activeUser.date_of_birth,
      nationality:
        payload.nationality !== undefined
          ? String(payload.nationality).toUpperCase()
          : activeUser.nationality || activeUser.country_code,
      address_line:
        payload.address_line !== undefined
          ? String(payload.address_line)
          : activeUser.address_line,
      city:
        payload.city !== undefined ? String(payload.city) : activeUser.city,
      occupation:
        payload.occupation !== undefined
          ? String(payload.occupation)
          : activeUser.occupation,
      source_of_funds:
        payload.source_of_funds !== undefined
          ? String(payload.source_of_funds)
          : activeUser.source_of_funds,
      kyc_document_type:
        (payload.kyc_document_type as AdminUserRecord["kyc_document_type"]) ||
        "national_id",
      kyc_document_number: docNumber,
      kyc_issuing_country: String(
        payload.kyc_issuing_country || activeUser.country_code || "CI"
      ).toUpperCase(),
      kyc_document_expiry: String(payload.kyc_document_expiry || "2030-12-31"),
      kyc_id_recto_url: idRecto,
      kyc_id_verso_url: idVerso,
      kyc_selfie_url: selfieUrl,
      kyc_selfie_verified: true,
      kyc_provisioned: true,
      kyc_status: nextStatus,
      kyc_submitted_at: now,
      kyc_rejection_reason: null,
    };

    if (idx >= 0) sandbox.users[idx] = activeUser;
    logger.info("User completed KYC provisioning", {
      userId: activeUser.id,
      kycStatus: activeUser.kyc_status,
      docType: activeUser.kyc_document_type,
    });
    return NextResponse.json({ success: true, data: activeUser });
  }

  if (action === "update_preferences") {
    activeUser = {
      ...activeUser,
      default_sender_country:
        payload.default_sender_country !== undefined
          ? String(payload.default_sender_country).toUpperCase()
          : activeUser.default_sender_country,
      default_payment_method:
        (payload.default_payment_method as AdminUserRecord["default_payment_method"]) ||
        activeUser.default_payment_method,
      default_virtual_card_provider:
        payload.default_virtual_card_provider !== undefined
          ? String(payload.default_virtual_card_provider)
          : activeUser.default_virtual_card_provider,
      default_virtual_card_last4:
        payload.default_virtual_card_last4 !== undefined
          ? String(payload.default_virtual_card_last4).slice(-4)
          : activeUser.default_virtual_card_last4,
      preferred_locale:
        payload.preferred_locale === "en" || payload.preferred_locale === "fr"
          ? payload.preferred_locale
          : activeUser.preferred_locale,
      notify_email:
        payload.notify_email !== undefined
          ? Boolean(payload.notify_email)
          : activeUser.notify_email,
      notify_sms:
        payload.notify_sms !== undefined
          ? Boolean(payload.notify_sms)
          : activeUser.notify_sms,
      notify_push_pwa:
        payload.notify_push_pwa !== undefined
          ? Boolean(payload.notify_push_pwa)
          : activeUser.notify_push_pwa,
    };
    if (idx >= 0) sandbox.users[idx] = activeUser;
    return NextResponse.json({ success: true, data: activeUser });
  }

  if (action === "add_virtual_card") {
    const cards = [...(activeUser.saved_virtual_cards || [])];
    const last4 = String(payload.last4 || "4242")
      .replace(/\D/g, "")
      .slice(-4)
      .padStart(4, "0");
    const newCard: SavedVirtualCardRecord = {
      id: `vc-${Date.now()}`,
      provider: String(
        payload.provider || "Vodacom Virtual Card (M-Pesa / VodaPay)"
      ),
      brand: payload.brand === "MASTERCARD" ? "MASTERCARD" : "VISA",
      cardholder_name: String(payload.cardholder_name || activeUser.full_name),
      last4,
      expiry: String(payload.expiry || "12/28"),
      origin_country: String(
        payload.origin_country || activeUser.country_code || "CI"
      ).toUpperCase(),
      currency: String(payload.currency || "XOF").toUpperCase(),
      is_default: cards.length === 0 || Boolean(payload.is_default),
    };
    if (newCard.is_default) {
      for (const c of cards) c.is_default = false;
    }
    cards.unshift(newCard);
    activeUser = {
      ...activeUser,
      saved_virtual_cards: cards,
      default_virtual_card_provider: newCard.is_default
        ? newCard.provider
        : activeUser.default_virtual_card_provider,
      default_virtual_card_last4: newCard.is_default
        ? newCard.last4
        : activeUser.default_virtual_card_last4,
    };
    if (idx >= 0) sandbox.users[idx] = activeUser;
    return NextResponse.json({ success: true, data: activeUser });
  }

  if (action === "delete_virtual_card") {
    const cardId = String(body.cardId || "");
    const cards = (activeUser.saved_virtual_cards || []).filter(
      (c) => c.id !== cardId
    );
    activeUser = { ...activeUser, saved_virtual_cards: cards };
    if (idx >= 0) sandbox.users[idx] = activeUser;
    return NextResponse.json({ success: true, data: activeUser });
  }

  if (action === "update_security") {
    activeUser = {
      ...activeUser,
      two_factor_enabled:
        payload.two_factor_enabled !== undefined
          ? Boolean(payload.two_factor_enabled)
          : activeUser.two_factor_enabled,
      transaction_pin_enabled:
        payload.transaction_pin_enabled !== undefined
          ? Boolean(payload.transaction_pin_enabled)
          : activeUser.transaction_pin_enabled,
    };
    if (idx >= 0) sandbox.users[idx] = activeUser;
    return NextResponse.json({ success: true, data: activeUser });
  }

  return NextResponse.json(
    {
      success: false,
      error: { code: "unknown_action", message: `Action inconnue: ${action}` },
    },
    { status: 400 }
  );
}


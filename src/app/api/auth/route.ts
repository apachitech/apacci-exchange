import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getAdminSandboxStore, type AdminUserRecord } from "@/lib/admin-store";
import {
  SESSION_COOKIE_NAME,
  encodeSessionCookie,
  getServerSessionCookie,
  type SessionPayload,
} from "@/lib/auth-session";

// Default demo passwords in local/sandbox mode (any password >= 4 chars is accepted if not in this map, except admin which checks Admin@2026! or admin123)
const SANDBOX_PASSWORDS: Record<string, string[]> = {
  "admin@apacci-exchange.com": ["Admin@2026!", "admin123", "admin"],
  "awa.konate@example.ci": ["Client@2026!", "client123", "password"],
  "sipho.dlamini@example.za": ["Client@2026!", "client123", "password"],
  "fatou.diallo@example.sn": ["Client@2026!", "client123", "password"],
};

export async function GET() {
  if (!isSupabaseConfigured()) {
    const store = getAdminSandboxStore();
    const sessionCookie = await getServerSessionCookie();
    if (!sessionCookie) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        mode: "sandbox",
        user: null,
      });
    }

    const foundUser =
      store.users.find((u) => u.id === sessionCookie.userId) ||
      store.users.find(
        (u) => u.email.toLowerCase() === sessionCookie.email.toLowerCase()
      );

    if (!foundUser) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        mode: "sandbox",
        user: null,
      });
    }

    // Keep store.activeUserId synchronized with the logged-in user
    store.activeUserId = foundUser.id;

    return NextResponse.json({
      success: true,
      authenticated: true,
      mode: "sandbox",
      user: {
        id: foundUser.id,
        email: foundUser.email,
        full_name: foundUser.full_name,
        role: foundUser.role,
        country_code: foundUser.country_code,
        kyc_status: foundUser.kyc_status,
        kyc_provisioned: Boolean(
          foundUser.kyc_provisioned || foundUser.kyc_status !== "unverified"
        ),
      },
    });
  }

  // Supabase mode
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      success: true,
      authenticated: false,
      mode: "supabase",
      user: null,
    });
  }

  const adminDb = createServiceRoleClient();
  const { data: profile } = await adminDb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    authenticated: true,
    mode: "supabase",
    user: {
      id: user.id,
      email: user.email || "",
      full_name: profile?.full_name || user.user_metadata?.full_name || "Client",
      role: (profile?.role as "client" | "admin") || "client",
      country_code: profile?.country_code || "CI",
      kyc_status: profile?.kyc_status || "unverified",
      kyc_provisioned: Boolean(
        profile?.kyc_provisioned ||
          (profile?.kyc_status && profile.kyc_status !== "unverified")
      ),
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "signin");

    // 1. SIGN OUT
    if (action === "signout") {
      if (isSupabaseConfigured()) {
        const supabase = await createServerSupabaseClient();
        await supabase.auth.signOut();
      }
      const res = NextResponse.json({
        success: true,
        message: "Déconnexion réussie.",
      });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    // 2. SIGN IN
    if (action === "signin") {
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");

      if (!email || !password) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "invalid_credentials",
              message: "Veuillez saisir votre adresse email et votre mot de passe.",
            },
          },
          { status: 400 }
        );
      }

      if (!isSupabaseConfigured()) {
        const store = getAdminSandboxStore();
        const user = store.users.find(
          (u) => u.email.toLowerCase() === email
        );

        if (!user) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "user_not_found",
                message:
                  "Aucun compte trouvé avec cet email. Utilisez un compte de démonstration ou créez un nouveau compte.",
              },
            },
            { status: 401 }
          );
        }

        const allowedPasswords = SANDBOX_PASSWORDS[email];
        if (user.role === "admin") {
          const validAdminPass =
            allowedPasswords?.includes(password) || password === "Admin@2026!";
          if (!validAdminPass) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: "invalid_admin_password",
                  message:
                    "Mot de passe administrateur incorrect. (Indice démo : Admin@2026!)",
                },
              },
              { status: 401 }
            );
          }
        } else if (password.length < 4) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "invalid_password",
                message: "Mot de passe invalide.",
              },
            },
            { status: 401 }
          );
        }

        store.activeUserId = user.id;

        const payload: SessionPayload = {
          userId: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
        };

        const res = NextResponse.json({
          success: true,
          mode: "sandbox",
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            country_code: user.country_code,
            kyc_status: user.kyc_status,
            kyc_provisioned: Boolean(
              user.kyc_provisioned || user.kyc_status !== "unverified"
            ),
          },
        });

        res.cookies.set(SESSION_COOKIE_NAME, encodeSessionCookie(payload), {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
        return res;
      }

      // Supabase Sign In
      const supabase = await createServerSupabaseClient();
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError || !signInData.user) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "invalid_credentials",
              message: signInError?.message || "Identifiants incorrects.",
            },
          },
          { status: 401 }
        );
      }

      const adminDb = createServiceRoleClient();
      const { data: profile } = await adminDb
        .from("profiles")
        .select("*")
        .eq("id", signInData.user.id)
        .maybeSingle();

      const role: "client" | "admin" =
        profile?.role === "admin" ? "admin" : "client";
      const fullName =
        profile?.full_name ||
        signInData.user.user_metadata?.full_name ||
        "Client";

      const res = NextResponse.json({
        success: true,
        mode: "supabase",
        user: {
          id: signInData.user.id,
          email: signInData.user.email || email,
          full_name: fullName,
          role,
          country_code: profile?.country_code || "CI",
          kyc_status: profile?.kyc_status || "unverified",
          kyc_provisioned: Boolean(
            profile?.kyc_provisioned ||
              (profile?.kyc_status && profile.kyc_status !== "unverified")
          ),
        },
      });

      res.cookies.set(
        SESSION_COOKIE_NAME,
        encodeSessionCookie({
          userId: signInData.user.id,
          email: signInData.user.email || email,
          role,
          fullName,
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

    // 3. SIGN UP (REGISTER)
    if (action === "signup") {
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      const fullName = String(body.fullName || "").trim();
      const phone = String(body.phone || "").trim();
      const countryCode = String(body.countryCode || "CI")
        .trim()
        .toUpperCase();

      if (!email || !password || !fullName || !phone) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "missing_fields",
              message: "Veuillez remplir tous les champs obligatoires.",
            },
          },
          { status: 400 }
        );
      }

      if (!isSupabaseConfigured()) {
        const store = getAdminSandboxStore();
        const existing = store.users.find(
          (u) => u.email.toLowerCase() === email
        );
        if (existing) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "email_exists",
                message: "Un compte existe déjà avec cette adresse email.",
              },
            },
            { status: 409 }
          );
        }

        const newUser: AdminUserRecord = {
          id: `usr-client-${Date.now()}`,
          email,
          full_name: fullName,
          phone,
          country_code: countryCode,
          role: "client",
          kyc_status: "unverified",
          kyc_provisioned: false,
          nationality: countryCode,
          default_sender_country: countryCode,
          default_payment_method: "virtual_card",
          default_virtual_card_provider: "Visa / Mastercard Bancaire Standard",
          saved_virtual_cards: [],
          preferred_locale: "fr",
          notify_email: true,
          notify_sms: true,
          notify_push_pwa: true,
          two_factor_enabled: false,
          transaction_pin_enabled: false,
          custom_tx_limit_xof: null,
          custom_monthly_limit_xof: null,
          created_at: new Date().toISOString(),
        };

        store.users.push(newUser);
        store.activeUserId = newUser.id;
        SANDBOX_PASSWORDS[email] = [password];

        const payload: SessionPayload = {
          userId: newUser.id,
          email: newUser.email,
          role: newUser.role,
          fullName: newUser.full_name,
        };

        const res = NextResponse.json({
          success: true,
          mode: "sandbox",
          user: {
            id: newUser.id,
            email: newUser.email,
            full_name: newUser.full_name,
            role: newUser.role,
            country_code: newUser.country_code,
            kyc_status: newUser.kyc_status,
            kyc_provisioned: false,
          },
        });

        res.cookies.set(SESSION_COOKIE_NAME, encodeSessionCookie(payload), {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
        return res;
      }

      // Supabase Sign Up
      const supabase = await createServerSupabaseClient();
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
              country_code: countryCode,
            },
          },
        });

      if (signUpError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "signup_failed",
              message: signUpError.message,
            },
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: "supabase",
        verificationRequired: !signUpData.session,
        user: signUpData.user
          ? {
              id: signUpData.user.id,
              email: signUpData.user.email || email,
              full_name: fullName,
              role: "client",
              country_code: countryCode,
              kyc_status: "unverified",
              kyc_provisioned: false,
            }
          : null,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "unknown_action", message: `Action inconnue: ${action}` },
      },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "internal_error",
          message:
            err instanceof Error ? err.message : "Erreur interne d'authentification",
        },
      },
      { status: 500 }
    );
  }
}


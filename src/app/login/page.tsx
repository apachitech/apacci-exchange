"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Globe,
  KeyRound,
  ArrowRight,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAppPreferences } from "@/components/layout/AppPreferencesProvider";

const ORIGIN_COUNTRIES = [
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "BJ", name: "Bénin", flag: "🇧🇯" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "ZA", name: "Afrique du Sud", flag: "🇿🇦" },
  { code: "CM", name: "Cameroun", flag: "🇨🇲" },
  { code: "CD", name: "RD Congo", flag: "🇨🇩" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "US", name: "États-Unis", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "GB", name: "Royaume-Uni", flag: "🇬🇧" },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const { t, locale } = useAppPreferences();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("CI");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const performAuth = async (
    targetAction: "signin" | "signup",
    targetEmail: string,
    targetPassword: string,
    extra?: { fullName?: string; phone?: string; countryCode?: string }
  ) => {
    setError(null);
    setVerificationSent(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: targetAction,
          email: targetEmail,
          password: targetPassword,
          fullName: extra?.fullName ?? fullName,
          phone: extra?.phone ?? phone,
          countryCode: extra?.countryCode ?? countryCode,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.error?.message || "Identifiants invalides ou erreur d'authentification."
        );
      }

      if (json.verificationRequired) {
        setVerificationSent(true);
        return;
      }

      // Notify AppShell and other components to refresh active session & profile
      window.dispatchEvent(new CustomEvent("apacci-profile-updated"));

      const userRole = json.user?.role;
      const kycProvisioned = json.user?.kyc_provisioned;

      if (nextPath) {
        if (nextPath.startsWith("/admin") && userRole !== "admin") {
          router.push("/send");
        } else {
          router.push(nextPath);
        }
      } else if (userRole === "admin") {
        router.push("/admin");
      } else if (!kycProvisioned) {
        router.push("/profile");
      } else {
        router.push("/send");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performAuth(mode, email, password, { fullName, phone, countryCode });
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setMode("signin");
    setEmail(demoEmail);
    setPassword(demoPassword);
    await performAuth("signin", demoEmail, demoPassword);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    if (!isSupabaseConfigured()) {
      setError(
        locale === "fr"
          ? "Mode Sandbox actif : utilisez les comptes de connexion rapide ci-dessous ou le formulaire Email / Mot de passe."
          : "Sandbox Mode active: use the quick login accounts below or the Email / Password form."
      );
      return;
    }
    const supabase = createClient();
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthErr) {
      setError(oauthErr.message);
    }
  };

  return (
    <div className="mx-auto max-w-xl py-6 space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B3D91] text-[#F5B700] shadow-sm">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0B3D91] dark:text-white">
            {t.login.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {nextPath === "/admin"
              ? locale === "fr"
                ? "Authentification Administrateur requise pour accéder au Back-Office Apacci Exchange."
                : "Administrator authentication required to access the Apacci Exchange Back-Office."
              : t.login.subtitle}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
              mode === "signin"
                ? "bg-[#0B3D91] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {t.login.signIn}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
              mode === "signup"
                ? "bg-[#0B3D91] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {t.login.signUp}
          </button>
        </div>

        {verificationSent && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t.login.verifyEmailBanner}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.login.fullName}
                </label>
                <div className="relative">
                  <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Awa Sossou"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2.5 text-sm focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {locale === "fr" ? "Pays d'origine" : "Country of Origin"}
                  </label>
                  <div className="relative">
                    <Globe className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 py-2.5 text-sm font-semibold focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                    >
                      {ORIGIN_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.login.phone}
                  </label>
                  <div className="relative">
                    <Phone className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+2250700000000"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2.5 text-sm focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.login.email}
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@apacci-exchange.com"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2.5 text-sm focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.login.password}
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2.5 text-sm focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0B3D91] py-3 text-sm font-bold text-white shadow-md hover:bg-[#0B3D91]/95 disabled:opacity-50 transition cursor-pointer"
          >
            {loading
              ? "..."
              : mode === "signin"
              ? t.login.signIn
              : t.login.signUp}
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
          <span className="bg-white dark:bg-slate-900 px-3 text-[11px] text-slate-400">
            OU
          </span>
          <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
        >
          <span>{t.login.googleSignIn}</span>
        </button>
      </div>

      {/* Quick Demo Credentials Card (Admin vs Client Roles) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {locale === "fr"
                ? "Comptes de Connexion Rapide (RBAC Admin & Clients)"
                : "Quick Login Accounts (Admin & Client RBAC)"}
            </h2>
            <p className="text-[11px] text-slate-500">
              {locale === "fr"
                ? "Cliquez sur un compte pour vous authentifier immédiatement. Seul le compte Administrateur peut accéder à /admin."
                : "Click an account to sign in immediately. Only the Administrator account can access /admin."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {/* Super Admin Account */}
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              handleQuickDemoLogin("admin@apacci-exchange.com", "Admin@2026!")
            }
            className="flex items-center justify-between rounded-2xl border-2 border-[#0B3D91]/30 bg-blue-50/60 p-3.5 text-left hover:border-[#0B3D91] hover:bg-blue-50 dark:border-blue-800/60 dark:bg-blue-950/30 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B3D91] text-[#F5B700]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Kouassi Yao (Super Admin)
                  </span>
                  <span className="rounded-full bg-[#0B3D91] px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#F5B700]">
                    ROLE: ADMIN
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  admin@apacci-exchange.com • Mot de passe : Admin@2026!
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[#0B3D91] dark:text-[#F5B700] shrink-0" />
          </button>

          {/* Verified Client Account */}
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              handleQuickDemoLogin("awa.konate@example.ci", "Client@2026!")
            }
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-left hover:border-emerald-500 hover:bg-emerald-50/30 dark:border-slate-800 dark:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                    🇨🇮 Awa Konaté (Client KYC Vérifié)
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    ROLE: CLIENT • KYC VERIFIED
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  awa.konate@example.ci • Accès /admin bloqué (403)
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>

          {/* Unprovisioned Client Account */}
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              handleQuickDemoLogin("fatou.diallo@example.sn", "Client@2026!")
            }
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-left hover:border-amber-500 hover:bg-amber-50/30 dark:border-slate-800 dark:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                <User className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                    🇸🇳 Fatou Diallo (Nouveau Client — KYC à provisionner)
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    ROLE: CLIENT • UNVERIFIED
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  fatou.diallo@example.sn • Déclenche le portail KYC obligatoire
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm">Chargement...</div>}>
      <LoginContent />
    </Suspense>
  );
}

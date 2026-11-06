"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  LogIn,
} from "lucide-react";
import { useAppPreferences } from "@/components/layout/AppPreferencesProvider";
import type { CorridorsData, CorridorCountry } from "@/lib/corridors";

export default function HomePage() {
  const { t, locale } = useAppPreferences();
  const [corridors, setCorridors] = useState<CorridorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sendAmount, setSendAmount] = useState("25000.00");
  const [senderCountry, setSenderCountry] = useState("CI");
  const [selectedCountry, setSelectedCountry] = useState("ML");
  const [selectedNetwork, setSelectedNetwork] = useState("orange_ml");
  const [quote, setQuote] = useState<{
    sendAmount: string;
    feeAmount: string;
    totalCharged: string;
    payoutAmount: string;
    exchangeRate: string;
    senderCurrency: string;
    destinationCurrency: string;
  } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const authRes = await fetch("/api/auth", { cache: "no-store" });
        const authJson = await authRes.json();
        if (!authJson.authenticated) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        setIsAuthenticated(true);

        const res = await fetch("/api/corridors");
        const json = await res.json();
        if (json.success && json.data) {
          setCorridors(json.data);
          const firstActive = json.data.destinations.find(
            (d: CorridorCountry) => d.isDestinationAvailable
          );
          if (firstActive) {
            setSelectedCountry(firstActive.isoCode);
            if (firstActive.networks[0]) {
              setSelectedNetwork(firstActive.networks[0].code);
            }
          }
        }
      } catch {
        // Handled by UI state
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
    window.addEventListener("apacci-profile-updated", loadDashboard);
    return () => window.removeEventListener("apacci-profile-updated", loadDashboard);
  }, []);

  useEffect(() => {
    if (!corridors || !selectedCountry || !selectedNetwork) return;
    const dest = corridors.destinations.find((d) => d.isoCode === selectedCountry);
    if (!dest || !dest.isDestinationAvailable) {
      setQuote(null);
      setQuoteError(
        dest?.statusNote ||
          (locale === "fr"
            ? "Ce corridor n'est pas encore activé sur le compte SasPay."
            : "This corridor is not yet enabled on the SasPay account.")
      );
      return;
    }

    const timer = setTimeout(async () => {
      setQuoteError(null);
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sendAmount: sendAmount.includes(".") ? sendAmount : `${sendAmount}.00`,
            senderCountry,
            destinationCountry: selectedCountry,
            destinationNetwork: selectedNetwork,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setQuote(json.data);
        } else {
          setQuote(null);
          setQuoteError(json.error?.message || "Erreur de calcul");
        }
      } catch {
        setQuoteError("Erreur réseau lors de la simulation.");
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [sendAmount, senderCountry, selectedCountry, selectedNetwork, corridors, locale]);

  const currentSender =
    corridors?.senders?.find((s) => s.isoCode === senderCountry) ||
    corridors?.senderCountry;
  const currentDest = corridors?.destinations.find(
    (d) => d.isoCode === selectedCountry
  );

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-[#0B3D91]" />
        <span>
          {locale === "fr"
            ? "Vérification de votre session sécurisée..."
            : "Verifying your secure session..."}
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div className="rounded-3xl border-2 border-[#0B3D91]/20 bg-gradient-to-br from-[#0B3D91] via-[#092f70] to-slate-900 p-8 sm:p-10 text-white shadow-2xl space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5B700] text-slate-950 shadow-lg">
            <Lock className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[#F5B700]">
              {locale === "fr"
                ? "Espace Membre Sécurisé — Authentification Requise"
                : "Secure Member Area — Authentication Required"}
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Apacci <span className="text-[#F5B700]">Exchange</span>
            </h1>
            <p className="text-sm sm:text-base text-blue-100 max-w-lg mx-auto leading-relaxed">
              {locale === "fr"
                ? "Seuls les utilisateurs connectés peuvent consulter les contenus du tableau de bord (simulateur, corridors, historique, bénéficiaires) et effectuer des transactions internationales."
                : "Only logged-in users can view dashboard contents (live simulator, corridors, history, recipients) and perform international transactions."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5B700] px-7 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-[#F5B700]/90 transition"
            >
              <LogIn className="h-4 w-4" />
              <span>
                {locale === "fr"
                  ? "Se connecter / Créer un compte"
                  : "Sign In / Create an Account"}
              </span>
            </Link>
            <Link
              href="/legal/how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition"
            >
              <span>{t.home.ctaHowItWorks}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Hero + Live Quote Calculator */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-3xl bg-gradient-to-br from-[#0B3D91] via-[#092f70] to-slate-900 p-6 sm:p-10 text-white shadow-xl">
        <div className="lg:col-span-7 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-[#F5B700] ring-1 ring-[#F5B700]/30">
            <Zap className="h-3.5 w-3.5" />
            <span>{t.home.heroBadge}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Apacci <span className="text-[#F5B700]">Exchange</span>
          </h1>

          <p className="text-lg sm:text-xl font-medium text-blue-100">
            Send money across Africa, fast and safely.
          </p>

          <p className="text-sm text-blue-200/90 max-w-xl leading-relaxed">
            {locale === "fr"
              ? "Envoyez de l'argent depuis n'importe quel pays (Côte d'Ivoire, Sénégal, Cameroun, Afrique du Sud, Kenya, Tanzanie, Gabon ou International) par Mobile Money ou Carte Virtuelle (Vodacom Virtual Card, Wave Visa, Orange, Djamo, Visa/Mastercard) vers toute l'Afrique."
              : "Send money from anywhere (Côte d'Ivoire, Senegal, Cameroon, South Africa, Kenya, Tanzania, Gabon, or International) via Mobile Money or Virtual Card (Vodacom Virtual Card, Wave Visa, Orange, Djamo, Visa/Mastercard) across Africa."}
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/send"
              className="inline-flex items-center gap-2 rounded-xl bg-[#F5B700] px-6 py-3.5 text-sm font-bold text-slate-950 shadow-md hover:bg-[#F5B700]/90 transition"
            >
              <span>{t.home.ctaSend}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/legal/how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition"
            >
              <span>{t.home.ctaHowItWorks}</span>
            </Link>
          </div>
        </div>

        {/* Live Quote Card */}
        <div className="lg:col-span-5 rounded-2xl bg-white p-5 sm:p-6 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#0B3D91] dark:text-[#F5B700]">
              {t.home.calculatorTitle}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {currentSender?.flag || "🌍"} {currentSender?.isoCode || "CI"} (
              {currentSender?.currency || "XOF"})
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {locale === "fr"
                  ? "Pays d'origine de l'argent (Origine)"
                  : "Country of Origin of the Money"}
              </label>
              <select
                value={senderCountry}
                onChange={(e) => setSenderCountry(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {(corridors?.senders || corridors?.destinations || []).map((c) => (
                  <option key={c.isoCode} value={c.isoCode}>
                    {c.flag} {c.name} ({c.currency}) —{" "}
                    {c.networks.length > 0
                      ? "Mobile Money & Carte Virtuelle (Visa/Mastercard)"
                      : "Carte Virtuelle (Visa / Mastercard uniquement)"}
                  </option>
                ))}
              </select>
              {currentSender && currentSender.networks.length === 0 && (
                <p className="mt-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-[#0B3D91] dark:border-blue-900 dark:bg-blue-950/60 dark:text-[#F5B700]">
                  💳 {currentSender.flag} {currentSender.name} ne dispose pas de réseau Mobile Money : le paiement s&apos;effectue par Carte Virtuelle (Visa ou Mastercard).
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t.home.youSend}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 pr-16 text-lg font-bold text-slate-900 focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  {currentSender?.currency || "XOF"}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {t.home.destination}
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => {
                  const code = e.target.value;
                  setSelectedCountry(code);
                  const d = corridors?.destinations.find((x) => x.isoCode === code);
                  setSelectedNetwork(d?.networks[0]?.code || "");
                }}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {(corridors?.destinations || []).map((c) => (
                  <option key={c.isoCode} value={c.isoCode}>
                    {c.flag} {c.name} ({c.currency}){" "}
                    {!c.isDestinationAvailable ? "— [Inactif SasPay]" : ""}
                  </option>
                ))}
              </select>
            </div>

            {currentDest && currentDest.networks.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {t.home.network}
                </label>
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {currentDest.networks.map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.name} ({n.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {quoteError ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{quoteError}</span>
              </div>
            ) : quote ? (
              <div className="rounded-xl bg-slate-100 p-4 space-y-2 dark:bg-slate-800/80">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{t.home.fee}</span>
                  <span className="font-semibold">
                    {quote.feeAmount} {quote.senderCurrency}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{t.home.totalToPay}</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {quote.totalCharged} {quote.senderCurrency}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{t.home.exchangeRate}</span>
                  <span className="font-mono">
                    1 {quote.senderCurrency} = {Number(quote.exchangeRate).toFixed(4)}{" "}
                    {quote.destinationCurrency}
                  </span>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-baseline">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t.home.recipientGets}
                  </span>
                  <span className="text-lg font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
                    {quote.payoutAmount} {quote.destinationCurrency}
                  </span>
                </div>
              </div>
            ) : null}

            <Link
              href={`/send?from=${senderCountry}&country=${selectedCountry}&amount=${sendAmount}`}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B3D91] px-4 py-3 text-sm font-bold text-white hover:bg-[#0B3D91]/90 transition"
            >
              <span>{t.home.ctaSend}</span>
              <ArrowRight className="h-4 w-4 text-[#F5B700]" />
            </Link>
          </div>
        </div>
      </section>

      {/* Dynamic Corridors Status Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t.home.corridorsTitle}
          </h2>
          {loading && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Synchronisation...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(corridors?.destinations || []).map((c) => (
            <div
              key={c.isoCode}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{c.flag}</span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {c.name} ({c.isoCode})
                    </h3>
                    <p className="text-xs font-mono text-slate-500">
                      Devise: {c.currency} ({c.dialCode})
                    </p>
                  </div>
                </div>
                {c.isDestinationAvailable ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Actif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    <AlertCircle className="h-3 w-3" />
                    Inactif
                  </span>
                )}
              </div>

              {c.networks.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.networks.map((n) => (
                    <span
                      key={n.code}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {n.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {c.statusNote}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Security Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <Shield className="h-6 w-6 text-[#0B3D91] dark:text-[#F5B700]" />
          <h3 className="font-bold text-sm">Double vérification serveur</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Aucun décaissement n&apos;est déclenché sur simple redirection navigateur. Chaque paiement est vérifié par webhook signé HMAC-SHA256 et via l&apos;endpoint officiel <code>/verify/</code>.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <Zap className="h-6 w-6 text-[#0B3D91] dark:text-[#F5B700]" />
          <h3 className="font-bold text-sm">Idempotence & Verrou Atomique</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Chaque paiement et retrait utilise un header <code>Idempotency-Key</code> unique et un verrou Postgres atomique pour éviter tout double débit.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <CheckCircle2 className="h-6 w-6 text-[#0B3D91] dark:text-[#F5B700]" />
          <h3 className="font-bold text-sm">Tarification Décimale Exacte</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Tous les montants sont calculés côté serveur sous forme de chaînes décimales exactes, sans aucune erreur d&apos;arrondi flottant.
          </p>
        </div>
      </section>
    </div>
  );
}


"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Send,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  CreditCard,
  Smartphone,
  Globe,
  UserCheck,
} from "lucide-react";
import { useAppPreferences } from "@/components/layout/AppPreferencesProvider";
import type { CorridorsData, CorridorCountry } from "@/lib/corridors";
import type { AdminUserRecord } from "@/lib/admin-store";

interface SavedRecipient {
  id: string;
  full_name: string;
  country_code: string;
  currency: string;
  network_code: string;
  network_name: string;
  msisdn: string;
}

const VIRTUAL_CARD_PROVIDERS = [
  "Vodacom Virtual Card (M-Pesa / VodaPay)",
  "Wave Carte Virtuelle Visa",
  "Orange Money Carte Virtuelle",
  "MTN MoMo Virtual Card",
  "Djamo Visa",
  "Eversend / Chipper Virtual Card",
  "Visa / Mastercard Bancaire Standard",
];

function SendFlowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useAppPreferences();

  const [corridors, setCorridors] = useState<CorridorsData | null>(null);
  const [recipients, setRecipients] = useState<SavedRecipient[]>([]);
  const [userProfile, setUserProfile] = useState<AdminUserRecord | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);

  // Inline Quick KYC Provisioning state
  const [quickDocType, setQuickDocType] = useState<
    "national_id" | "passport" | "driver_license" | "residence_permit"
  >("passport");
  const [quickDocNumber, setQuickDocNumber] = useState("CI-PASS-8841209");
  const [quickIdRecto, setQuickIdRecto] = useState<string>("");
  const [quickIdVerso, setQuickIdVerso] = useState<string>("");
  const [quickSelfie, setQuickSelfie] = useState<string>("");
  const [quickKycError, setQuickKycError] = useState<string | null>(null);
  const [provisioningKyc, setProvisioningKyc] = useState(false);

  const [senderCountry, setSenderCountry] = useState(
    searchParams.get("from") || "CI"
  );
  const [destinationCountry, setDestinationCountry] = useState(
    searchParams.get("country") || "ML"
  );
  const [destinationNetwork, setDestinationNetwork] = useState("orange_ml");
  const [sendAmount, setSendAmount] = useState(
    searchParams.get("amount") || "25000.00"
  );

  const [recipientMode, setRecipientMode] = useState<"saved" | "new">("new");
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientPhone, setNewRecipientPhone] = useState("");

  // Step 3: Payment Method (Virtual Card, Direct Mobile Money Softpay, or Hosted Checkout)
  const [paymentMethod, setPaymentMethod] = useState<
    "virtual_card" | "softpay" | "checkout"
  >("virtual_card");
  const [senderNetwork, setSenderNetwork] = useState("wave_ci");
  const [senderPhone, setSenderPhone] = useState("");
  const [virtualCardProvider, setVirtualCardProvider] = useState(
    VIRTUAL_CARD_PROVIDERS[0]
  );
  const [cardHolderName, setCardHolderName] = useState("");
  const [prepaymentOtp, setPrepaymentOtp] = useState("");

  const [quote, setQuote] = useState<{
    sendAmount: string;
    feeAmount: string;
    totalCharged: string;
    netSendAmount: string;
    exchangeRate: string;
    payoutAmount: string;
    senderCurrency: string;
    destinationCurrency: string;
    feeChargeMode: string;
  } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  );

  useEffect(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoadingInit(true);
      try {
        const [corrRes, recRes, profRes] = await Promise.all([
          fetch("/api/corridors"),
          fetch("/api/recipients"),
          fetch("/api/profile"),
        ]);
        const corrJson = await corrRes.json();
        let activeSenderIso = senderCountry;

        if (profRes.ok) {
          const profJson = await profRes.json();
          if (profJson.success && profJson.data?.profile) {
            const p: AdminUserRecord = profJson.data.profile;
            setUserProfile(p);
            if (!searchParams.get("from") && p.default_sender_country) {
              activeSenderIso = p.default_sender_country;
              setSenderCountry(p.default_sender_country);
            }
            if (p.default_payment_method) {
              setPaymentMethod(p.default_payment_method);
            }
            if (p.default_virtual_card_provider) {
              setVirtualCardProvider(p.default_virtual_card_provider);
            }
            if (p.full_name) {
              setCardHolderName(p.full_name);
            }
            if (p.phone) {
              setSenderPhone(p.phone);
            }
            if (p.kyc_document_type) {
              setQuickDocType(p.kyc_document_type);
            }
            if (p.kyc_document_number) {
              setQuickDocNumber(p.kyc_document_number);
            }
          }
        }

        if (corrJson.success && corrJson.data) {
          setCorridors(corrJson.data);
          const matchingDest = corrJson.data.destinations.find(
            (c: CorridorCountry) => c.isoCode === destinationCountry
          );
          if (matchingDest && matchingDest.networks[0]) {
            setDestinationNetwork(matchingDest.networks[0].code);
          }
          const matchingSender = (corrJson.data.senders || []).find(
            (c: CorridorCountry) => c.isoCode === activeSenderIso
          );
          if (matchingSender && matchingSender.networks[0]) {
            setSenderNetwork(matchingSender.networks[0].code);
          } else {
            setPaymentMethod("virtual_card");
          }
        }
        if (recRes.ok) {
          const recJson = await recRes.json();
          if (
            recJson.success &&
            Array.isArray(recJson.data) &&
            recJson.data.length > 0
          ) {
            setRecipients(recJson.data);
          }
        }
      } catch {
        // Handled in UI
      } finally {
        setLoadingInit(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildQuickSpecimen = (kind: "RECTO" | "VERSO" | "SELFIE") => {
    const holder = userProfile?.full_name || "Titulaire";
    const bg =
      kind === "RECTO" ? "#0B3D91" : kind === "VERSO" ? "#1E293B" : "#008751";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">
      <rect width="480" height="300" rx="20" fill="${bg}"/>
      <rect x="20" y="20" width="440" height="260" rx="14" fill="none" stroke="#F5B700" stroke-width="2" stroke-dasharray="6 4"/>
      <text x="40" y="110" fill="#F5B700" font-family="sans-serif" font-size="14" font-weight="bold">APACCI EXCHANGE — KYC ${kind}</text>
      <text x="40" y="150" fill="#FFFFFF" font-family="sans-serif" font-size="20" font-weight="bold">${holder}</text>
      <text x="40" y="185" fill="#E2E8F0" font-family="monospace" font-size="13">${quickDocNumber}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const handleQuickFileSelect = (
    setter: (val: string) => void,
    file: File | undefined
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickKycProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setQuickKycError(null);
    if (!quickIdRecto || !quickIdVerso || !quickSelfie) {
      setQuickKycError(
        locale === "fr"
          ? "Veuillez fournir les 3 photos obligatoires : Pièce d'Identité (Recto), Pièce d'Identité (Verso) et votre Selfie (ou cliquez sur 'Charger 3 photos spécimens')."
          : "Please provide all 3 mandatory photos: ID Front (Recto), ID Back (Verso), and your Selfie."
      );
      return;
    }
    setProvisioningKyc(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_kyc",
          payload: {
            full_name: userProfile.full_name,
            phone: userProfile.phone,
            country_code: senderCountry || userProfile.country_code,
            kyc_document_type: quickDocType,
            kyc_document_number: quickDocNumber,
            kyc_issuing_country: senderCountry || userProfile.country_code,
            kyc_id_recto_url: quickIdRecto,
            kyc_id_verso_url: quickIdVerso,
            kyc_selfie_url: quickSelfie,
            kyc_selfie_verified: true,
            instantVerify: true,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setQuickKycError(
          json.error?.message || "Erreur lors du provisionnement KYC."
        );
        return;
      }
      if (json.data) {
        setUserProfile(json.data);
        window.dispatchEvent(new CustomEvent("apacci-profile-updated"));
      }
    } finally {
      setProvisioningKyc(false);
    }
  };

  // Re-calculate server quote whenever amount, senderCountry, destinationCountry, or destinationNetwork changes
  useEffect(() => {
    if (!corridors) return;
    const dest = corridors.destinations.find(
      (d) => d.isoCode === destinationCountry
    );
    if (!dest || !dest.isDestinationAvailable) {
      setQuote(null);
      setQuoteError(
        dest?.statusNote ||
          `Le corridor de réception vers ${destinationCountry} n'est pas actif sur votre compte SasPay.`
      );
      return;
    }

    const timer = setTimeout(async () => {
      setQuoteError(null);
      const formattedAmount = sendAmount.trim().includes(".")
        ? sendAmount.trim()
        : `${sendAmount.trim()}.00`;
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sendAmount: formattedAmount,
            senderCountry,
            destinationCountry,
            destinationNetwork,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setQuote(json.data);
        } else {
          setQuote(null);
          setQuoteError(json.error?.message || "Montant ou corridor invalide.");
        }
      } catch {
        setQuoteError("Impossible de récupérer le tarif auprès du serveur.");
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [
    sendAmount,
    senderCountry,
    destinationCountry,
    destinationNetwork,
    corridors,
  ]);

  const currentSender =
    corridors?.senders?.find((s) => s.isoCode === senderCountry) ||
    corridors?.senderCountry;
  const currentDest = corridors?.destinations.find(
    (d) => d.isoCode === destinationCountry
  );
  const senderNetworks = currentSender?.networks || [];
  const selectedSenderNetObj = senderNetworks.find(
    (n) => n.code === senderNetwork
  );
  const filteredRecipients = recipients.filter(
    (r) => r.country_code === destinationCountry
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!quote || !currentDest || !currentDest.isDestinationAvailable) {
      setSubmitError("Veuillez choisir un corridor actif et un montant valide.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        sendAmount: quote.sendAmount,
        senderCountry,
        destinationCountry,
        destinationNetwork,
        idempotencyKey,
        paymentMethod,
      };

      if (paymentMethod === "virtual_card") {
        payload.virtualCardProvider = virtualCardProvider;
        if (cardHolderName.trim()) {
          payload.cardHolderName = cardHolderName.trim();
        }
        if (senderPhone.trim()) {
          payload.senderPhone = senderPhone.trim();
        }
      } else if (paymentMethod === "softpay") {
        payload.senderNetwork = senderNetwork;
        payload.senderPhone = senderPhone;
        if (prepaymentOtp.trim()) {
          payload.prepaymentOtp = prepaymentOtp.trim();
        }
      }

      if (recipientMode === "saved" && selectedRecipientId) {
        payload.recipientId = selectedRecipientId;
      } else {
        const netObj = currentDest.networks.find(
          (n) => n.code === destinationNetwork
        );
        payload.newRecipient = {
          fullName: newRecipientName,
          countryCode: currentDest.isoCode,
          currency: currentDest.currency,
          networkCode: destinationNetwork,
          networkName: netObj?.name || destinationNetwork,
          msisdn: newRecipientPhone,
        };
      }

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setSubmitError(
          json.error?.message || "Erreur lors de l'initialisation du transfert."
        );
        if (res.status === 400 || res.status === 422) {
          setIdempotencyKey(crypto.randomUUID());
        }
        return;
      }

      // Redirect user to SasPay hosted checkout if returned, otherwise to live transaction status screen
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
      } else if (json.data?.id) {
        router.push(`/transactions/${json.data.id}`);
      }
    } catch {
      setSubmitError(
        "Erreur de connexion au serveur. Vous pouvez réessayer sans risque de double débit (Idempotency-Key active)."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-[#0B3D91]" />
        <span className="text-sm font-medium">
          Chargement des corridors SasPay...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0B3D91] dark:text-white">
          {t.send.title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {locale === "fr"
            ? "Envoyez de l'argent depuis n'importe quel pays par Carte Virtuelle (Vodacom, Wave, Orange, MTN, Djamo, Visa/Mastercard) ou Mobile Money."
            : "Send money from any country via Virtual Card (Vodacom, Wave, Orange, MTN, Djamo, Visa/Mastercard) or Mobile Money."}
        </p>
      </div>

      {/* Active User KYC Status & Provisioning Gate */}
      {userProfile && !userProfile.kyc_provisioned ? (
        <div className="rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 p-6 sm:p-8 shadow-lg dark:border-amber-700 dark:from-amber-950/40 dark:via-slate-900 dark:to-amber-950/20 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-amber-500 p-3 text-white shadow-sm">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <span className="inline-flex items-center rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                  {locale === "fr"
                    ? "Provisionnement KYC Requis"
                    : "KYC Provisioning Required"}
                </span>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                  {locale === "fr"
                    ? `Bienvenue ${userProfile.full_name} — Complétez votre KYC avant d'envoyer`
                    : `Welcome ${userProfile.full_name} — Provision your KYC before sending`}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {locale === "fr"
                    ? "Conformément aux règles AML/CFT, veuillez renseigner votre pièce d'identité et votre pays d'origine pour débloquer l'accès aux transferts et au plafond KYC Vérifié (2 000 000 FCFA / transfert)."
                    : "In compliance with AML/CFT regulations, please provide your ID document and country of origin to unlock transfers and Verified KYC limits (2,000,000 XOF / transfer)."}
                </p>
              </div>
            </div>
            <Link
              href="/profile"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-amber-400 bg-white px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-200"
            >
              {locale === "fr" ? "Dossier Profil Complet →" : "Full Profile & Settings →"}
            </Link>
          </div>

          <form
            onSubmit={handleQuickKycProvision}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-amber-200/80 dark:border-amber-800/60"
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {locale === "fr" ? "Pays d'origine / Résidence" : "Country of Origin"}
              </label>
              <select
                value={senderCountry}
                onChange={(e) => setSenderCountry(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                {(corridors?.senders || []).map((c) => (
                  <option key={c.isoCode} value={c.isoCode}>
                    {c.flag} {c.name} ({c.currency})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {locale === "fr" ? "Type de Pièce Officielle" : "ID Document Type"}
              </label>
              <select
                value={quickDocType}
                onChange={(e) =>
                  setQuickDocType(
                    e.target.value as
                      | "national_id"
                      | "passport"
                      | "driver_license"
                      | "residence_permit"
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="passport">Passeport International</option>
                <option value="national_id">Carte Nationale d&apos;Identité (CNI)</option>
                <option value="driver_license">Permis de Conduire</option>
                <option value="residence_permit">Carte de Séjour / Résident</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {locale === "fr" ? "N° de Pièce d'Identité" : "Document Number"}
              </label>
              <input
                type="text"
                required
                value={quickDocNumber}
                onChange={(e) => setQuickDocNumber(e.target.value)}
                placeholder="Ex: CI-PASS-8841209"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            {/* 3 Mandatory Photos: ID Recto, ID Verso, Selfie */}
            <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-amber-300/80 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>1. Photo Pièce (RECTO) *</span>
                  <span
                    className={
                      quickIdRecto ? "text-emerald-600" : "text-amber-600"
                    }
                  >
                    {quickIdRecto ? "✓ Chargée" : "Requis"}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleQuickFileSelect(setQuickIdRecto, e.target.files?.[0])
                  }
                  className="w-full text-[10px] file:mr-2 file:rounded-lg file:border-0 file:bg-[#0B3D91] file:px-2.5 file:py-1 file:text-[10px] file:font-bold file:text-white"
                />
              </div>

              <div className="rounded-xl border border-amber-300/80 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>2. Photo Pièce (VERSO) *</span>
                  <span
                    className={
                      quickIdVerso ? "text-emerald-600" : "text-amber-600"
                    }
                  >
                    {quickIdVerso ? "✓ Chargée" : "Requis"}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleQuickFileSelect(setQuickIdVerso, e.target.files?.[0])
                  }
                  className="w-full text-[10px] file:mr-2 file:rounded-lg file:border-0 file:bg-[#0B3D91] file:px-2.5 file:py-1 file:text-[10px] file:font-bold file:text-white"
                />
              </div>

              <div className="rounded-xl border border-amber-300/80 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>3. Votre Selfie *</span>
                  <span
                    className={
                      quickSelfie ? "text-emerald-600" : "text-amber-600"
                    }
                  >
                    {quickSelfie ? "✓ Chargé" : "Requis"}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={(e) =>
                    handleQuickFileSelect(setQuickSelfie, e.target.files?.[0])
                  }
                  className="w-full text-[10px] file:mr-2 file:rounded-lg file:border-0 file:bg-[#008751] file:px-2.5 file:py-1 file:text-[10px] file:font-bold file:text-white"
                />
              </div>
            </div>

            {quickKycError && (
              <div className="sm:col-span-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                {quickKycError}
              </div>
            )}

            <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setQuickIdRecto(buildQuickSpecimen("RECTO"));
                  setQuickIdVerso(buildQuickSpecimen("VERSO"));
                  setQuickSelfie(buildQuickSpecimen("SELFIE"));
                  setQuickKycError(null);
                }}
                className="rounded-xl border border-[#0B3D91] bg-white px-3 py-1.5 text-[11px] font-bold text-[#0B3D91] hover:bg-blue-50 dark:border-[#F5B700] dark:bg-slate-800 dark:text-[#F5B700] cursor-pointer"
              >
                {locale === "fr"
                  ? "Charger 3 photos spécimens (Recto + Verso + Selfie)"
                  : "Load 3 sample photos (Front + Back + Selfie)"}
              </button>
              <button
                type="submit"
                disabled={provisioningKyc}
                className="inline-flex items-center gap-2 rounded-xl bg-[#008751] px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-[#006b40] disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                {provisioningKyc
                  ? locale === "fr"
                    ? "Provisionnement..."
                    : "Provisioning..."
                  : locale === "fr"
                  ? "Provisionner mon KYC & Débloquer le Transfert"
                  : "Provision KYC & Unlock Transfer"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              {userProfile ? (
                <>
                  <strong>{userProfile.full_name}</strong> —{" "}
                  {locale === "fr"
                    ? `KYC Provisionné (${userProfile.kyc_status.toUpperCase()}) • Plafond : ${
                        userProfile.kyc_status === "verified"
                          ? "2 000 000 FCFA / transfert"
                          : "150 000 FCFA / transfert"
                      }`
                    : `KYC Provisioned (${userProfile.kyc_status.toUpperCase()}) • Limit: ${
                        userProfile.kyc_status === "verified"
                          ? "2,000,000 XOF / transfer"
                          : "150,000 XOF / transfer"
                      }`}
                </>
              ) : (
                t.send.kycNotice
              )}
            </span>
          </div>
          <Link
            href="/profile"
            className="text-[11px] font-bold text-[#0B3D91] underline dark:text-[#F5B700]"
          >
            {locale === "fr" ? "Gérer mon profil & mes cartes" : "Manage profile & cards"}
          </Link>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-6"
      >
        {/* Step 1: Origin Country, Destination Corridor & Amount */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#0B3D91] dark:text-[#F5B700]">
            {t.send.step1}
          </h2>

          {/* Sender Country Selector (Country of Origin of the Money) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {locale === "fr"
                ? "Pays d'origine de l'argent (Country of Origin)"
                : "Country of Origin of the Money"}
            </label>
            <select
              value={senderCountry}
              onChange={(e) => {
                const code = e.target.value;
                setSenderCountry(code);
                const s = corridors?.senders?.find((x) => x.isoCode === code);
                if (s && s.networks.length > 0) {
                  setSenderNetwork(s.networks[0].code);
                } else {
                  setSenderNetwork("card");
                  setPaymentMethod("virtual_card");
                }
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              {(corridors?.senders || corridors?.destinations || []).map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
                  {c.flag} {c.name} ({c.currency}) —{" "}
                  {c.networks.length > 0
                    ? `Mobile Money (${c.networks.length}) & Carte Virtuelle (Visa/Mastercard)`
                    : "Sans Mobile Money — Paiement par Carte Virtuelle (Visa / Mastercard)"}
                </option>
              ))}
            </select>

            {currentSender && currentSender.networks.length === 0 && (
              <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs font-medium text-[#0B3D91] dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200 flex items-center gap-2">
                <CreditCard className="h-4 w-4 shrink-0 text-[#F5B700]" />
                <span>
                  {locale === "fr"
                    ? `${currentSender.flag} ${currentSender.name} (${currentSender.currency}) ne dispose pas de service Mobile Money direct. Votre envoi s'effectue automatiquement par Carte Virtuelle (Visa ou Mastercard).`
                    : `${currentSender.flag} ${currentSender.name} (${currentSender.currency}) has no direct Mobile Money facility. Your transfer proceeds via Virtual Card (Visa or Mastercard).`}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.send.chooseCountry}
              </label>
              <select
                value={destinationCountry}
                onChange={(e) => {
                  const code = e.target.value;
                  setDestinationCountry(code);
                  const d = corridors?.destinations.find(
                    (x) => x.isoCode === code
                  );
                  setDestinationNetwork(d?.networks[0]?.code || "");
                  setSelectedRecipientId("");
                }}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              >
                {(corridors?.destinations || []).map((c) => (
                  <option key={c.isoCode} value={c.isoCode}>
                    {c.flag} {c.name} ({c.currency}){" "}
                    {!c.isDestinationAvailable
                      ? "— [Réception Mobile Money inactive]"
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.send.selectNetwork}
              </label>
              <select
                value={destinationNetwork}
                onChange={(e) => setDestinationNetwork(e.target.value)}
                disabled={!currentDest || currentDest.networks.length === 0}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold focus:border-[#0B3D91] focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
              >
                {currentDest && currentDest.networks.length > 0 ? (
                  currentDest.networks.map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.name} ({n.code})
                    </option>
                  ))
                ) : (
                  <option value="">Aucun réseau actif</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {locale === "fr"
                ? `Montant à envoyer (${currentSender?.currency || "XOF"})`
                : `Amount to send (${currentSender?.currency || "XOF"})`}
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                required
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pr-16 text-lg font-extrabold focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                {currentSender?.currency || "XOF"}
              </span>
            </div>
          </div>

          {/* Quote Breakdown Box */}
          {quoteError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{quoteError}</span>
            </div>
          ) : quote ? (
            <div className="rounded-2xl bg-slate-100 p-4 space-y-2 dark:bg-slate-800/90">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>
                  Montant envoyé ({currentSender?.flag} {currentSender?.name})
                </span>
                <span className="font-semibold">
                  {quote.sendAmount} {quote.senderCurrency}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Frais ({quote.feeChargeMode})</span>
                <span className="font-semibold">
                  {quote.feeAmount} {quote.senderCurrency}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>Taux de change appliqué</span>
                <span className="font-mono font-semibold">
                  1 {quote.senderCurrency} ={" "}
                  {Number(quote.exchangeRate).toFixed(4)}{" "}
                  {quote.destinationCurrency}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-700 dark:text-slate-200">
                <span className="font-bold">Total à débiter</span>
                <span className="font-bold">
                  {quote.totalCharged} {quote.senderCurrency}
                </span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-baseline">
                <span className="text-xs font-bold text-[#0B3D91] dark:text-[#F5B700]">
                  Montant exact reçu par le bénéficiaire ({currentDest?.flag}{" "}
                  {currentDest?.name})
                </span>
                <span className="text-xl font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
                  {quote.payoutAmount} {quote.destinationCurrency}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Step 2: Recipient */}
        <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0B3D91] dark:text-[#F5B700]">
              {t.send.step2}
            </h2>
            {filteredRecipients.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientMode("saved")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    recipientMode === "saved"
                      ? "bg-[#0B3D91] text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {t.send.selectRecipient}
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode("new")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    recipientMode === "new"
                      ? "bg-[#0B3D91] text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  + {t.send.orAddNew}
                </button>
              </div>
            )}
          </div>

          {recipientMode === "saved" && filteredRecipients.length > 0 ? (
            <div>
              <select
                required
                value={selectedRecipientId}
                onChange={(e) => setSelectedRecipientId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">-- Choisir un bénéficiaire --</option>
                {filteredRecipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name} — {r.msisdn} ({r.network_name})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.send.recipientName}
                </label>
                <input
                  type="text"
                  required
                  value={newRecipientName}
                  onChange={(e) => setNewRecipientName(e.target.value)}
                  placeholder="Moussa Traoré"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.send.recipientPhone} ({currentDest?.dialCode || "+..."})
                </label>
                <input
                  type="tel"
                  required
                  value={newRecipientPhone}
                  onChange={(e) => setNewRecipientPhone(e.target.value)}
                  placeholder={`${currentDest?.dialCode || "+223"}70000000`}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-mono focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Payment Method (Virtual Card, Direct Mobile Money Softpay, or Hosted Checkout) */}
        <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#0B3D91] dark:text-[#F5B700]">
            {t.send.step3}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod("virtual_card")}
              className={`rounded-2xl border p-3.5 text-left transition ${
                paymentMethod === "virtual_card"
                  ? "border-[#0B3D91] bg-blue-50/70 dark:border-[#F5B700] dark:bg-blue-950/40"
                  : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0B3D91] dark:text-white">
                <CreditCard className="h-4 w-4 text-[#F5B700]" />
                <span>Carte Virtuelle / Carte</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Vodacom Virtual Card, Wave Visa, Orange, MTN, Djamo, Visa / Mastercard (Tous pays)
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("softpay")}
              disabled={senderNetworks.length === 0}
              className={`rounded-2xl border p-3.5 text-left transition disabled:opacity-50 ${
                paymentMethod === "softpay"
                  ? "border-[#0B3D91] bg-blue-50/70 dark:border-[#F5B700] dark:bg-blue-950/40"
                  : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0B3D91] dark:text-white">
                <Smartphone className="h-4 w-4 text-[#F5B700]" />
                <span>Mobile Money Direct</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {senderNetworks.length > 0
                  ? `Push USSD / Redirection (${currentSender?.name})`
                  : `Non disponible en direct pour ${currentSender?.name} (utilisez Carte Virtuelle)`}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("checkout")}
              className={`rounded-2xl border p-3.5 text-left transition ${
                paymentMethod === "checkout"
                  ? "border-[#0B3D91] bg-blue-50/70 dark:border-[#F5B700] dark:bg-blue-950/40"
                  : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0B3D91] dark:text-white">
                <Globe className="h-4 w-4 text-[#F5B700]" />
                <span>Checkout Hébergé</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Portail multi-moyens SasPay ({currentSender?.currency})
              </p>
            </button>
          </div>

          {/* Virtual Card Form */}
          {paymentMethod === "virtual_card" && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Émetteur de la Carte Virtuelle / Bancaire
                  </label>
                  <select
                    value={virtualCardProvider}
                    onChange={(e) => setVirtualCardProvider(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                  >
                    {VIRTUAL_CARD_PROVIDERS.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nom du titulaire de la carte virtuelle
                  </label>
                  <input
                    type="text"
                    required
                    value={cardHolderName}
                    onChange={(e) => setCardHolderName(e.target.value)}
                    placeholder="Ex: Sipho Dlamini / Awa Konaté"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Téléphone du payeur ({currentSender?.dialCode || "+225"}, pour notification 3DS / reçu)
                </label>
                <input
                  type="tel"
                  required
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder={`${currentSender?.dialCode || "+27"}820000000`}
                  className="w-full sm:w-72 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Conformément aux règles de sécurité PCI-DSS et SasPay, les numéros de votre carte virtuelle (16 chiffres, date d&apos;expiration et CVV) ne transitent jamais en clair sur Apacci Exchange : ils sont saisis sur la page 3D Secure SasPay (<code>network: &quot;card&quot;</code>).
              </p>
            </div>
          )}

          {/* Direct Mobile Money Softpay Form */}
          {paymentMethod === "softpay" && senderNetworks.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Votre opérateur Mobile Money ({currentSender?.flag}{" "}
                    {currentSender?.name})
                  </label>
                  <select
                    value={senderNetwork}
                    onChange={(e) => setSenderNetwork(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                  >
                    {senderNetworks.map((net) => (
                      <option key={net.code} value={net.code}>
                        {net.name} ({net.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Votre numéro de téléphone débiteur (
                    {currentSender?.dialCode || "+..."})
                  </label>
                  <input
                    type="tel"
                    required={paymentMethod === "softpay"}
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder={`${currentSender?.dialCode || "+225"}07000000`}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              </div>

              {(selectedSenderNetObj?.otpRequired ||
                senderNetwork === "orange_ci") && (
                <div>
                  <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    Code OTP pré-paiement requis (
                    {selectedSenderNetObj?.otpInstructions ||
                      "Composez #144*82# sur votre téléphone Orange Money"}
                    )
                  </label>
                  <input
                    type="text"
                    required={
                      paymentMethod === "softpay" &&
                      (selectedSenderNetObj?.otpRequired ||
                        senderNetwork === "orange_ci")
                    }
                    value={prepaymentOtp}
                    onChange={(e) => setPrepaymentOtp(e.target.value)}
                    placeholder="Ex: 1234"
                    className="w-full sm:w-48 rounded-xl border border-amber-400 bg-white px-3 py-2 text-xs font-mono dark:border-amber-700 dark:bg-slate-900"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {submitError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={
            submitting ||
            !quote ||
            !currentDest ||
            !currentDest.isDestinationAvailable
          }
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B3D91] px-6 py-4 text-sm font-extrabold text-white shadow-md hover:bg-[#0B3D91]/90 disabled:opacity-50 transition"
        >
          <Send className="h-4 w-4 text-[#F5B700]" />
          <span>{submitting ? t.send.processing : t.send.payNow}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export default function SendPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-slate-500">
          Chargement...
        </div>
      }
    >
      <SendFlowContent />
    </Suspense>
  );
}

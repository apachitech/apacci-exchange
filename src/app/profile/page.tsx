"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  User,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  Bell,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  Trash2,
  FileCheck2,
  RefreshCw,
  Send,
  Camera,
  Upload,
} from "lucide-react";
import { useAppPreferences } from "@/components/layout/AppPreferencesProvider";

interface SavedVirtualCard {
  id: string;
  provider: string;
  brand: "VISA" | "MASTERCARD";
  cardholder_name: string;
  last4: string;
  expiry: string;
  origin_country: string;
  currency: string;
  is_default: boolean;
}

interface UserProfileData {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  country_code: string;
  role: "client" | "admin";
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  kyc_provisioned?: boolean;
  date_of_birth?: string;
  nationality?: string;
  address_line?: string;
  city?: string;
  occupation?: string;
  source_of_funds?: string;
  kyc_document_type?: "national_id" | "passport" | "driver_license" | "residence_permit";
  kyc_document_number?: string;
  kyc_issuing_country?: string;
  kyc_document_expiry?: string;
  kyc_id_recto_url?: string | null;
  kyc_id_verso_url?: string | null;
  kyc_selfie_url?: string | null;
  kyc_selfie_verified?: boolean;
  kyc_submitted_at?: string | null;
  default_sender_country?: string;
  default_payment_method?: "virtual_card" | "softpay" | "checkout";
  default_virtual_card_provider?: string;
  default_virtual_card_last4?: string;
  saved_virtual_cards?: SavedVirtualCard[];
  preferred_locale?: "fr" | "en";
  notify_email?: boolean;
  notify_sms?: boolean;
  notify_push_pwa?: boolean;
  two_factor_enabled?: boolean;
  transaction_pin_enabled?: boolean;
}

interface ProfileSummaryOption {
  id: string;
  full_name: string;
  email: string;
  country_code: string;
  role: string;
  kyc_status: string;
  kyc_provisioned: boolean;
}

type ProfileTab = "kyc" | "personal" | "cards" | "preferences" | "security";

const VIRTUAL_CARD_PROVIDERS = [
  "Vodacom Virtual Card (M-Pesa / VodaPay)",
  "Wave Carte Virtuelle Visa",
  "Orange Money Carte Virtuelle",
  "MTN MoMo Virtual Card",
  "Djamo Visa",
  "Eversend / Chipper Virtual Card",
  "Visa / Mastercard Bancaire Standard",
];

const ORIGIN_COUNTRIES = [
  { code: "CI", name: "🇨🇮 Côte d'Ivoire (XOF)" },
  { code: "SN", name: "🇸🇳 Sénégal (XOF)" },
  { code: "ML", name: "🇲🇱 Mali (XOF)" },
  { code: "BF", name: "🇧🇫 Burkina Faso (XOF)" },
  { code: "BJ", name: "🇧🇯 Bénin (XOF)" },
  { code: "TG", name: "🇹🇬 Togo (XOF)" },
  { code: "CM", name: "🇨🇲 Cameroun (XAF)" },
  { code: "GA", name: "🇬🇦 Gabon (XAF — Carte Virtuelle)" },
  { code: "CD", name: "🇨🇩 RD Congo (CDF)" },
  { code: "ZA", name: "🇿🇦 Afrique du Sud (ZAR — Carte Virtuelle)" },
  { code: "TZ", name: "🇹🇿 Tanzanie (TZS)" },
  { code: "KE", name: "🇰🇪 Kenya (KES)" },
  { code: "NG", name: "🇳🇬 Nigeria (NGN)" },
  { code: "GH", name: "🇬🇭 Ghana (GHS)" },
  { code: "RW", name: "🇷🇼 Rwanda (RWF)" },
  { code: "UG", name: "🇺🇬 Ouganda (UGX)" },
  { code: "ZM", name: "🇿🇲 Zambie (ZMW)" },
  { code: "MW", name: "🇲🇼 Malawi (MWK)" },
  { code: "GN", name: "🇬🇳 Guinée (GNF)" },
  { code: "MA", name: "🇲🇦 Maroc (MAD — Carte Virtuelle)" },
  { code: "EG", name: "🇪🇬 Égypte (EGP — Carte Virtuelle)" },
  { code: "FR", name: "🇫🇷 France / Zone Euro (EUR — Carte Virtuelle)" },
  { code: "US", name: "🇺🇸 États-Unis (USD — Carte Virtuelle)" },
  { code: "GB", name: "🇬🇧 Royaume-Uni (GBP — Carte Virtuelle)" },
  { code: "CA", name: "🇨🇦 Canada (CAD — Carte Virtuelle)" },
];

export default function UserProfilePage() {
  const { locale, setLocale, theme, toggleTheme } = useAppPreferences();
  const [tab, setTab] = useState<ProfileTab>("kyc");
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [limits, setLimits] = useState({
    txLimitXof: "100000.00",
    monthlyLimitXof: "500000.00",
    monthlyUsedXof: "0.00",
  });
  const [availableProfiles, setAvailableProfiles] = useState<ProfileSummaryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live Camera Capture State (for Recto, Verso, or Selfie)
  const [cameraTarget, setCameraTarget] = useState<
    "kyc_id_recto_url" | "kyc_id_verso_url" | "kyc_selfie_url" | null
  >(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const buildSpecimenSvg = (
    kind: "RECTO" | "VERSO" | "SELFIE",
    holder: string,
    docNum: string
  ) => {
    const bg =
      kind === "RECTO" ? "#0B3D91" : kind === "VERSO" ? "#1E293B" : "#008751";
    const label =
      kind === "RECTO"
        ? `PIECE D'IDENTITE — RECTO (${docNum})`
        : kind === "VERSO"
        ? `PIECE D'IDENTITE — VERSO (MRZ / CODE-BARRES)`
        : `SELFIE BIOMETRIQUE EN DIRECT`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">
      <rect width="480" height="300" rx="20" fill="${bg}"/>
      <rect x="20" y="20" width="440" height="260" rx="14" fill="none" stroke="#F5B700" stroke-width="2" stroke-dasharray="6 4"/>
      <circle cx="95" cy="145" r="46" fill="#F5B700" opacity="0.25"/>
      <circle cx="95" cy="132" r="18" fill="#F5B700"/>
      <path d="M62 175 C62 155 128 155 128 175" fill="#F5B700"/>
      <text x="165" y="105" fill="#F5B700" font-family="sans-serif" font-size="13" font-weight="bold">APACCI EXCHANGE — KYC AML/CFT</text>
      <text x="165" y="138" fill="#FFFFFF" font-family="sans-serif" font-size="18" font-weight="bold">${holder}</text>
      <text x="165" y="168" fill="#E2E8F0" font-family="monospace" font-size="12">${label}</text>
      <text x="165" y="210" fill="#94A3B8" font-family="monospace" font-size="11">CAPTURE CERTIFIEE</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const handlePhotoUpload = (
    field: "kyc_id_recto_url" | "kyc_id_verso_url" | "kyc_selfie_url",
    file: File | undefined
  ) => {
    if (!file || !profile) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                [field]: reader.result as string,
              }
            : prev
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const startWebcam = async (
    target: "kyc_id_recto_url" | "kyc_id_verso_url" | "kyc_selfie_url"
  ) => {
    setError(null);
    setCameraTarget(target);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: target === "kyc_selfie_url" ? "user" : "environment",
            width: { ideal: 640 },
            height: { ideal: 420 },
          },
          audio: false,
        });
        streamRef.current = stream;
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        }, 100);
      } else {
        throw new Error("Caméra non détectée sur ce navigateur.");
      }
    } catch {
      // Fallback: if no physical webcam is attached, generate a realistic camera capture frame
      if (profile) {
        const kind =
          target === "kyc_id_recto_url"
            ? "RECTO"
            : target === "kyc_id_verso_url"
            ? "VERSO"
            : "SELFIE";
        const dataUrl = buildSpecimenSvg(
          kind,
          profile.full_name || "Titulaire",
          profile.kyc_document_number || "CNI-2026-884920"
        );
        setProfile({ ...profile, [target]: dataUrl });
        setCameraTarget(null);
        setFeedback(
          `Capture ${kind} simulée enregistrée (aucune webcam physique détectée). Vous pouvez aussi importer un fichier image.`
        );
      }
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraTarget(null);
  };

  const captureWebcamPhoto = () => {
    if (!cameraTarget || !profile) return;
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setProfile({ ...profile, [cameraTarget]: dataUrl });
      }
    } else {
      const kind =
        cameraTarget === "kyc_id_recto_url"
          ? "RECTO"
          : cameraTarget === "kyc_id_verso_url"
          ? "VERSO"
          : "SELFIE";
      setProfile({
        ...profile,
        [cameraTarget]: buildSpecimenSvg(
          kind,
          profile.full_name || "Titulaire",
          profile.kyc_document_number || "CNI-2026-884920"
        ),
      });
    }
    stopWebcam();
  };

  const handleFillSamplePhotos = () => {
    if (!profile) return;
    const docNum = profile.kyc_document_number || "CNI-2026-884920";
    const holder = profile.full_name || "Titulaire";
    setProfile({
      ...profile,
      kyc_document_number: docNum,
      kyc_id_recto_url: buildSpecimenSvg("RECTO", holder, docNum),
      kyc_id_verso_url: buildSpecimenSvg("VERSO", holder, docNum),
      kyc_selfie_url: buildSpecimenSvg("SELFIE", holder, docNum),
      kyc_selfie_verified: true,
    });
    setFeedback(
      "Les 3 photos spécimens (Pièce d'Identité Recto, Verso et Selfie) ont été chargées."
    );
  };

  // New Virtual Card form
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({
    provider: VIRTUAL_CARD_PROVIDERS[0],
    brand: "VISA" as "VISA" | "MASTERCARD",
    cardholder_name: "",
    last4: "4821",
    expiry: "12/28",
    origin_country: "ZA",
    currency: "ZAR",
    is_default: true,
  });

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Impossible de charger votre profil.");
        return;
      }
      setProfile(json.data.profile);
      if (json.data.limits) setLimits(json.data.limits);
      if (json.data.availableProfiles) {
        setAvailableProfiles(json.data.availableProfiles);
      }
    } catch {
      setError("Erreur réseau lors du chargement du profil.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function postProfileAction(
    action: string,
    payload: Record<string, unknown>,
    successMessage: string,
    extraRoot?: Record<string, unknown>
  ) {
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload, ...(extraRoot || {}) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Erreur lors de la sauvegarde.");
        return false;
      }
      setFeedback(successMessage);
      await loadProfile();
      window.dispatchEvent(new Event("apacci-profile-updated"));
      return true;
    } catch {
      setError("Erreur réseau lors de la mise à jour du profil.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return (
      <div className="py-20 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-[#0B3D91]" />
        <span>Chargement de votre espace profil & KYC...</span>
      </div>
    );
  }

  const usedPct = Math.min(
    100,
    Math.round(
      ((Number.parseFloat(limits.monthlyUsedXof) || 0) /
        Math.max(1, Number.parseFloat(limits.monthlyLimitXof) || 500000)) *
        100
    )
  );

  const isProvisioned =
    Boolean(profile.kyc_provisioned) ||
    profile.kyc_status === "verified" ||
    profile.kyc_status === "pending";

  return (
    <div className="space-y-6">
      {/* Top Profile Banner & Demo Switcher */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0B3D91] via-[#092f70] to-slate-900 p-6 sm:p-8 text-white shadow-lg space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F5B700] text-2xl font-extrabold text-slate-950 shadow-md">
              {(profile.full_name || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold">
                  {profile.full_name}
                </h1>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold uppercase">
                  {profile.role}
                </span>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-extrabold uppercase ${
                    profile.kyc_status === "verified"
                      ? "bg-emerald-400 text-slate-950"
                      : profile.kyc_status === "pending"
                      ? "bg-[#F5B700] text-slate-950"
                      : "bg-rose-500 text-white"
                  }`}
                >
                  KYC: {profile.kyc_status}
                </span>
              </div>
              <p className="text-xs text-blue-100">
                {profile.email} • {profile.phone} • Pays d&apos;origine:{" "}
                <strong>{profile.country_code}</strong>
              </p>
            </div>
          </div>

          {availableProfiles.length > 0 && (
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur border border-white/15">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#F5B700] mb-1">
                Changer de profil utilisateur (Test KYC Gate)
              </label>
              <select
                value={profile.id}
                onChange={(e) =>
                  postProfileAction(
                    "switch_demo_profile",
                    {},
                    "Profil actif changé.",
                    { userId: e.target.value }
                  )
                }
                className="rounded-xl bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-white border border-white/20 focus:outline-none"
              >
                {availableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.country_code}) — KYC: {p.kyc_status}{" "}
                    {!p.kyc_provisioned ? "[Non provisionné]" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* KYC Provisioning Gate Alert inside Header */}
        {!isProvisioned ? (
          <div className="rounded-2xl bg-amber-400/95 p-4 text-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-sm">
                  Provisionnement KYC requis avant d&apos;envoyer de l&apos;argent
                </p>
                <p className="font-medium">
                  Veuillez compléter le formulaire de provisionnement d&apos;identité ci-dessous (pièce d&apos;identité, pays d&apos;origine et source des fonds) pour débloquer l&apos;accès aux transferts Apacci Exchange.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/15 text-xs">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-blue-200">Plafond par transaction</p>
              <p className="text-base font-extrabold text-[#F5B700] font-mono">
                {limits.txLimitXof} XOF
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-blue-200">
                Volume mensuel utilisé ({usedPct}%)
              </p>
              <p className="text-base font-extrabold font-mono">
                {limits.monthlyUsedXof} / {limits.monthlyLimitXof} XOF
              </p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-[#F5B700]"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl bg-white/10 p-3 flex items-center justify-between">
              <div>
                <p className="text-blue-200">Accès aux transferts</p>
                <p className="text-sm font-extrabold text-emerald-300">
                  Autorisé & Provisionné
                </p>
              </div>
              <Link
                href="/send"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F5B700] px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-[#F5B700]/90"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Envoyer</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setTab("kyc")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
            tab === "kyc"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <FileCheck2 className="h-4 w-4 text-[#F5B700]" />
          <span>1. Provisionnement KYC & Identité</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("personal")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
            tab === "personal"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <User className="h-4 w-4" />
          <span>2. Informations Personnelles</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("cards")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
            tab === "cards"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>
            3. Cartes Virtuelles & Paiement (
            {(profile.saved_virtual_cards || []).length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("preferences")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
            tab === "preferences"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>4. Préférences & Notifications</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("security")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
            tab === "security"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <Lock className="h-4 w-4" />
          <span>5. Sécurité & Accès</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: KYC PROVISIONING WIZARD                                        */}
      {/* ===================================================================== */}
      {tab === "kyc" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#0B3D91] dark:text-white">
                Provisionnement KYC & Vérification Réglementaire (AML / CFT)
              </h2>
              <p className="text-xs text-slate-500">
                Ce dossier KYC conditionne l&apos;accès à l&apos;envoi de fonds et détermine vos plafonds par transaction (100 000 XOF → 2 000 000 XOF).
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase ${
                profile.kyc_status === "verified"
                  ? "bg-emerald-100 text-emerald-800"
                  : profile.kyc_status === "pending"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              Statut actuel : {profile.kyc_status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Nom et Prénoms (tels que sur la pièce)
              </label>
              <input
                type="text"
                required
                value={profile.full_name}
                onChange={(e) =>
                  setProfile({ ...profile, full_name: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Date de naissance
              </label>
              <input
                type="date"
                value={profile.date_of_birth || "1992-05-15"}
                onChange={(e) =>
                  setProfile({ ...profile, date_of_birth: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Pays d&apos;origine des fonds
              </label>
              <select
                value={profile.country_code}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    country_code: e.target.value,
                    nationality: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                {ORIGIN_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Type de pièce d&apos;identité
              </label>
              <select
                value={profile.kyc_document_type || "national_id"}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    kyc_document_type:
                      e.target.value as UserProfileData["kyc_document_type"],
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="national_id">Carte Nationale d&apos;Identité (CNI)</option>
                <option value="passport">Passeport Biométrique</option>
                <option value="driver_license">Permis de Conduire</option>
                <option value="residence_permit">Carte Consulaire / Titre de Séjour</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Numéro de la pièce d&apos;identité
              </label>
              <input
                type="text"
                required
                value={profile.kyc_document_number || ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    kyc_document_number: e.target.value,
                  })
                }
                placeholder="Ex: CNI-2026-9948102"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Date d&apos;expiration de la pièce
              </label>
              <input
                type="date"
                value={profile.kyc_document_expiry || "2030-12-31"}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    kyc_document_expiry: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Profession / Activité
              </label>
              <input
                type="text"
                value={profile.occupation || ""}
                onChange={(e) =>
                  setProfile({ ...profile, occupation: e.target.value })
                }
                placeholder="Ex: Ingénieur, Commerçant, Étudiant..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Origine principale des fonds (Source of Funds)
              </label>
              <select
                value={profile.source_of_funds || "salary"}
                onChange={(e) =>
                  setProfile({ ...profile, source_of_funds: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="salary">Salaire / Revenus professionnels</option>
                <option value="business">Revenus commerciaux / Entreprise</option>
                <option value="savings">Épargne personnelle</option>
                <option value="family_support">Soutien familial</option>
                <option value="investment">Investissement / Dividendes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Ville & Adresse de résidence
              </label>
              <input
                type="text"
                value={profile.address_line || ""}
                onChange={(e) =>
                  setProfile({ ...profile, address_line: e.target.value })
                }
                placeholder="Ex: Rue Lepic, Cocody / Sandton"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* ================================================================= */}
          {/* MANDATORY KYC PHOTOS: ID RECTO, ID VERSO & BIOMETRIC SELFIE       */}
          {/* ================================================================= */}
          <div className="rounded-2xl border-2 border-blue-200/80 bg-blue-50/40 p-5 dark:border-slate-700 dark:bg-slate-800/50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
                  Pièces Justificatives Photographiques Obligatoires (Recto, Verso & Selfie)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Importez une photo ou utilisez votre caméra pour fournir : <strong>1) le Recto</strong> de votre pièce d&apos;identité, <strong>2) le Verso</strong> de votre pièce, et <strong>3) un Selfie</strong> de vous-même.
                </p>
              </div>
              <button
                type="button"
                onClick={handleFillSamplePhotos}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[#0B3D91] bg-white px-3 py-1.5 text-[11px] font-bold text-[#0B3D91] hover:bg-blue-50 dark:border-[#F5B700] dark:bg-slate-900 dark:text-[#F5B700] cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Charger 3 photos spécimens (Test rapide)</span>
              </button>
            </div>

            {cameraTarget && (
              <div className="rounded-2xl border-2 border-[#0B3D91] bg-slate-950 p-4 text-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#F5B700] uppercase">
                    Caméra en direct —{" "}
                    {cameraTarget === "kyc_id_recto_url"
                      ? "Pièce d'Identité (RECTO)"
                      : cameraTarget === "kyc_id_verso_url"
                      ? "Pièce d'Identité (VERSO)"
                      : "Selfie Biométrique"}
                  </span>
                  <button
                    type="button"
                    onClick={stopWebcam}
                    className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/20 cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="mx-auto max-h-64 w-full max-w-md rounded-xl border border-white/20 bg-black object-cover"
                />
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={captureWebcamPhoto}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#008751] px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-[#006b40] cursor-pointer"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Prendre la photo maintenant</span>
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. ID Photo RECTO */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      1. Pièce d&apos;Identité — RECTO *
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        profile.kyc_id_recto_url
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {profile.kyc_id_recto_url ? "✓ Fourni" : "Requis"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Face avant lisible avec photo, nom complet et numéro de pièce.
                  </p>
                </div>

                {profile.kyc_id_recto_url ? (
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 h-36">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profile.kyc_id_recto_url}
                      alt="Pièce d'identité Recto"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/40">
                    <Upload className="h-6 w-6 mb-1" />
                    <span className="text-[11px] font-semibold">
                      Aucune photo Recto
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <label className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B3D91] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#0B3D91]/90 cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Importer Recto</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handlePhotoUpload("kyc_id_recto_url", e.target.files?.[0])
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => startWebcam("kyc_id_recto_url")}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
                    title="Prendre en photo avec la caméra"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Caméra</span>
                  </button>
                </div>
              </div>

              {/* 2. ID Photo VERSO */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      2. Pièce d&apos;Identité — VERSO *
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        profile.kyc_id_verso_url
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {profile.kyc_id_verso_url ? "✓ Fourni" : "Requis"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Face arrière avec bande MRZ, autorité d&apos;émission et date d&apos;expiration.
                  </p>
                </div>

                {profile.kyc_id_verso_url ? (
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 h-36">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profile.kyc_id_verso_url}
                      alt="Pièce d'identité Verso"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/40">
                    <Upload className="h-6 w-6 mb-1" />
                    <span className="text-[11px] font-semibold">
                      Aucune photo Verso
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <label className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B3D91] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#0B3D91]/90 cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Importer Verso</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handlePhotoUpload("kyc_id_verso_url", e.target.files?.[0])
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => startWebcam("kyc_id_verso_url")}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
                    title="Prendre en photo avec la caméra"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Caméra</span>
                  </button>
                </div>
              </div>

              {/* 3. Biometric SELFIE of the User */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      3. Votre Selfie Biométrique *
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        profile.kyc_selfie_url
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {profile.kyc_selfie_url ? "✓ Fourni" : "Requis"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Photo claire de votre visage (sans lunettes de soleil ni chapeau).
                  </p>
                </div>

                {profile.kyc_selfie_url ? (
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 h-36">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profile.kyc_selfie_url}
                      alt="Selfie biométrique"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/40">
                    <Camera className="h-6 w-6 mb-1" />
                    <span className="text-[11px] font-semibold">
                      Aucun Selfie fourni
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => startWebcam("kyc_selfie_url")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#008751] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#006b40] cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Prendre Selfie</span>
                  </button>
                  <label className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Importer</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handlePhotoUpload("kyc_selfie_url", e.target.files?.[0])
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/50 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(profile.kyc_selfie_verified ?? true)}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  kyc_selfie_verified: e.target.checked,
                })
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0B3D91]"
            />
            <span>
              Je certifie sur l&apos;honneur l&apos;exactitude des informations d&apos;identité fournies, la correspondance biométrique (Selfie) et l&apos;origine licite des fonds transférés via Apacci Exchange et SasPay.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                postProfileAction(
                  "submit_kyc",
                  {
                    ...profile,
                    kyc_document_number:
                      profile.kyc_document_number || "CNI-2026-884920",
                    instantVerify: true,
                  },
                  "KYC provisionné et vérifié avec succès ! Vos plafonds Tier 2 (2 000 000 XOF/tx) et l'accès à /send sont activés."
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B3D91] px-5 py-3 text-xs font-extrabold text-white shadow-sm hover:bg-[#0B3D91]/90 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4 text-[#F5B700]" />
              <span>
                Provisionner & Vérifier mon KYC maintenant (Débloquer Plafonds Tier 2)
              </span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                postProfileAction(
                  "submit_kyc",
                  {
                    ...profile,
                    kyc_document_number:
                      profile.kyc_document_number || "CNI-2026-884920",
                    instantVerify: false,
                  },
                  "Dossier KYC soumis en statut 'pending' (en attente de validation Admin)."
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <span>Soumettre pour revue Admin (statut Pending)</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PERSONAL INFORMATION                                           */}
      {/* ===================================================================== */}
      {tab === "personal" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            postProfileAction(
              "update_personal",
              {
                full_name: profile.full_name,
                phone: profile.phone,
                country_code: profile.country_code,
                date_of_birth: profile.date_of_birth,
                nationality: profile.nationality,
                address_line: profile.address_line,
                city: profile.city,
                occupation: profile.occupation,
                source_of_funds: profile.source_of_funds,
              },
              "Informations personnelles enregistrées."
            );
          }}
          className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 max-w-2xl"
        >
          <h2 className="text-base font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
            Coordonnées & Pays d&apos;origine
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Nom complet</label>
              <input
                type="text"
                required
                value={profile.full_name}
                onChange={(e) =>
                  setProfile({ ...profile, full_name: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Téléphone principal (MSISDN)
              </label>
              <input
                type="text"
                required
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Pays d&apos;origine par défaut
              </label>
              <select
                value={profile.country_code}
                onChange={(e) =>
                  setProfile({ ...profile, country_code: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                {ORIGIN_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Ville</label>
              <input
                type="text"
                value={profile.city || ""}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#0B3D91] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0B3D91]/90"
          >
            Enregistrer mes coordonnées
          </button>
        </form>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: SAVED VIRTUAL CARDS (VISA / MASTERCARD) & PAYMENT DEFAULTS     */}
      {/* ===================================================================== */}
      {tab === "cards" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
                  Mes Cartes Virtuelles Enregistrées (Visa / Mastercard)
                </h2>
                <p className="text-xs text-slate-500">
                  Idéal pour les pays d&apos;origine sans Mobile Money direct (Afrique du Sud, Gabon, Maroc, Europe, Amérique du Nord) ou les cartes virtuelles d&apos;agrégateurs (Vodacom Virtual Card, Wave Visa, Orange, Djamo).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewCard({
                    ...newCard,
                    cardholder_name: profile.full_name,
                    origin_country: profile.country_code || "ZA",
                  });
                  setShowAddCard(!showAddCard);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
              >
                <Plus className="h-4 w-4 text-[#F5B700]" />
                <span>Ajouter une Carte Virtuelle</span>
              </button>
            </div>

            {showAddCard && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await postProfileAction(
                    "add_virtual_card",
                    newCard,
                    "Carte virtuelle enregistrée dans votre profil."
                  );
                  if (ok) setShowAddCard(false);
                }}
                className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-slate-700 dark:bg-slate-800 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      Émetteur Carte Virtuelle
                    </label>
                    <select
                      value={newCard.provider}
                      onChange={(e) =>
                        setNewCard({ ...newCard, provider: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                    >
                      {VIRTUAL_CARD_PROVIDERS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      Réseau (Visa / Mastercard)
                    </label>
                    <select
                      value={newCard.brand}
                      onChange={(e) =>
                        setNewCard({
                          ...newCard,
                          brand: e.target.value as "VISA" | "MASTERCARD",
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="VISA">VISA</option>
                      <option value="MASTERCARD">MASTERCARD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      4 derniers chiffres (masqués PCI-DSS)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      required
                      value={newCard.last4}
                      onChange={(e) =>
                        setNewCard({ ...newCard, last4: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      Pays d&apos;origine de la carte
                    </label>
                    <select
                      value={newCard.origin_country}
                      onChange={(e) =>
                        setNewCard({ ...newCard, origin_country: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                    >
                      {ORIGIN_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      Expiration (MM/AA)
                    </label>
                    <input
                      type="text"
                      value={newCard.expiry}
                      onChange={(e) =>
                        setNewCard({ ...newCard, expiry: e.target.value })
                      }
                      placeholder="12/28"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
                >
                  Enregistrer la carte virtuelle
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(profile.saved_virtual_cards || []).map((card) => (
                <div
                  key={card.id}
                  className="rounded-2xl bg-gradient-to-br from-slate-900 via-[#0B3D91] to-slate-950 p-5 text-white shadow-md flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded-md bg-[#F5B700] px-2 py-0.5 text-[10px] font-extrabold text-slate-950">
                        {card.brand} VIRTUAL
                      </span>
                      <p className="text-sm font-bold mt-1.5">{card.provider}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        postProfileAction(
                          "delete_virtual_card",
                          {},
                          "Carte virtuelle supprimée.",
                          { cardId: card.id }
                        )
                      }
                      className="text-white/60 hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="font-mono text-lg tracking-widest font-bold text-[#F5B700]">
                    •••• •••• •••• {card.last4}
                  </p>

                  <div className="flex items-center justify-between text-xs text-blue-100">
                    <span>{card.cardholder_name}</span>
                    <span>
                      Origine: <strong>{card.origin_country}</strong> • Exp:{" "}
                      {card.expiry}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: PREFERENCES & NOTIFICATIONS                                    */}
      {/* ===================================================================== */}
      {tab === "preferences" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 space-y-5 max-w-2xl">
          <h2 className="text-base font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
            Préférences d&apos;affichage & Alertes de Transfert
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Langue de l&apos;interface (FR / EN)
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as "fr" | "en")}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="fr">Français (FR)</option>
                <option value="en">English (EN)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Thème Visuel
              </label>
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-bold text-left dark:border-slate-700 dark:bg-slate-800"
              >
                Mode actuel : {theme === "dark" ? "Sombre (Dark)" : "Clair (Light)"} — Cliquer pour basculer
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 text-xs font-semibold dark:border-slate-800">
              <span>Notifications par Email (reçus de paiement et décaissement)</span>
              <input
                type="checkbox"
                checked={profile.notify_email !== false}
                onChange={(e) =>
                  setProfile({ ...profile, notify_email: e.target.checked })
                }
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 text-xs font-semibold dark:border-slate-800">
              <span>Alertes SMS sur mon numéro (+ statut OTP / bénéficiaire)</span>
              <input
                type="checkbox"
                checked={profile.notify_sms !== false}
                onChange={(e) =>
                  setProfile({ ...profile, notify_sms: e.target.checked })
                }
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 text-xs font-semibold dark:border-slate-800">
              <span>Notifications Push PWA (Application Mobile)</span>
              <input
                type="checkbox"
                checked={profile.notify_push_pwa !== false}
                onChange={(e) =>
                  setProfile({ ...profile, notify_push_pwa: e.target.checked })
                }
                className="h-4 w-4"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              postProfileAction(
                "update_preferences",
                {
                  preferred_locale: locale,
                  notify_email: profile.notify_email,
                  notify_sms: profile.notify_sms,
                  notify_push_pwa: profile.notify_push_pwa,
                },
                "Préférences et notifications enregistrées."
              )
            }
            className="rounded-xl bg-[#0B3D91] px-5 py-2.5 text-xs font-bold text-white"
          >
            Enregistrer mes préférences
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: SECURITY & ACCESS                                              */}
      {/* ===================================================================== */}
      {tab === "security" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 space-y-5 max-w-2xl">
          <h2 className="text-base font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
            Sécurité du Compte & Protection des Transferts
          </h2>

          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-800">
              <div>
                <p className="font-bold text-sm">
                  Double Authentification (2FA) à la connexion
                </p>
                <p className="text-slate-500">
                  Exige un code de vérification supplémentaire lors d&apos;une connexion sur un nouvel appareil.
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(profile.two_factor_enabled)}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    two_factor_enabled: e.target.checked,
                  })
                }
                className="h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-800">
              <div>
                <p className="font-bold text-sm">
                  Code PIN de confirmation avant chaque transfert
                </p>
                <p className="text-slate-500">
                  Protège l&apos;utilisation de vos cartes virtuelles et de votre compte sur mobile.
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(profile.transaction_pin_enabled)}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    transaction_pin_enabled: e.target.checked,
                  })
                }
                className="h-4 w-4"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              postProfileAction(
                "update_security",
                {
                  two_factor_enabled: profile.two_factor_enabled,
                  transaction_pin_enabled: profile.transaction_pin_enabled,
                },
                "Paramètres de sécurité mis à jour."
              )
            }
            className="rounded-xl bg-[#0B3D91] px-5 py-2.5 text-xs font-bold text-white"
          >
            Sauvegarder la sécurité
          </button>
        </div>
      )}
    </div>
  );
}


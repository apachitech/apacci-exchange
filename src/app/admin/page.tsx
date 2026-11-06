"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  AlertCircle,
  Settings,
  Users,
  Wallet,
  FileText,
  Globe2,
  UserCheck,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  ArrowRightLeft,
  Search,
  Activity,
  Lock,
  Unlock,
  Eye,
  X,
  Maximize2,
  AlertTriangle,
} from "lucide-react";
import type { TransactionStatus } from "@/lib/state-machine";
import { CountryDropdownSelector } from "@/components/admin/CountryDropdownSelector";
import { getCountryByCode } from "@/lib/country-catalog";

interface AdminTx {
  id: string;
  reference: string;
  user_id: string;
  recipient_id: string;
  recipient_name: string;
  recipient_msisdn: string;
  sender_country?: string;
  sender_currency?: string;
  destination_country: string;
  destination_currency: string;
  destination_network: string;
  destination_network_name: string;
  send_amount: string;
  fee_amount: string;
  total_charged: string;
  exchange_rate: string;
  payout_amount: string;
  status: TransactionStatus;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string;
}

interface AdminUser {
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
  kyc_document_type?: string;
  kyc_document_number?: string;
  kyc_issuing_country?: string;
  kyc_document_expiry?: string;
  kyc_id_recto_url?: string | null;
  kyc_id_verso_url?: string | null;
  kyc_selfie_url?: string | null;
  kyc_selfie_verified?: boolean;
  kyc_submitted_at?: string | null;
  kyc_rejection_reason?: string | null;
  custom_tx_limit_xof: string | null;
  custom_monthly_limit_xof: string | null;
  created_at?: string;
}

interface AdminRecipient {
  id: string;
  user_id: string;
  full_name: string;
  country_code: string;
  currency: string;
  network_code: string;
  network_name: string;
  msisdn: string;
  is_active: boolean;
}

interface SasPayBalanceItem {
  id: string;
  country: string;
  currency: string;
  available_amount: string;
  pending_amount: string;
  is_frozen: boolean;
}

interface WalletTransferItem {
  id: string;
  from_country: string;
  from_currency: string;
  to_country: string;
  to_currency: string;
  from_amount: string;
  exchange_rate: string;
  to_amount: string;
  status: string;
  idempotency_key: string;
  created_at: string;
}

interface CmsContentItem {
  id: string;
  slug: string;
  category: "announcement" | "faq" | "corridor_notice" | "legal";
  title_fr: string;
  title_en: string;
  body_fr: string;
  body_en: string;
  is_published: boolean;
  priority: number;
  updated_at: string;
}

interface CorridorOverrideItem {
  id: string;
  iso_code: string;
  country_name: string;
  currency: string;
  custom_rate_from_xof: string;
  fee_spread_percent: string;
  is_enabled: boolean;
  payout_rail_note: string;
  updated_at: string;
}

interface PlatformSettings {
  fee_charge_mode: "ADD_ON" | "DEDUCTED";
  platform_fee_percent: string;
  platform_fee_fixed_xof: string;
  unverified_tx_limit_xof: string;
  unverified_monthly_limit_xof: string;
  verified_tx_limit_xof: string;
  verified_monthly_limit_xof: string;
}

type AdminTab =
  | "transactions"
  | "failed"
  | "users"
  | "recipients"
  | "wallets"
  | "cms"
  | "corridors"
  | "settings"
  | "audit";

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<AdminTab>("transactions");
  const [mode, setMode] = useState<"sandbox" | "supabase">("sandbox");

  const [transactions, setTransactions] = useState<AdminTx[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [recipients, setRecipients] = useState<AdminRecipient[]>([]);
  const [balances, setBalances] = useState<SasPayBalanceItem[]>([]);
  const [walletTransfers, setWalletTransfers] = useState<WalletTransferItem[]>([]);
  const [cmsContents, setCmsContents] = useState<CmsContentItem[]>([]);
  const [corridorOverrides, setCorridorOverrides] = useState<CorridorOverrideItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<
    Array<{
      id: string;
      transaction_id: string;
      from_status: string | null;
      to_status: string;
      actor_type: string;
      reason: string;
      created_at: string;
    }>
  >([]);
  const [webhookLogs, setWebhookLogs] = useState<
    Array<{
      id: string;
      provider_event_id: string;
      event_type: string;
      signature_valid: boolean;
      processed: boolean;
      processing_error: string | null;
      created_at: string;
    }>
  >([]);

  const [settings, setSettings] = useState<PlatformSettings>({
    fee_charge_mode: "ADD_ON",
    platform_fee_percent: "1.000",
    platform_fee_fixed_xof: "0.00",
    unverified_tx_limit_xof: "100000.00",
    unverified_monthly_limit_xof: "500000.00",
    verified_tx_limit_xof: "2000000.00",
    verified_monthly_limit_xof: "10000000.00",
  });

  // Search & filters
  const [txSearch, setTxSearch] = useState("");
  const [txStatusFilter, setTxStatusFilter] = useState("ALL");
  const [userSearch, setUserSearch] = useState("");

  // Forms for CRUD
  // 1. Transaction Create / Edit
  const [showTxForm, setShowTxForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txForm, setTxForm] = useState({
    recipient_name: "",
    recipient_msisdn: "+22370000000",
    destination_country: "ML",
    destination_currency: "XOF",
    destination_network: "orange_ml",
    destination_network_name: "Orange Money Mali",
    send_amount: "25000.00",
    fee_amount: "625.00",
    exchange_rate: "1.00000000",
    status: "created" as TransactionStatus,
    failure_code: "",
    failure_reason: "",
  });

  // 2. User Create / Edit & KYC Dossier Preview Modal
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [previewKycUserId, setPreviewKycUserId] = useState<string | null>(null);
  const [zoomedKycPhoto, setZoomedKycPhoto] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState(
    "Document illisible ou non conforme aux exigences AML/CFT."
  );
  const [userForm, setUserForm] = useState({
    full_name: "",
    email: "",
    phone: "+2250700000000",
    country_code: "CI",
    role: "client" as "client" | "admin",
    kyc_status: "unverified" as AdminUser["kyc_status"],
    custom_tx_limit_xof: "",
    custom_monthly_limit_xof: "",
  });

  // 3. Recipient Create / Edit
  const [showRecipientForm, setShowRecipientForm] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [recipientForm, setRecipientForm] = useState({
    full_name: "",
    country_code: "ML",
    currency: "XOF",
    network_code: "orange_ml",
    network_name: "Orange Money Mali",
    msisdn: "+22370000000",
    is_active: true,
  });

  // 4. Wallet CRUD & Inter-wallet transfer
  const [walletSource, setWalletSource] = useState("CI");
  const [walletDest, setWalletDest] = useState("ML");
  const [walletAmount, setWalletAmount] = useState("100000.00");
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [walletForm, setWalletForm] = useState({
    country: "BF",
    currency: "XOF",
    available_amount: "500000.00",
    pending_amount: "0.00",
    is_frozen: false,
  });

  // 5. CMS Content Create / Edit
  const [showCmsForm, setShowCmsForm] = useState(false);
  const [editingCmsId, setEditingCmsId] = useState<string | null>(null);
  const [cmsForm, setCmsForm] = useState({
    slug: "",
    category: "announcement" as CmsContentItem["category"],
    title_fr: "",
    title_en: "",
    body_fr: "",
    body_en: "",
    is_published: true,
    priority: 10,
  });

  // 6. Corridor Override Create / Edit
  const [showCorridorForm, setShowCorridorForm] = useState(false);
  const [corridorForm, setCorridorForm] = useState({
    iso_code: "ZA",
    country_name: "Afrique du Sud",
    currency: "ZAR",
    custom_rate_from_xof: "0.03000000",
    fee_spread_percent: "1.500",
    is_enabled: true,
    payout_rail_note: "Vodacom Virtual Card Payin / Bidvest Bank Card Payout",
  });

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState<{
    status: number;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function loadAdminData() {
    setLoading(true);
    setError(null);
    setAccessDenied(null);
    try {
      const res = await fetch("/api/admin", { cache: "no-store" });
      const json = await res.json();
      if (res.status === 401 || res.status === 403) {
        setAccessDenied({
          status: res.status,
          message:
            json.error?.message ||
            "Accès refusé. Le tableau de bord est strictement réservé aux administrateurs Apacci Exchange.",
        });
        return;
      }
      if (!res.ok || !json.success) {
        setError(
          json.error?.message ||
            "Accès refusé. Connectez-vous avec un compte ayant profiles.role = 'admin'."
        );
        return;
      }
      if (json.mode) setMode(json.mode);
      setTransactions(json.data.transactions || []);
      setUsers(json.data.users || []);
      setRecipients(json.data.recipients || []);
      setBalances(json.data.balances || []);
      setWalletTransfers(json.data.walletTransfers || []);
      setCmsContents(json.data.cmsContents || []);
      setCorridorOverrides(json.data.corridorOverrides || []);
      setAuditEvents(json.data.events || []);
      setWebhookLogs(json.data.webhooks || []);
      if (json.data.settings) {
        setSettings({
          fee_charge_mode: json.data.settings.fee_charge_mode,
          platform_fee_percent: String(json.data.settings.platform_fee_percent),
          platform_fee_fixed_xof: String(json.data.settings.platform_fee_fixed_xof),
          unverified_tx_limit_xof: String(json.data.settings.unverified_tx_limit_xof),
          unverified_monthly_limit_xof: String(
            json.data.settings.unverified_monthly_limit_xof
          ),
          verified_tx_limit_xof: String(json.data.settings.verified_tx_limit_xof),
          verified_monthly_limit_xof: String(
            json.data.settings.verified_monthly_limit_xof
          ),
        });
      }
    } catch {
      setError("Impossible de charger le tableau de bord administrateur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
    const onAuthChange = () => loadAdminData();
    window.addEventListener("apacci-profile-updated", onAuthChange);
    return () => window.removeEventListener("apacci-profile-updated", onAuthChange);
  }, []);

  async function postAdminAction(
    body: Record<string, unknown>,
    successText: string
  ): Promise<boolean> {
    setActionMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Erreur lors de l'opération.");
        return false;
      }
      setActionMsg(successText);
      await loadAdminData();
      return true;
    } catch {
      setError("Erreur réseau lors de la communication avec /api/admin.");
      return false;
    }
  }

  // --- Transaction Handlers ---
  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTxId) {
      const ok = await postAdminAction(
        {
          action: "update_transaction",
          transactionId: editingTxId,
          payload: txForm,
        },
        "Transaction mise à jour avec succès."
      );
      if (ok) {
        setShowTxForm(false);
        setEditingTxId(null);
      }
    } else {
      const ok = await postAdminAction(
        {
          action: "create_transaction",
          payload: txForm,
        },
        "Nouvelle transaction créée et enregistrée dans le journal d'audit."
      );
      if (ok) setShowTxForm(false);
    }
  };

  const handleDeleteTx = async (txId: string, ref: string) => {
    await postAdminAction(
      { action: "delete_transaction", transactionId: txId },
      `Transaction ${ref} supprimée.`
    );
  };

  const handleRetryPayout = async (transactionId: string) => {
    await postAdminAction(
      { action: "retry_payout", transactionId },
      "Relance du payout SasPay exécutée avec une nouvelle Idempotency-Key."
    );
  };

  const handleSetStatus = async (
    transactionId: string,
    toStatus: TransactionStatus
  ) => {
    await postAdminAction(
      {
        action: "set_status",
        transactionId,
        toStatus,
        reason: `Admin action: marked as ${toStatus}`,
      },
      `Statut de la transaction mis à jour vers ${toStatus}.`
    );
  };

  const handleTriggerReconciliation = async () => {
    await postAdminAction(
      { action: "trigger_reconciliation" },
      "Réconciliation des transferts en attente terminée."
    );
  };

  // --- User Handlers ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUserId) {
      const ok = await postAdminAction(
        {
          action: "update_user",
          userId: editingUserId,
          payload: {
            ...userForm,
            custom_tx_limit_xof: userForm.custom_tx_limit_xof || null,
            custom_monthly_limit_xof: userForm.custom_monthly_limit_xof || null,
          },
        },
        "Profil utilisateur et plafonds KYC mis à jour."
      );
      if (ok) {
        setShowUserForm(false);
        setEditingUserId(null);
      }
    } else {
      const ok = await postAdminAction(
        {
          action: "create_user",
          payload: {
            ...userForm,
            custom_tx_limit_xof: userForm.custom_tx_limit_xof || null,
            custom_monthly_limit_xof: userForm.custom_monthly_limit_xof || null,
          },
        },
        "Nouvel utilisateur créé avec succès."
      );
      if (ok) setShowUserForm(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    await postAdminAction(
      { action: "delete_user", userId },
      `Utilisateur ${email} supprimé.`
    );
  };

  // --- Recipient Handlers ---
  const handleSaveRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecipientId) {
      const ok = await postAdminAction(
        {
          action: "update_recipient",
          recipientId: editingRecipientId,
          payload: recipientForm,
        },
        "Bénéficiaire mis à jour."
      );
      if (ok) {
        setShowRecipientForm(false);
        setEditingRecipientId(null);
      }
    } else {
      const ok = await postAdminAction(
        {
          action: "create_recipient",
          payload: recipientForm,
        },
        "Bénéficiaire ajouté au répertoire."
      );
      if (ok) setShowRecipientForm(false);
    }
  };

  // --- Wallet Handlers ---
  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWalletId) {
      const ok = await postAdminAction(
        {
          action: "update_wallet",
          walletId: editingWalletId,
          payload: walletForm,
        },
        `Portefeuille ${walletForm.country} mis à jour.`
      );
      if (ok) {
        setShowWalletForm(false);
        setEditingWalletId(null);
      }
    } else {
      const ok = await postAdminAction(
        {
          action: "create_wallet",
          payload: walletForm,
        },
        `Portefeuille pays ${walletForm.country} (${walletForm.currency}) enregistré.`
      );
      if (ok) setShowWalletForm(false);
    }
  };

  const handleWalletTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `wt-${Date.now()}`;
    await postAdminAction(
      {
        action: "inter_wallet_transfer",
        sourceCountry: walletSource,
        destinationCountry: walletDest,
        amount: walletAmount,
        idempotencyKey,
      },
      `Transfert inter-wallet SasPay exécuté (${walletSource} → ${walletDest} : ${walletAmount}).`
    );
  };

  // --- CMS Content Handlers ---
  const handleSaveCms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCmsId) {
      const ok = await postAdminAction(
        {
          action: "update_content",
          contentId: editingCmsId,
          payload: cmsForm,
        },
        "Contenu CMS mis à jour."
      );
      if (ok) {
        setShowCmsForm(false);
        setEditingCmsId(null);
      }
    } else {
      const ok = await postAdminAction(
        {
          action: "create_content",
          payload: cmsForm,
        },
        "Nouveau contenu CMS publié."
      );
      if (ok) setShowCmsForm(false);
    }
  };

  // --- Corridor Handlers ---
  const handleSaveCorridor = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await postAdminAction(
      {
        action: "upsert_corridor",
        payload: corridorForm,
      },
      `Corridor ${corridorForm.iso_code} (${corridorForm.country_name}) enregistré.`
    );
    if (ok) setShowCorridorForm(false);
  };

  // --- Settings Handler ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await postAdminAction(
      {
        action: "update_settings",
        settings: {
          feeChargeMode: settings.fee_charge_mode,
          platformFeePercent: settings.platform_fee_percent,
          platformFeeFixedXof: settings.platform_fee_fixed_xof,
          unverifiedTxLimitXof: settings.unverified_tx_limit_xof,
          unverifiedMonthlyLimitXof: settings.unverified_monthly_limit_xof,
          verifiedTxLimitXof: settings.verified_tx_limit_xof,
          verifiedMonthlyLimitXof: settings.verified_monthly_limit_xof,
        },
      },
      "Paramètres globaux et plafonds KYC enregistrés."
    );
  };

  // Filtered lists
  const failedPayouts = transactions.filter((t) => t.status === "payout_failed");
  const filteredTransactions = transactions.filter((t) => {
    if (txStatusFilter !== "ALL" && t.status !== txStatusFilter) return false;
    if (!txSearch.trim()) return true;
    const q = txSearch.toLowerCase();
    return (
      t.reference.toLowerCase().includes(q) ||
      t.recipient_name.toLowerCase().includes(q) ||
      t.recipient_msisdn.toLowerCase().includes(q) ||
      t.destination_country.toLowerCase().includes(q)
    );
  });

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q)
    );
  });

  const totalVolumeXof = transactions.reduce(
    (acc, t) => acc + (Number.parseFloat(t.send_amount) || 0),
    0
  );

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <div className="rounded-3xl border-2 border-rose-300 bg-white p-8 shadow-xl dark:border-rose-800 dark:bg-slate-900 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-rose-800 dark:bg-rose-950 dark:text-rose-300">
              HTTP {accessDenied.status} — Accès Restreint (RBAC Admin)
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              Accès Réservé à l&apos;Administrateur
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {accessDenied.message}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 space-y-1">
            <p className="font-bold text-slate-800 dark:text-slate-100">
              Comment accéder au Back-Office Administrateur ?
            </p>
            <p>
              Connectez-vous sur la page d&apos;authentification avec le compte Super Administrateur (<strong>admin@apacci-exchange.com</strong> / <strong>Admin@2026!</strong>).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/login?next=/admin"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B3D91] px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-[#0B3D91]/90"
            >
              <ShieldCheck className="h-4 w-4 text-[#F5B700]" />
              Se connecter en tant qu&apos;Admin
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B3D91] text-[#F5B700] shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#0B3D91] dark:text-white">
                Administration Apacci Exchange
              </h1>
              <span className="rounded-full bg-[#F5B700]/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-[#0B3D91] dark:text-[#F5B700]">
                {mode === "sandbox" ? "Mode Sandbox Actif" : "Production Supabase"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Gestion complète CRUD : Transactions, Utilisateurs & KYC, Bénéficiaires, Wallets SasPay, Contenus CMS & Corridors
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerReconciliation}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0B3D91]/90"
          >
            <Activity className="h-3.5 w-3.5 text-[#F5B700]" />
            <span>Réconcilier les transferts</span>
          </button>

          <button
            type="button"
            onClick={loadAdminData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase text-slate-400">
            Volume Total Envoyé
          </p>
          <p className="text-xl font-extrabold text-[#0B3D91] dark:text-[#F5B700] mt-1">
            {totalVolumeXof.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} XOF
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {transactions.length} transactions enregistrées
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase text-slate-400">
            Utilisateurs & KYC
          </p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            {users.length} comptes
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            {users.filter((u) => u.kyc_status === "verified").length} vérifiés KYC •{" "}
            {recipients.length} bénéficiaires
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase text-slate-400">
            Wallets Pays SasPay
          </p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            {balances.length} portefeuilles
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {corridorOverrides.filter((c) => c.is_enabled).length} corridors actifs
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase text-slate-400">
            Contenus CMS & Alertes
          </p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            {cmsContents.filter((c) => c.is_published).length} publiés
          </p>
          <p className="text-[11px] text-rose-600 font-semibold mt-0.5">
            {failedPayouts.length} payout(s) en échec à traiter
          </p>
        </div>
      </div>

      {/* Feedback Banners */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[11px] font-bold underline"
          >
            Fermer
          </button>
        </div>
      )}

      {actionMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="text-[11px] font-bold underline"
          >
            OK
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setTab("transactions")}
          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            tab === "transactions"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          Transactions ({transactions.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("failed")}
          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            tab === "failed"
              ? "bg-rose-600 text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          Payouts Échoués ({failedPayouts.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("users")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            tab === "users"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Utilisateurs & KYC ({users.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("recipients")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            tab === "recipients"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Bénéficiaires ({recipients.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("wallets")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            tab === "wallets"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <Wallet className="h-3.5 w-3.5" />
          Wallets & Liquidité ({balances.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("cms")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            tab === "cms"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Contenus CMS ({cmsContents.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("corridors")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            tab === "corridors"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <Globe2 className="h-3.5 w-3.5" />
          Corridors & Taux ({corridorOverrides.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("settings")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            tab === "settings"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          Frais & Plafonds
        </button>

        <button
          type="button"
          onClick={() => setTab("audit")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            tab === "audit"
              ? "bg-[#0B3D91] text-white"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          Audit & Webhooks ({auditEvents.length + webhookLogs.length})
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1 & 2: TRANSACTIONS & FAILED PAYOUTS (Full CRUD + State Machine) */}
      {/* ===================================================================== */}
      {(tab === "transactions" || tab === "failed") && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Rechercher réf, bénéficiaire, téléphone, pays..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              {tab === "transactions" && (
                <select
                  value={txStatusFilter}
                  onChange={(e) => setTxStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="completed">completed</option>
                  <option value="payment_pending">payment_pending</option>
                  <option value="paid">paid</option>
                  <option value="payout_pending">payout_pending</option>
                  <option value="payout_failed">payout_failed</option>
                  <option value="payment_failed">payment_failed</option>
                  <option value="refunded">refunded</option>
                  <option value="manual_review">manual_review</option>
                </select>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingTxId(null);
                setTxForm({
                  recipient_name: "",
                  recipient_msisdn: "+22370000000",
                  destination_country: "ML",
                  destination_currency: "XOF",
                  destination_network: "orange_ml",
                  destination_network_name: "Orange Money Mali",
                  send_amount: "25000.00",
                  fee_amount: "625.00",
                  exchange_rate: "1.00000000",
                  status: "created",
                  failure_code: "",
                  failure_reason: "",
                });
                setShowTxForm(!showTxForm);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4 text-[#F5B700]" />
              <span>Nouvelle Transaction</span>
            </button>
          </div>

          {showTxForm && (
            <form
              onSubmit={handleSaveTx}
              className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 dark:border-slate-700 dark:bg-slate-900 space-y-4"
            >
              <h3 className="text-sm font-bold text-[#0B3D91] dark:text-[#F5B700]">
                {editingTxId ? "Modifier la transaction" : "Créer une transaction manuelle"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1">Nom Bénéficiaire</label>
                  <input
                    type="text"
                    required
                    value={txForm.recipient_name}
                    onChange={(e) =>
                      setTxForm({ ...txForm, recipient_name: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Téléphone (MSISDN)</label>
                  <input
                    type="text"
                    required
                    value={txForm.recipient_msisdn}
                    onChange={(e) =>
                      setTxForm({ ...txForm, recipient_msisdn: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Pays & Devise</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={2}
                      value={txForm.destination_country}
                      onChange={(e) =>
                        setTxForm({
                          ...txForm,
                          destination_country: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="ML"
                      className="w-16 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      maxLength={3}
                      value={txForm.destination_currency}
                      onChange={(e) =>
                        setTxForm({
                          ...txForm,
                          destination_currency: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="XOF"
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Code Réseau SasPay</label>
                  <input
                    type="text"
                    value={txForm.destination_network}
                    onChange={(e) =>
                      setTxForm({
                        ...txForm,
                        destination_network: e.target.value,
                        destination_network_name: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Montant envoyé (XOF)</label>
                  <input
                    type="text"
                    value={txForm.send_amount}
                    onChange={(e) =>
                      setTxForm({ ...txForm, send_amount: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Statut</label>
                  <select
                    value={txForm.status}
                    onChange={(e) =>
                      setTxForm({
                        ...txForm,
                        status: e.target.value as TransactionStatus,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="created">created</option>
                    <option value="payment_pending">payment_pending</option>
                    <option value="paid">paid</option>
                    <option value="payout_pending">payout_pending</option>
                    <option value="completed">completed</option>
                    <option value="payment_failed">payment_failed</option>
                    <option value="payout_failed">payout_failed</option>
                    <option value="refunded">refunded</option>
                    <option value="manual_review">manual_review</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
                >
                  {editingTxId ? "Enregistrer les modifications" : "Créer la transaction"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTxForm(false);
                    setEditingTxId(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {(tab === "failed" ? failedPayouts : filteredTransactions).map((tx) => (
              <div
                key={tx.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#0B3D91] dark:text-[#F5B700]">
                      {tx.reference}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        tx.status === "completed"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : tx.status.includes("failed")
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {tx.status}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-bold">
                    {tx.recipient_name} —{" "}
                    <span className="font-mono text-xs">{tx.recipient_msisdn}</span> (
                    {tx.destination_country} • {tx.destination_network_name})
                  </p>
                  <p className="text-xs text-slate-500">
                    Origine: <strong>{tx.sender_country || "CI"} ({tx.sender_currency || "XOF"})</strong> • Envoyé: <strong>{tx.send_amount} {tx.sender_currency || "XOF"}</strong> (Total débité:{" "}
                    {tx.total_charged} {tx.sender_currency || "XOF"}) → Reçu ({tx.destination_country}):{" "}
                    <strong className="text-[#0B3D91] dark:text-[#F5B700]">
                      {tx.payout_amount} {tx.destination_currency}
                    </strong>
                  </p>
                  {tx.failure_reason && (
                    <p className="text-xs text-rose-600 font-semibold">
                      Erreur: {tx.failure_code} — {tx.failure_reason}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(tx.status === "payout_failed" || tx.status === "paid") && (
                    <button
                      type="button"
                      onClick={() => handleRetryPayout(tx.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0B3D91]/90"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-[#F5B700]" />
                      <span>Relancer Payout</span>
                    </button>
                  )}

                  {tx.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => handleSetStatus(tx.id, "completed")}
                      className="rounded-xl border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                    >
                      Valider (completed)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSetStatus(tx.id, "manual_review")}
                    className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700"
                  >
                    Revue manuelle
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetStatus(tx.id, "refunded")}
                    className="rounded-xl border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
                  >
                    Rembourser
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingTxId(tx.id);
                      setTxForm({
                        recipient_name: tx.recipient_name,
                        recipient_msisdn: tx.recipient_msisdn,
                        destination_country: tx.destination_country,
                        destination_currency: tx.destination_currency,
                        destination_network: tx.destination_network,
                        destination_network_name: tx.destination_network_name,
                        send_amount: tx.send_amount,
                        fee_amount: tx.fee_amount || "0.00",
                        exchange_rate: tx.exchange_rate || "1.00000000",
                        status: tx.status,
                        failure_code: tx.failure_code || "",
                        failure_reason: tx.failure_reason || "",
                      });
                      setShowTxForm(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                    title="Modifier"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteTx(tx.id, tx.reference)}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-900"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: USERS & KYC MANAGEMENT (Full CRUD)                             */}
      {/* ===================================================================== */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher un utilisateur (nom, email, téléphone)..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingUserId(null);
                setUserForm({
                  full_name: "",
                  email: "",
                  phone: "+2250700000000",
                  country_code: "CI",
                  role: "client",
                  kyc_status: "unverified",
                  custom_tx_limit_xof: "",
                  custom_monthly_limit_xof: "",
                });
                setShowUserForm(!showUserForm);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4 text-[#F5B700]" />
              <span>Ajouter un utilisateur</span>
            </button>
          </div>

          {showUserForm && (
            <form
              onSubmit={handleSaveUser}
              className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 dark:border-slate-700 dark:bg-slate-900 space-y-4"
            >
              <h3 className="text-sm font-bold text-[#0B3D91] dark:text-[#F5B700]">
                {editingUserId
                  ? "Modifier l'utilisateur & ses plafonds KYC"
                  : "Créer un nouveau compte utilisateur"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={userForm.full_name}
                    onChange={(e) =>
                      setUserForm({ ...userForm, full_name: e.target.value })
                    }
                    placeholder="Ex: Koffi Kouadio"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) =>
                      setUserForm({ ...userForm, email: e.target.value })
                    }
                    placeholder="koffi@example.ci"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) =>
                      setUserForm({ ...userForm, phone: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Rôle</label>
                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        role: e.target.value as "client" | "admin",
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="client">client</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Statut KYC</label>
                  <select
                    value={userForm.kyc_status}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        kyc_status: e.target.value as AdminUser["kyc_status"],
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="unverified">unverified</option>
                    <option value="pending">pending</option>
                    <option value="verified">verified</option>
                    <option value="rejected">rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">
                    Plafond perso / tx (XOF, optionnel)
                  </label>
                  <input
                    type="text"
                    value={userForm.custom_tx_limit_xof}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        custom_tx_limit_xof: e.target.value,
                      })
                    }
                    placeholder="Par défaut selon KYC"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
                >
                  {editingUserId ? "Mettre à jour" : "Créer l'utilisateur"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserForm(false);
                    setEditingUserId(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{u.full_name || "Utilisateur"}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        u.role === "admin"
                          ? "bg-[#0B3D91] text-[#F5B700]"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {u.role}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        u.kyc_status === "verified"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : u.kyc_status === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                      }`}
                    >
                      KYC: {u.kyc_status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {u.email} • {u.phone || "Sans téléphone"} • Pays: {u.country_code || "CI"}
                    {u.kyc_document_number ? ` • Pièce (${u.kyc_document_type || "ID"}): ${u.kyc_document_number}` : ""}
                  </p>
                  {u.custom_tx_limit_xof && (
                    <p className="text-[11px] font-mono text-[#0B3D91] dark:text-[#F5B700]">
                      Plafond personnalisé: {u.custom_tx_limit_xof} XOF / tx
                    </p>
                  )}
                  {(u.kyc_id_recto_url || u.kyc_id_verso_url || u.kyc_selfie_url) ? (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {u.kyc_id_recto_url && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewKycUserId(u.id);
                            setRejectionReasonInput(
                              u.kyc_rejection_reason ||
                                "Document illisible ou non conforme aux exigences AML/CFT."
                            );
                          }}
                          className="group relative rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800 hover:border-[#0B3D91] transition cursor-pointer text-left"
                          title="Cliquer pour agrandir et inspecter le Recto"
                        >
                          <span className="block text-[9px] font-bold text-slate-500 mb-0.5">
                            1. ID RECTO 🔍
                          </span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={u.kyc_id_recto_url}
                            alt="ID Recto"
                            className="h-12 w-20 rounded object-cover"
                          />
                        </button>
                      )}
                      {u.kyc_id_verso_url && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewKycUserId(u.id);
                            setRejectionReasonInput(
                              u.kyc_rejection_reason ||
                                "Document illisible ou non conforme aux exigences AML/CFT."
                            );
                          }}
                          className="group relative rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800 hover:border-[#0B3D91] transition cursor-pointer text-left"
                          title="Cliquer pour agrandir et inspecter le Verso"
                        >
                          <span className="block text-[9px] font-bold text-slate-500 mb-0.5">
                            2. ID VERSO 🔍
                          </span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={u.kyc_id_verso_url}
                            alt="ID Verso"
                            className="h-12 w-20 rounded object-cover"
                          />
                        </button>
                      )}
                      {u.kyc_selfie_url && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewKycUserId(u.id);
                            setRejectionReasonInput(
                              u.kyc_rejection_reason ||
                                "Document illisible ou non conforme aux exigences AML/CFT."
                            );
                          }}
                          className="group relative rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800 hover:border-[#0B3D91] transition cursor-pointer text-left"
                          title="Cliquer pour agrandir et inspecter le Selfie"
                        >
                          <span className="block text-[9px] font-bold text-slate-500 mb-0.5">
                            3. SELFIE 🔍
                          </span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={u.kyc_selfie_url}
                            alt="Selfie"
                            className="h-12 w-20 rounded object-cover"
                          />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-600 font-semibold pt-1">
                      ⚠ Photos KYC (Recto / Verso / Selfie) non encore soumises
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewKycUserId(u.id);
                      setRejectionReasonInput(
                        u.kyc_rejection_reason ||
                          "Document illisible ou non conforme aux exigences AML/CFT."
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-3 py-1.5 text-xs font-extrabold text-white shadow-xs hover:bg-[#0B3D91]/90 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 text-[#F5B700]" />
                    <span>Inspecter KYC</span>
                  </button>

                  <select
                    value={u.kyc_status}
                    onChange={(e) =>
                      postAdminAction(
                        {
                          action: "update_user",
                          userId: u.id,
                          payload: { kyc_status: e.target.value },
                        },
                        `Statut KYC de ${u.full_name} mis à jour.`
                      )
                    }
                    className="rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="unverified">unverified (100k XOF)</option>
                    <option value="pending">pending</option>
                    <option value="verified">verified (2M XOF)</option>
                    <option value="rejected">rejected</option>
                  </select>

                  <select
                    value={u.role}
                    onChange={(e) =>
                      postAdminAction(
                        {
                          action: "update_user",
                          userId: u.id,
                          payload: { role: e.target.value },
                        },
                        `Rôle de ${u.full_name} changé en ${e.target.value}.`
                      )
                    }
                    className="rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="client">Rôle: client</option>
                    <option value="admin">Rôle: admin</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingUserId(u.id);
                      setUserForm({
                        full_name: u.full_name,
                        email: u.email,
                        phone: u.phone || "+2250700000000",
                        country_code: u.country_code || "CI",
                        role: u.role,
                        kyc_status: u.kyc_status,
                        custom_tx_limit_xof: u.custom_tx_limit_xof || "",
                        custom_monthly_limit_xof: u.custom_monthly_limit_xof || "",
                      });
                      setShowUserForm(true);
                    }}
                    className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                    title="Modifier"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.id, u.email)}
                    className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-900"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ================================================================= */}
          {/* MODAL D'INSPECTION & PRÉVISUALISATION DU DOSSIER KYC COMPLET      */}
          {/* ================================================================= */}
          {(() => {
            const inspectedUser = users.find((x) => x.id === previewKycUserId);
            if (!inspectedUser) return null;

            const docTypeLabel: Record<string, string> = {
              national_id: "Carte Nationale d'Identité (CNI)",
              passport: "Passeport Biométrique International",
              driver_license: "Permis de Conduire",
              residence_permit: "Carte Consulaire / Titre de Séjour",
            };

            const sourceFundsLabel: Record<string, string> = {
              salary: "Salaire / Revenus professionnels",
              business: "Revenus commerciaux / Entreprise",
              savings: "Épargne personnelle",
              family_support: "Soutien familial",
              investment: "Investissement / Dividendes",
            };

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs overflow-y-auto">
                <div className="my-8 w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-slate-700 dark:bg-slate-900 space-y-6 max-h-[92vh] overflow-y-auto">
                  {/* Modal Header */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#0B3D91] px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-[#F5B700]">
                          Inspection Dossier KYC (AML / CFT)
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${
                            inspectedUser.kyc_status === "verified"
                              ? "bg-emerald-100 text-emerald-800"
                              : inspectedUser.kyc_status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          Statut actuel : {inspectedUser.kyc_status}
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {inspectedUser.full_name} ({inspectedUser.country_code})
                      </h3>
                      <p className="text-xs text-slate-500">
                        ID: <span className="font-mono">{inspectedUser.id}</span> •{" "}
                        {inspectedUser.email} • {inspectedUser.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewKycUserId(null)}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                      aria-label="Fermer l'aperçu KYC"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Section 1: Metadata Grid (Identity, Residence, AML/CFT, Official ID) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-2 text-xs">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#0B3D91] dark:text-[#F5B700]">
                        1. État Civil, Domicile & Origine des Fonds
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="block text-[10px] text-slate-400">
                            Nom et Prénoms
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {inspectedUser.full_name}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">
                            Date de naissance
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {inspectedUser.date_of_birth || "Non renseignée"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">
                            Nationalité / Pays d&apos;origine
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {inspectedUser.nationality || inspectedUser.country_code} /{" "}
                            {inspectedUser.country_code}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">
                            Ville & Adresse
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {inspectedUser.city || "—"}{" "}
                            {inspectedUser.address_line
                              ? `(${inspectedUser.address_line})`
                              : ""}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">
                            Profession / Activité
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {inspectedUser.occupation || "Non renseignée"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">
                            Source des fonds (AML)
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {sourceFundsLabel[inspectedUser.source_of_funds || ""] ||
                              inspectedUser.source_of_funds ||
                              "Salaire"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-2 text-xs">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#0B3D91] dark:text-[#F5B700]">
                        2. Références de la Pièce d&apos;Identité Officielle
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="col-span-2">
                          <span className="block text-[10px] text-slate-400">
                            Type de Document Officiel
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {docTypeLabel[inspectedUser.kyc_document_type || ""] ||
                              inspectedUser.kyc_document_type ||
                              "Carte Nationale d'Identité"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">
                            Numéro de Pièce
                          </span>
                          <span className="font-mono font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
                            {inspectedUser.kyc_document_number || "Non soumis"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">
                            Pays d&apos;émission & Expiration
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {inspectedUser.kyc_issuing_country ||
                              inspectedUser.country_code}{" "}
                            • Exp: {inspectedUser.kyc_document_expiry || "—"}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="block text-[10px] text-slate-400">
                            Date de soumission du dossier KYC
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {inspectedUser.kyc_submitted_at
                              ? new Date(
                                  inspectedUser.kyc_submitted_at
                                ).toLocaleString()
                              : "Dossier non encore soumis"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: High-Resolution Preview of the 3 Mandatory Photos (Recto, Verso, Selfie) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
                        3. Prévisualisation Visuelle des Pièces & Selfie Biométrique (Cliquez sur une photo pour zoomer en plein écran)
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Photo 1: ID RECTO */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                            1. Pièce d&apos;Identité — RECTO
                          </span>
                          {inspectedUser.kyc_id_recto_url && (
                            <button
                              type="button"
                              onClick={() =>
                                setZoomedKycPhoto({
                                  title: `${inspectedUser.full_name} — Pièce d'Identité (RECTO)`,
                                  url: inspectedUser.kyc_id_recto_url!,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-[#0B3D91] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#0B3D91]/90 cursor-pointer"
                            >
                              <Maximize2 className="h-3 w-3" />
                              <span>Plein écran</span>
                            </button>
                          )}
                        </div>
                        {inspectedUser.kyc_id_recto_url ? (
                          <div
                            onClick={() =>
                              setZoomedKycPhoto({
                                title: `${inspectedUser.full_name} — Pièce d'Identité (RECTO)`,
                                url: inspectedUser.kyc_id_recto_url!,
                              })
                            }
                            className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 h-44 cursor-zoom-in"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={inspectedUser.kyc_id_recto_url}
                              alt="Pièce d'Identité Recto"
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-44 items-center justify-center rounded-xl border-2 border-dashed border-rose-300 bg-rose-50/50 text-xs font-bold text-rose-600 dark:border-rose-800 dark:bg-rose-950/30">
                            Photo Recto manquante
                          </div>
                        )}
                      </div>

                      {/* Photo 2: ID VERSO */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                            2. Pièce d&apos;Identité — VERSO
                          </span>
                          {inspectedUser.kyc_id_verso_url && (
                            <button
                              type="button"
                              onClick={() =>
                                setZoomedKycPhoto({
                                  title: `${inspectedUser.full_name} — Pièce d'Identité (VERSO)`,
                                  url: inspectedUser.kyc_id_verso_url!,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-[#0B3D91] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#0B3D91]/90 cursor-pointer"
                            >
                              <Maximize2 className="h-3 w-3" />
                              <span>Plein écran</span>
                            </button>
                          )}
                        </div>
                        {inspectedUser.kyc_id_verso_url ? (
                          <div
                            onClick={() =>
                              setZoomedKycPhoto({
                                title: `${inspectedUser.full_name} — Pièce d'Identité (VERSO)`,
                                url: inspectedUser.kyc_id_verso_url!,
                              })
                            }
                            className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 h-44 cursor-zoom-in"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={inspectedUser.kyc_id_verso_url}
                              alt="Pièce d'Identité Verso"
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-44 items-center justify-center rounded-xl border-2 border-dashed border-rose-300 bg-rose-50/50 text-xs font-bold text-rose-600 dark:border-rose-800 dark:bg-rose-950/30">
                            Photo Verso manquante
                          </div>
                        )}
                      </div>

                      {/* Photo 3: BIOMETRIC SELFIE */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                            3. Selfie Biométrique
                          </span>
                          {inspectedUser.kyc_selfie_url && (
                            <button
                              type="button"
                              onClick={() =>
                                setZoomedKycPhoto({
                                  title: `${inspectedUser.full_name} — Selfie Biométrique`,
                                  url: inspectedUser.kyc_selfie_url!,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-[#008751] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#006b40] cursor-pointer"
                            >
                              <Maximize2 className="h-3 w-3" />
                              <span>Plein écran</span>
                            </button>
                          )}
                        </div>
                        {inspectedUser.kyc_selfie_url ? (
                          <div
                            onClick={() =>
                              setZoomedKycPhoto({
                                title: `${inspectedUser.full_name} — Selfie Biométrique`,
                                url: inspectedUser.kyc_selfie_url!,
                              })
                            }
                            className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 h-44 cursor-zoom-in"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={inspectedUser.kyc_selfie_url}
                              alt="Selfie Biométrique"
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-44 items-center justify-center rounded-xl border-2 border-dashed border-rose-300 bg-rose-50/50 text-xs font-bold text-rose-600 dark:border-rose-800 dark:bg-rose-950/30">
                            Selfie manquant
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Admin KYC Decision Actions (Approve / Pending / Reject with reason) */}
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80 space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      4. Décision de Conformité KYC (Administrateur)
                    </h4>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await postAdminAction(
                            {
                              action: "update_user",
                              userId: inspectedUser.id,
                              payload: {
                                kyc_status: "verified",
                                kyc_provisioned: true,
                                kyc_rejection_reason: null,
                              },
                            },
                            `Dossier KYC de ${inspectedUser.full_name} APPROUVÉ (statut: verified).`
                          );
                          if (ok) setPreviewKycUserId(null);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#008751] px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-[#006b40] cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>
                          Approuver & Vérifier le KYC (Débloquer 2 000 000 XOF)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await postAdminAction(
                            {
                              action: "update_user",
                              userId: inspectedUser.id,
                              payload: {
                                kyc_status: "pending",
                                kyc_provisioned: true,
                              },
                            },
                            `Dossier KYC de ${inspectedUser.full_name} placé en attente (pending).`
                          );
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-400 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200 cursor-pointer"
                      >
                        <span>Maintenir en revue (Pending)</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={rejectionReasonInput}
                        onChange={(e) => setRejectionReasonInput(e.target.value)}
                        placeholder="Motif du rejet KYC (ex: Photo Verso floue, pièce expirée...)"
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await postAdminAction(
                            {
                              action: "update_user",
                              userId: inspectedUser.id,
                              payload: {
                                kyc_status: "rejected",
                                kyc_provisioned: false,
                                kyc_rejection_reason: rejectionReasonInput,
                              },
                            },
                            `Dossier KYC de ${inspectedUser.full_name} REJETÉ.`
                          );
                          if (ok) setPreviewKycUserId(null);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-700 cursor-pointer shrink-0"
                      >
                        <AlertCircle className="h-4 w-4" />
                        <span>Rejeter le Dossier KYC</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Full-Screen Zoom Lightbox for Recto / Verso / Selfie */}
          {zoomedKycPhoto && (
            <div
              onClick={() => setZoomedKycPhoto(null)}
              className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-xs cursor-zoom-out"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-3xl space-y-3"
              >
                <div className="flex items-center justify-between text-white">
                  <span className="text-sm font-extrabold text-[#F5B700]">
                    {zoomedKycPhoto.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomedKycPhoto(null)}
                    className="inline-flex items-center gap-1 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                    <span>Fermer le plein écran</span>
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border-2 border-[#F5B700]/60 bg-slate-950 p-2 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={zoomedKycPhoto.url}
                    alt={zoomedKycPhoto.title}
                    className="mx-auto max-h-[78vh] w-auto object-contain rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: RECIPIENTS DIRECTORY MANAGEMENT (Full CRUD)                    */}
      {/* ===================================================================== */}
      {tab === "recipients" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0B3D91] dark:text-[#F5B700]">
              Répertoire Global des Bénéficiaires ({recipients.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditingRecipientId(null);
                setRecipientForm({
                  full_name: "",
                  country_code: "ML",
                  currency: "XOF",
                  network_code: "orange_ml",
                  network_name: "Orange Money Mali",
                  msisdn: "+22370000000",
                  is_active: true,
                });
                setShowRecipientForm(!showRecipientForm);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4 text-[#F5B700]" />
              <span>Ajouter un bénéficiaire</span>
            </button>
          </div>

          {showRecipientForm && (
            <form
              onSubmit={handleSaveRecipient}
              className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 dark:border-slate-700 dark:bg-slate-900 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={recipientForm.full_name}
                    onChange={(e) =>
                      setRecipientForm({ ...recipientForm, full_name: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Pays & Devise</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={2}
                      value={recipientForm.country_code}
                      onChange={(e) =>
                        setRecipientForm({
                          ...recipientForm,
                          country_code: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-16 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      maxLength={3}
                      value={recipientForm.currency}
                      onChange={(e) =>
                        setRecipientForm({
                          ...recipientForm,
                          currency: e.target.value.toUpperCase(),
                        })
                      }
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Réseau Mobile Money</label>
                  <input
                    type="text"
                    value={recipientForm.network_code}
                    onChange={(e) =>
                      setRecipientForm({
                        ...recipientForm,
                        network_code: e.target.value,
                        network_name: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Numéro MSISDN</label>
                  <input
                    type="text"
                    required
                    value={recipientForm.msisdn}
                    onChange={(e) =>
                      setRecipientForm({ ...recipientForm, msisdn: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
                >
                  {editingRecipientId ? "Mettre à jour" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRecipientForm(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recipients.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-bold">
                    {r.full_name}{" "}
                    <span className="text-xs font-mono text-[#0B3D91] dark:text-[#F5B700]">
                      ({r.country_code} • {r.currency})
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {r.msisdn} — {r.network_name} ({r.network_code})
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRecipientId(r.id);
                      setRecipientForm({
                        full_name: r.full_name,
                        country_code: r.country_code,
                        currency: r.currency,
                        network_code: r.network_code,
                        network_name: r.network_name,
                        msisdn: r.msisdn,
                        is_active: r.is_active,
                      });
                      setShowRecipientForm(true);
                    }}
                    className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      postAdminAction(
                        { action: "delete_recipient", recipientId: r.id },
                        `Bénéficiaire ${r.full_name} supprimé.`
                      )
                    }
                    className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-900"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: WALLETS & INTER-WALLET LIQUIDITY CRUD                          */}
      {/* ===================================================================== */}
      {tab === "wallets" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0B3D91] dark:text-[#F5B700]">
                Portefeuilles Pays SasPay & Gestion de Trésorerie
              </h2>
              <p className="text-xs text-slate-500">
                Ajoutez, ajustez ou gelez un portefeuille pays, ou transférez des fonds entre deux pays via SasPay.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingWalletId(null);
                setWalletForm({
                  country: "BF",
                  currency: "XOF",
                  available_amount: "500000.00",
                  pending_amount: "0.00",
                  is_frozen: false,
                });
                setShowWalletForm(!showWalletForm);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4 text-[#F5B700]" />
              <span>Ajouter / Ajuster un Wallet</span>
            </button>
          </div>

          {showWalletForm && (
            <form
              onSubmit={handleSaveWallet}
              className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 dark:border-slate-700 dark:bg-slate-900 space-y-4"
            >
              <h3 className="text-sm font-bold text-[#0B3D91] dark:text-[#F5B700]">
                {editingWalletId
                  ? `Modifier le Wallet ${walletForm.country}`
                  : "Ajouter un nouveau Wallet Pays"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <CountryDropdownSelector
                    label="Pays & Devise du Portefeuille"
                    value={walletForm.country}
                    onChange={(code, currency) =>
                      setWalletForm({
                        ...walletForm,
                        country: code,
                        currency: currency,
                      })
                    }
                    disabled={Boolean(editingWalletId)}
                    balances={balances}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Solde Disponible</label>
                  <input
                    type="text"
                    required
                    value={walletForm.available_amount}
                    onChange={(e) =>
                      setWalletForm({
                        ...walletForm,
                        available_amount: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Solde En Attente</label>
                  <input
                    type="text"
                    value={walletForm.pending_amount}
                    onChange={(e) =>
                      setWalletForm({
                        ...walletForm,
                        pending_amount: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
                >
                  Enregistrer le Wallet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowWalletForm(false);
                    setEditingWalletId(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {/* Wallet Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {balances.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
                    <Wallet className="h-4 w-4" />
                    Wallet {b.country} ({b.currency})
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      b.is_frozen
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {b.is_frozen ? "GELÉ" : "ACTIF"}
                  </span>
                </div>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {b.available_amount} {b.currency}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  En attente: {b.pending_amount} {b.currency}
                </p>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWalletId(b.id);
                      setWalletForm({
                        country: b.country,
                        currency: b.currency,
                        available_amount: b.available_amount,
                        pending_amount: b.pending_amount,
                        is_frozen: b.is_frozen,
                      });
                      setShowWalletForm(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50 dark:border-slate-700"
                  >
                    <Edit3 className="h-3 w-3" />
                    Ajuster solde
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      postAdminAction(
                        {
                          action: "update_wallet",
                          walletId: b.id,
                          payload: { is_frozen: !b.is_frozen },
                        },
                        `Wallet ${b.country} ${!b.is_frozen ? "gelé" : "dégelé"}.`
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50 dark:border-slate-700"
                  >
                    {b.is_frozen ? (
                      <>
                        <Unlock className="h-3 w-3 text-emerald-600" /> Dégeler
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3 text-amber-600" /> Geler
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      postAdminAction(
                        { action: "delete_wallet", walletId: b.id },
                        `Wallet ${b.country} supprimé.`
                      )
                    }
                    className="ml-auto rounded-lg border border-rose-200 p-1 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Inter-Wallet Transfer Form & Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inter-Wallet Transfer Form with Dropdown Menu Country Selector */}
            {(() => {
              const sourceWallet = balances.find(
                (b) => b.country.toUpperCase() === walletSource.toUpperCase()
              );
              const destWallet = balances.find(
                (b) => b.country.toUpperCase() === walletDest.toUpperCase()
              );
              const sourceMeta = getCountryByCode(walletSource);
              const destMeta = getCountryByCode(walletDest);
              const isSameCountry =
                walletSource.toUpperCase() === walletDest.toUpperCase();
              const sourceAmountNum = parseFloat(walletAmount || "0");
              const sourceAvailableNum = sourceWallet
                ? parseFloat(sourceWallet.available_amount || "0")
                : 0;
              const isInsufficientBalance = Boolean(
                sourceWallet &&
                  !isNaN(sourceAmountNum) &&
                  sourceAmountNum > sourceAvailableNum
              );
              const isSourceFrozen = Boolean(sourceWallet?.is_frozen);

              const formatBalance = (val: string | number) => {
                const num = typeof val === "number" ? val : parseFloat(val);
                if (isNaN(num)) return String(val);
                return new Intl.NumberFormat("fr-FR", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                }).format(num);
              };

              return (
                <form
                  onSubmit={handleWalletTransfer}
                  className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0B3D91] dark:bg-blue-950/60 dark:text-[#F5B700]">
                        <ArrowRightLeft className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#0B3D91] dark:text-[#F5B700]">
                          Transfert Inter-Wallets SasPay
                        </h3>
                        <p className="text-[11px] text-slate-500 font-mono">
                          POST /wallet-transfers/ • Idempotency-Key
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-mono font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Multi-Devises
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Déplacez instantanément des liquidités opérationnelles entre deux portefeuilles pays via l&apos;API SasPay.
                  </p>

                  {/* Dropdown Menu Country Selectors + Swap Button */}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3 items-end">
                    <CountryDropdownSelector
                      label="Portefeuille Source (Débit)"
                      value={walletSource}
                      onChange={(code) => setWalletSource(code)}
                      disabledCode={walletDest}
                      balances={balances}
                    />

                    <div className="flex justify-center pb-0.5">
                      <button
                        type="button"
                        title="Inverser Source et Destination"
                        onClick={() => {
                          const temp = walletSource;
                          setWalletSource(walletDest);
                          setWalletDest(temp);
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:border-[#0B3D91] hover:bg-blue-50 hover:text-[#0B3D91] transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-[#F5B700] dark:hover:text-[#F5B700] shadow-xs active:scale-95"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </button>
                    </div>

                    <CountryDropdownSelector
                      label="Portefeuille Destination (Crédit)"
                      value={walletDest}
                      onChange={(code) => setWalletDest(code)}
                      disabledCode={walletSource}
                      balances={balances}
                    />
                  </div>

                  {/* Amount Input with Shortcuts */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Montant du Transfert (Chaîne décimale)
                      </label>
                      {sourceWallet && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Disponible :{" "}
                          <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatBalance(sourceWallet.available_amount)}{" "}
                            {sourceWallet.currency}
                          </strong>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={walletAmount}
                        onChange={(e) => setWalletAmount(e.target.value)}
                        placeholder="100000.00"
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:border-[#0B3D91] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-mono font-bold text-slate-400">
                        {sourceMeta.currency}
                      </span>
                    </div>

                    {/* Quick Amount Shortcuts */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                        Montants rapides :
                      </span>
                      {[
                        "50000.00",
                        "100000.00",
                        "250000.00",
                        "500000.00",
                        "1000000.00",
                        "2000000.00",
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setWalletAmount(preset)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-mono text-slate-700 hover:border-[#0B3D91] hover:text-[#0B3D91] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                        >
                          {parseInt(preset).toLocaleString("fr-FR")}
                        </button>
                      ))}
                      {sourceWallet && (
                        <button
                          type="button"
                          onClick={() =>
                            setWalletAmount(sourceWallet.available_amount)
                          }
                          className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#0B3D91] hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-[#F5B700] transition-colors"
                        >
                          Solde Max (100%)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Impact & Verification Card */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>Aperçu de l&apos;impact de trésorerie</span>
                      <span className="text-[10px] text-slate-400">
                        Taux de change SasPay appliqué à l&apos;exécution
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Source details */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Portefeuille Débité
                        </p>
                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                          <span className="text-base">{sourceMeta.flag}</span>
                          <span>
                            {sourceMeta.name} ({sourceMeta.code})
                          </span>
                        </p>
                        <div className="mt-2 text-[11px] space-y-0.5 text-slate-500 dark:text-slate-400">
                          <p>
                            Solde actuel :{" "}
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {sourceWallet
                                ? `${formatBalance(
                                    sourceWallet.available_amount
                                  )} ${sourceWallet.currency}`
                                : "Aucun solde initial"}
                            </span>
                          </p>
                          {sourceWallet &&
                            !isNaN(sourceAmountNum) &&
                            sourceAmountNum > 0 && (
                              <p
                                className={
                                  isInsufficientBalance
                                    ? "text-rose-600 font-bold"
                                    : "text-slate-600 dark:text-slate-400"
                                }
                              >
                                Solde après débit :{" "}
                                <span className="font-mono font-bold">
                                  {formatBalance(
                                    (
                                      sourceAvailableNum - sourceAmountNum
                                    ).toFixed(2)
                                  )}{" "}
                                  {sourceWallet.currency}
                                </span>
                              </p>
                            )}
                        </div>
                      </div>

                      {/* Destination details */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Portefeuille Crédité
                        </p>
                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                          <span className="text-base">{destMeta.flag}</span>
                          <span>
                            {destMeta.name} ({destMeta.code})
                          </span>
                        </p>
                        <div className="mt-2 text-[11px] space-y-0.5 text-slate-500 dark:text-slate-400">
                          <p>
                            Solde actuel :{" "}
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {destWallet
                                ? `${formatBalance(
                                    destWallet.available_amount
                                  )} ${destWallet.currency}`
                                : "Création auto à réception"}
                            </span>
                          </p>
                          {destWallet &&
                            !isNaN(sourceAmountNum) &&
                            sourceAmountNum > 0 && (
                              <p className="text-emerald-600 dark:text-emerald-400">
                                Solde projeté :{" "}
                                <span className="font-mono font-bold">
                                  ~
                                  {formatBalance(
                                    (
                                      parseFloat(destWallet.available_amount) +
                                      sourceAmountNum
                                    ).toFixed(2)
                                  )}{" "}
                                  {destWallet.currency}
                                </span>
                              </p>
                            )}
                        </div>
                      </div>
                    </div>

                    {/* Conflict & Security Alerts */}
                    {isSameCountry && (
                      <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                          Le pays source et le pays destination doivent être différents.
                        </span>
                      </div>
                    )}

                    {isSourceFrozen && (
                      <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                          Le portefeuille source {walletSource} est actuellement gelé. Les débits sont suspendus.
                        </span>
                      </div>
                    )}

                    {isInsufficientBalance && (
                      <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                          Le montant demandé ({formatBalance(walletAmount)}{" "}
                          {sourceMeta.currency}) dépasse le solde disponible (
                          {formatBalance(sourceAvailableNum)} {sourceMeta.currency}).
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={
                      isSameCountry ||
                      isSourceFrozen ||
                      isInsufficientBalance ||
                      !walletAmount ||
                      parseFloat(walletAmount) <= 0
                    }
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0B3D91] px-6 py-3 text-xs font-bold text-white hover:bg-[#0B3D91]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-98"
                  >
                    <ArrowRightLeft className="h-4 w-4 text-[#F5B700]" />
                    <span>
                      Exécuter le transfert ({sourceMeta.code} → {destMeta.code} : {walletAmount} {sourceMeta.currency})
                    </span>
                  </button>
                </form>
              );
            })()}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Historique des Transferts Inter-Wallets ({walletTransfers.length})
              </h3>
              {walletTransfers.length === 0 ? (
                <p className="text-xs text-slate-500">Aucun transfert inter-wallet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {walletTransfers.map((wt) => (
                    <div
                      key={wt.id}
                      className="rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold">
                          {wt.from_country} ({wt.from_amount} {wt.from_currency}) →{" "}
                          {wt.to_country} ({wt.to_amount} {wt.to_currency})
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          Taux: {wt.exchange_rate} • Idempotency: {wt.idempotency_key}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        {wt.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: CMS CONTENTS CRUD (Banners, FAQs, Corridor Notices, Legal)     */}
      {/* ===================================================================== */}
      {tab === "cms" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0B3D91] dark:text-[#F5B700]">
                Gestion des Contenus du Site (CMS Bilingue FR / EN)
              </h2>
              <p className="text-xs text-slate-500">
                Créez, modifiez ou dépubliez des bannières d&apos;annonce, questions FAQ, notes de corridors (ex. Afrique du Sud / Bidvest) et mentions légales.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCmsId(null);
                setCmsForm({
                  slug: "",
                  category: "announcement",
                  title_fr: "",
                  title_en: "",
                  body_fr: "",
                  body_en: "",
                  is_published: true,
                  priority: 10,
                });
                setShowCmsForm(!showCmsForm);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4 text-[#F5B700]" />
              <span>Nouveau Contenu CMS</span>
            </button>
          </div>

          {showCmsForm && (
            <form
              onSubmit={handleSaveCms}
              className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 dark:border-slate-700 dark:bg-slate-900 space-y-4"
            >
              <h3 className="text-sm font-bold text-[#0B3D91] dark:text-[#F5B700]">
                {editingCmsId ? "Modifier le contenu CMS" : "Créer un contenu CMS"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1">Catégorie</label>
                  <select
                    value={cmsForm.category}
                    onChange={(e) =>
                      setCmsForm({
                        ...cmsForm,
                        category: e.target.value as CmsContentItem["category"],
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="announcement">Bannière / Annonce (announcement)</option>
                    <option value="corridor_notice">Note Corridor (corridor_notice)</option>
                    <option value="faq">Question FAQ (faq)</option>
                    <option value="legal">Section Légale (legal)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Slug unique</label>
                  <input
                    type="text"
                    value={cmsForm.slug}
                    onChange={(e) => setCmsForm({ ...cmsForm, slug: e.target.value })}
                    placeholder="auto-généré si vide"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Priorité d&apos;affichage</label>
                  <input
                    type="number"
                    value={cmsForm.priority}
                    onChange={(e) =>
                      setCmsForm({ ...cmsForm, priority: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1">Titre (Français)</label>
                  <input
                    type="text"
                    required
                    value={cmsForm.title_fr}
                    onChange={(e) =>
                      setCmsForm({ ...cmsForm, title_fr: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Title (English)</label>
                  <input
                    type="text"
                    value={cmsForm.title_en}
                    onChange={(e) =>
                      setCmsForm({ ...cmsForm, title_en: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Contenu (Français)</label>
                  <textarea
                    rows={3}
                    required
                    value={cmsForm.body_fr}
                    onChange={(e) =>
                      setCmsForm({ ...cmsForm, body_fr: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Content (English)</label>
                  <textarea
                    rows={3}
                    value={cmsForm.body_en}
                    onChange={(e) =>
                      setCmsForm({ ...cmsForm, body_en: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
                >
                  {editingCmsId ? "Enregistrer" : "Publier le contenu"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCmsForm(false);
                    setEditingCmsId(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {cmsContents.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#0B3D91]/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-[#0B3D91] dark:bg-[#F5B700]/20 dark:text-[#F5B700]">
                      {item.category}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      /{item.slug}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.is_published
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {item.is_published ? "PUBLIÉ" : "BROUILLON"}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    FR: {item.title_fr}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {item.body_fr}
                  </p>
                  {item.title_en && (
                    <p className="text-[11px] text-slate-400 italic">
                      EN: {item.title_en} — {item.body_en}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      postAdminAction(
                        {
                          action: "update_content",
                          contentId: item.id,
                          payload: { is_published: !item.is_published },
                        },
                        `Visibilité de "${item.title_fr}" mise à jour.`
                      )
                    }
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700"
                  >
                    {item.is_published ? "Dépublier" : "Publier"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingCmsId(item.id);
                      setCmsForm({
                        slug: item.slug,
                        category: item.category,
                        title_fr: item.title_fr,
                        title_en: item.title_en,
                        body_fr: item.body_fr,
                        body_en: item.body_en,
                        is_published: item.is_published,
                        priority: item.priority,
                      });
                      setShowCmsForm(true);
                    }}
                    className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      postAdminAction(
                        { action: "delete_content", contentId: item.id },
                        `Contenu "${item.title_fr}" supprimé.`
                      )
                    }
                    className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-900"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 7: CORRIDORS & EXCHANGE RATES CRUD                                */}
      {/* ===================================================================== */}
      {tab === "corridors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0B3D91] dark:text-[#F5B700]">
                Configuration des Corridors & Taux de Change (1 XOF → Devise)
              </h2>
              <p className="text-xs text-slate-500">
                Activez/désactivez des pays de destination, définissez des taux de change ou marges FX, et documentez les rails de décaissement.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCorridorForm(!showCorridorForm)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4 text-[#F5B700]" />
              <span>Ajouter / Modifier un Corridor</span>
            </button>
          </div>

          {showCorridorForm && (
            <form
              onSubmit={handleSaveCorridor}
              className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 dark:border-slate-700 dark:bg-slate-900 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1">Code ISO-2</label>
                  <input
                    type="text"
                    maxLength={2}
                    required
                    value={corridorForm.iso_code}
                    onChange={(e) =>
                      setCorridorForm({
                        ...corridorForm,
                        iso_code: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Nom du Pays</label>
                  <input
                    type="text"
                    required
                    value={corridorForm.country_name}
                    onChange={(e) =>
                      setCorridorForm({
                        ...corridorForm,
                        country_name: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Devise (ISO-3)</label>
                  <input
                    type="text"
                    maxLength={3}
                    required
                    value={corridorForm.currency}
                    onChange={(e) =>
                      setCorridorForm({
                        ...corridorForm,
                        currency: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">
                    Taux (1 XOF = ? Devise)
                  </label>
                  <input
                    type="text"
                    required
                    value={corridorForm.custom_rate_from_xof}
                    onChange={(e) =>
                      setCorridorForm({
                        ...corridorForm,
                        custom_rate_from_xof: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Spread FX (%)</label>
                  <input
                    type="text"
                    value={corridorForm.fee_spread_percent}
                    onChange={(e) =>
                      setCorridorForm({
                        ...corridorForm,
                        fee_spread_percent: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Note Rail Payout</label>
                  <input
                    type="text"
                    value={corridorForm.payout_rail_note}
                    onChange={(e) =>
                      setCorridorForm({
                        ...corridorForm,
                        payout_rail_note: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white"
                >
                  Enregistrer le Corridor
                </button>
                <button
                  type="button"
                  onClick={() => setShowCorridorForm(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {corridorOverrides.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
                      CI (XOF) → {c.country_name} ({c.iso_code} • {c.currency})
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        c.is_enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {c.is_enabled ? "ACTIF" : "INACTIF"}
                    </span>
                  </div>
                  <p className="text-xs font-mono">
                    1 XOF = <strong>{c.custom_rate_from_xof}</strong> {c.currency} (Spread:{" "}
                    {c.fee_spread_percent}%)
                  </p>
                  <p className="text-[11px] text-slate-500">{c.payout_rail_note}</p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      postAdminAction(
                        {
                          action: "upsert_corridor",
                          payload: { ...c, is_enabled: !c.is_enabled },
                        },
                        `Corridor ${c.iso_code} ${!c.is_enabled ? "activé" : "désactivé"}.`
                      )
                    }
                    className="rounded-xl border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700"
                  >
                    {c.is_enabled ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCorridorForm({
                        iso_code: c.iso_code,
                        country_name: c.country_name,
                        currency: c.currency,
                        custom_rate_from_xof: c.custom_rate_from_xof,
                        fee_spread_percent: c.fee_spread_percent,
                        is_enabled: c.is_enabled,
                        payout_rail_note: c.payout_rail_note,
                      });
                      setShowCorridorForm(true);
                    }}
                    className="rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      postAdminAction(
                        { action: "delete_corridor", corridorId: c.id },
                        `Corridor ${c.iso_code} supprimé.`
                      )
                    }
                    className="ml-auto rounded-xl border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 8: GLOBAL SETTINGS (`settings`)                                   */}
      {/* ===================================================================== */}
      {tab === "settings" && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-4 max-w-2xl"
        >
          <h2 className="text-base font-bold text-[#0B3D91] dark:text-[#F5B700]">
            Configuration Globale des Frais & Plafonds Réglementaires KYC
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Mode de facturation des frais (fee_charge_mode)
              </label>
              <select
                value={settings.fee_charge_mode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    fee_charge_mode: e.target.value as "ADD_ON" | "DEDUCTED",
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="ADD_ON">ADD_ON (Frais ajoutés au payeur)</option>
                <option value="DEDUCTED">DEDUCTED (Frais déduits du montant)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Commission plateforme (%)
              </label>
              <input
                type="text"
                value={settings.platform_fee_percent}
                onChange={(e) =>
                  setSettings({ ...settings, platform_fee_percent: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Frais fixes additionnels (XOF)
              </label>
              <input
                type="text"
                value={settings.platform_fee_fixed_xof}
                onChange={(e) =>
                  setSettings({ ...settings, platform_fee_fixed_xof: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Plafond par transaction — Non vérifié (XOF)
              </label>
              <input
                type="text"
                value={settings.unverified_tx_limit_xof}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    unverified_tx_limit_xof: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Plafond mensuel — Non vérifié (XOF)
              </label>
              <input
                type="text"
                value={settings.unverified_monthly_limit_xof}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    unverified_monthly_limit_xof: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Plafond par transaction — Vérifié KYC (XOF)
              </label>
              <input
                type="text"
                value={settings.verified_tx_limit_xof}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    verified_tx_limit_xof: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Plafond mensuel — Vérifié KYC (XOF)
              </label>
              <input
                type="text"
                value={settings.verified_monthly_limit_xof}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    verified_monthly_limit_xof: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-[#0B3D91] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0B3D91]/90"
          >
            Enregistrer la configuration
          </button>
        </form>
      )}

      {/* ===================================================================== */}
      {/* TAB 9: AUDIT LOGS (`transaction_events`) & WEBHOOKS (`webhook_events`)*/}
      {/* ===================================================================== */}
      {tab === "audit" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-[#0B3D91] dark:text-[#F5B700]">
              Journal d&apos;audit des états & actions admin (transaction_events)
            </h3>
            {auditEvents.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun événement.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-slate-100 p-2.5 text-xs dark:border-slate-800"
                  >
                    <p className="font-bold">
                      {ev.from_status || "init"} →{" "}
                      <span className="text-[#0B3D91] dark:text-[#F5B700]">
                        {ev.to_status}
                      </span>{" "}
                      <span className="font-normal text-slate-400">
                        ({ev.actor_type})
                      </span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">{ev.reason}</p>
                    <p className="text-[10px] font-mono text-slate-400">
                      {new Date(ev.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-[#0B3D91] dark:text-[#F5B700]">
              Webhooks SasPay reçus (webhook_events)
            </h3>
            {webhookLogs.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun webhook enregistré.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {webhookLogs.map((wh) => (
                  <div
                    key={wh.id}
                    className="rounded-xl border border-slate-100 p-2.5 text-xs dark:border-slate-800"
                  >
                    <p className="font-bold font-mono">
                      {wh.event_type} — {wh.provider_event_id}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">
                      Signature HMAC-SHA256:{" "}
                      <strong
                        className={
                          wh.signature_valid ? "text-emerald-600" : "text-rose-600"
                        }
                      >
                        {wh.signature_valid ? "Valide" : "Invalide"}
                      </strong>{" "}
                      • Traité: {wh.processed ? "Oui" : "Non"}
                    </p>
                    {wh.processing_error && (
                      <p className="text-rose-600">{wh.processing_error}</p>
                    )}
                    <p className="text-[10px] font-mono text-slate-400">
                      {new Date(wh.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { useAppPreferences } from "@/components/layout/AppPreferencesProvider";
import type { TransactionStatus } from "@/lib/state-machine";

interface TransactionDetail {
  id: string;
  reference: string;
  sender_country: string;
  sender_currency: string;
  destination_country: string;
  destination_currency: string;
  destination_network: string;
  destination_network_name: string;
  recipient_name: string;
  recipient_msisdn: string;
  send_amount: string;
  fee_amount: string;
  total_charged: string;
  exchange_rate: string;
  payout_amount: string;
  status: TransactionStatus;
  saspay_payment_id: string | null;
  saspay_checkout_url: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
  completed_at: string | null;
}

interface TransactionEventItem {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_type: string;
  reason: string;
  created_at: string;
}

const STEPS: TransactionStatus[] = [
  "created",
  "payment_pending",
  "paid",
  "payout_pending",
  "completed",
];

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useAppPreferences();
  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [events, setEvents] = useState<TransactionEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setActionLoading(true);
    setActionFeedback(null);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_otp", otp: otpCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Code OTP invalide ou expiré.");
      } else {
        setActionFeedback("Code OTP soumis avec succès. Vérification SasPay en cours...");
        setOtpCode("");
        await fetchStatus();
      }
    } catch {
      setError("Erreur réseau lors de la soumission du code OTP.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryPayment = async () => {
    setActionLoading(true);
    setActionFeedback(null);
    setError(null);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `retry-${Date.now()}`;
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_payment", idempotencyKey }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Impossible de relancer le paiement.");
      } else if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
      } else {
        setActionFeedback("Nouvelle tentative de paiement lancée auprès de SasPay.");
        await fetchStatus();
      }
    } catch {
      setError("Erreur réseau lors de la relance du paiement.");
    } finally {
      setActionLoading(false);
    }
  };

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}/status`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Impossible de récupérer ce transfert.");
        return;
      }
      setTx(json.data.transaction);
      setEvents(json.data.events || []);
    } catch {
      setError("Erreur réseau lors de la vérification du statut.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    // Poll every 5 seconds while transaction is in a non-terminal state
    const interval = setInterval(() => {
      if (
        !tx ||
        ["created", "payment_pending", "paid", "payout_pending", "retry"].includes(
          tx.status
        )
      ) {
        fetchStatus();
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tx?.status]);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Vérification du statut auprès du serveur et de SasPay...
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="mx-auto max-w-xl py-12 space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {error || "Transaction introuvable."}
        </div>
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B3D91] dark:text-[#F5B700]"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux transferts
        </Link>
      </div>
    );
  }

  const currentStepIdx = STEPS.indexOf(tx.status);
  const isFailed =
    tx.status === "payment_failed" || tx.status === "payout_failed";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0B3D91] dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Tous mes transferts</span>
        </Link>

        <button
          type="button"
          onClick={fetchStatus}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Revérifier avec SasPay</span>
        </button>
      </div>

      {/* Main Status Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <p className="text-xs font-mono text-slate-500">{tx.reference}</p>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Transfert vers {tx.recipient_name}
            </h1>
            <p className="text-xs text-slate-500">
              Pays d&apos;origine : <strong>{tx.sender_country || "CI"} ({tx.sender_currency})</strong> → Pays de destination : <strong>{tx.destination_country} ({tx.destination_currency})</strong> • {tx.destination_network_name} •{" "}
              {tx.recipient_msisdn}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-2xl font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
              {tx.payout_amount} {tx.destination_currency}
            </p>
            <p className="text-xs text-slate-500">
              Total payé: {tx.total_charged} {tx.sender_currency} (Frais:{" "}
              {tx.fee_amount} {tx.sender_currency})
            </p>
          </div>
        </div>

        {/* Stepper Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="uppercase tracking-wider text-slate-500">
              Progression du transfert
            </span>
            <span className="text-[#0B3D91] dark:text-[#F5B700]">
              {t.transactions.status[tx.status] || tx.status}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {STEPS.map((step, idx) => {
              const reached = currentStepIdx >= idx && !isFailed;
              return (
                <div key={step} className="space-y-1.5">
                  <div
                    className={`h-2 rounded-full transition-colors ${
                      reached
                        ? "bg-[#0B3D91] dark:bg-[#F5B700]"
                        : isFailed && idx === 1
                        ? "bg-rose-500"
                        : "bg-slate-200 dark:bg-slate-800"
                    }`}
                  />
                  <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 truncate">
                    {t.transactions.status[step]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {actionFeedback && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            {actionFeedback}
          </div>
        )}

        {isFailed && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {tx.failure_code || "Erreur"} :{" "}
                  {tx.failure_reason || "Le transfert n'a pas pu aboutir."}
                </p>
                <p className="mt-1">
                  Si votre paiement a été débité mais que l&apos;envoi au bénéficiaire a échoué, un administrateur peut relancer le décaissement ou procéder au remboursement.
                </p>
              </div>
            </div>
            {tx.status === "payment_failed" && tx.saspay_payment_id && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRetryPayment}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white shrink-0 hover:bg-[#0B3D91]/90 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-[#F5B700] ${actionLoading ? "animate-spin" : ""}`} />
                <span>Relancer le paiement SasPay</span>
              </button>
            )}
          </div>
        )}

        {tx.status === "payment_pending" && tx.saspay_payment_id && (
          <form
            onSubmit={handleConfirmOtp}
            className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <p className="font-bold">Confirmation OTP post-push (si demandée par votre opérateur)</p>
              <p className="text-[11px] opacity-80">
                Si vous avez reçu un code de validation par SMS après l&apos;initiation du paiement, saisissez-le ici :
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Code OTP"
                className="w-28 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-mono dark:border-amber-700 dark:bg-slate-900"
              />
              <button
                type="submit"
                disabled={actionLoading || !otpCode.trim()}
                className="rounded-xl bg-[#0B3D91] px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                Valider OTP
              </button>
            </div>
          </form>
        )}

        {tx.status === "payment_pending" && tx.saspay_checkout_url && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-[#0B3D91] dark:text-blue-200">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                En attente de confirmation du paiement sur SasPay. Ne fermez pas cette page ou finalisez votre paiement.
              </span>
            </div>
            <a
              href={tx.saspay_checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-4 py-2 text-xs font-bold text-white shrink-0"
            >
              <span>Ouvrir la page de paiement SasPay</span>
              <ExternalLink className="h-3.5 w-3.5 text-[#F5B700]" />
            </a>
          </div>
        )}

        {tx.status === "completed" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Transfert terminé ! Le bénéficiaire ({tx.recipient_name}) a reçu{" "}
              <strong>
                {tx.payout_amount} {tx.destination_currency}
              </strong>{" "}
              sur son compte {tx.destination_network_name}.
            </span>
          </div>
        )}
      </div>

      {/* Audit Timeline (`transaction_events`) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Journal d&apos;audit des états (transaction_events)
        </h2>

        {events.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun événement enregistré.</p>
        ) : (
          <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-3 space-y-4">
            {events.map((ev) => (
              <li key={ev.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-[#0B3D91] dark:border-slate-900 dark:bg-[#F5B700]" />
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {ev.from_status ? `${ev.from_status} → ` : ""}
                  <span className="text-[#0B3D91] dark:text-[#F5B700]">
                    {ev.to_status}
                  </span>{" "}
                  <span className="font-normal text-slate-500">
                    ({ev.actor_type})
                  </span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {ev.reason}
                </p>
                <time className="text-[10px] font-mono text-slate-400">
                  {new Date(ev.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}


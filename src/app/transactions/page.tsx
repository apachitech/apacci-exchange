"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { History, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { useAppPreferences } from "@/components/layout/AppPreferencesProvider";
import type { TransactionStatus } from "@/lib/state-machine";

interface TxItem {
  id: string;
  reference: string;
  sender_country?: string;
  sender_currency: string;
  destination_country: string;
  destination_currency: string;
  destination_network_name: string;
  recipient_name: string;
  recipient_msisdn: string;
  send_amount: string;
  total_charged: string;
  payout_amount: string;
  status: TransactionStatus;
  created_at: string;
}

export default function TransactionsPage() {
  const { t } = useAppPreferences();
  const [transactions, setTransactions] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTransactions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions");
      if (res.status === 401) {
        setError("Veuillez vous connecter pour consulter l'historique de vos transferts.");
      } else {
        const json = await res.json();
        if (json.success) {
          setTransactions(json.data || []);
        } else {
          setError(json.error?.message || "Erreur lors du chargement.");
        }
      }
    } catch {
      setError("Erreur réseau lors du chargement des transactions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0B3D91] dark:text-white">
            {t.transactions.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.transactions.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={loadTransactions}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">
          Chargement des transactions...
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <History className="h-9 w-9 mx-auto text-slate-400" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t.transactions.empty}
          </p>
          <Link
            href="/send"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0B3D91] px-4 py-2.5 text-xs font-bold text-white"
          >
            <span>Effectuer un premier transfert</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#F5B700]" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => {
            const badgeColor =
              tx.status === "completed"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : tx.status === "payment_failed" || tx.status === "payout_failed"
                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                : "bg-blue-100 text-[#0B3D91] dark:bg-blue-950 dark:text-blue-200";

            return (
              <Link
                key={tx.id}
                href={`/transactions/${tx.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-[#0B3D91] transition dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {tx.recipient_name}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeColor}`}
                    >
                      {t.transactions.status[tx.status] || tx.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    {tx.reference} • Origine: <strong>{tx.sender_country || "CI"} ({tx.sender_currency})</strong> → Destination: <strong>{tx.destination_country} ({tx.destination_currency})</strong> • {tx.destination_network_name} •{" "}
                    {new Date(tx.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-[#0B3D91] dark:text-[#F5B700]">
                      +{tx.payout_amount} {tx.destination_currency}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Débité: {tx.total_charged} {tx.sender_currency}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}


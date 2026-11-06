"use client";

import React, { useEffect, useState } from "react";
import { Users, UserPlus, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { useAppPreferences } from "@/components/layout/AppPreferencesProvider";
import type { CorridorsData } from "@/lib/corridors";

interface RecipientRow {
  id: string;
  full_name: string;
  country_code: string;
  currency: string;
  network_code: string;
  network_name: string;
  msisdn: string;
  created_at: string;
}

export default function RecipientsPage() {
  const { t } = useAppPreferences();
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [corridors, setCorridors] = useState<CorridorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("ML");
  const [networkCode, setNetworkCode] = useState("orange_ml");
  const [msisdn, setMsisdn] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [recRes, corrRes] = await Promise.all([
        fetch("/api/recipients"),
        fetch("/api/corridors"),
      ]);
      const corrJson = await corrRes.json();
      if (corrJson.success && corrJson.data) {
        setCorridors(corrJson.data);
      }

      if (recRes.status === 401) {
        setError("Veuillez vous connecter pour consulter et enregistrer vos bénéficiaires.");
      } else {
        const recJson = await recRes.json();
        if (recJson.success) {
          setRecipients(recJson.data || []);
        } else {
          setError(recJson.error?.message || "Erreur lors du chargement.");
        }
      }
    } catch {
      setError("Impossible de charger les bénéficiaires.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const currentDest = corridors?.destinations.find(
    (d) => d.isoCode === countryCode
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentDest) return;

    const netObj = currentDest.networks.find((n) => n.code === networkCode);

    setSaving(true);
    try {
      const res = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          countryCode: currentDest.isoCode,
          currency: currentDest.currency,
          networkCode,
          networkName: netObj?.name || networkCode,
          msisdn,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Impossible d'ajouter ce bénéficiaire.");
        return;
      }
      setFullName("");
      setMsisdn("");
      await loadAll();
    } catch {
      setError("Erreur réseau lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/recipients?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRecipients((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0B3D91] dark:text-white">
          {t.recipients.title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t.recipients.subtitle}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Add Recipient Form */}
        <form
          onSubmit={handleAdd}
          className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4 h-fit"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-[#0B3D91] dark:text-[#F5B700]">
            <UserPlus className="h-4 w-4" />
            <span>{t.recipients.addTitle}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nom complet
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Fatoumata Keïta"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pays
            </label>
            <select
              value={countryCode}
              onChange={(e) => {
                const code = e.target.value;
                setCountryCode(code);
                const d = corridors?.destinations.find((x) => x.isoCode === code);
                setNetworkCode(d?.networks[0]?.code || "");
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              {(corridors?.destinations || []).map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
                  {c.flag} {c.name} ({c.currency})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Réseau Mobile Money
            </label>
            <select
              value={networkCode}
              onChange={(e) => setNetworkCode(e.target.value)}
              disabled={!currentDest || currentDest.networks.length === 0}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold focus:border-[#0B3D91] focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
            >
              {currentDest && currentDest.networks.length > 0 ? (
                currentDest.networks.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.name}
                  </option>
                ))
              ) : (
                <option value="unavailable">Aucun réseau actif</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Numéro Mobile Money ({currentDest?.dialCode || "+..."})
            </label>
            <input
              type="tel"
              required
              value={msisdn}
              onChange={(e) => setMsisdn(e.target.value)}
              placeholder={`${currentDest?.dialCode || "+223"}76000000`}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-mono focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !currentDest || currentDest.networks.length === 0}
            className="w-full rounded-xl bg-[#0B3D91] py-3 text-sm font-bold text-white hover:bg-[#0B3D91]/90 disabled:opacity-50 transition"
          >
            {saving ? "Enregistrement..." : t.recipients.save}
          </button>
        </form>

        {/* Recipients List */}
        <div className="lg:col-span-7 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-[#0B3D91]" />
              <span className="text-sm">Chargement...</span>
            </div>
          ) : recipients.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900 space-y-2">
              <Users className="h-8 w-8 mx-auto text-slate-400" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {t.recipients.empty}
              </p>
            </div>
          ) : (
            recipients.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">
                    {r.full_name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {r.country_code} • {r.network_name} • {r.msisdn}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t.recipients.delete}</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


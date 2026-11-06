"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, Wallet, AlertCircle } from "lucide-react";
import {
  SASPAY_AFRICAN_COUNTRIES,
  getCountryByCode,
  type CountryMeta,
} from "@/lib/country-catalog";

export interface BalancePreviewInfo {
  id?: string;
  country: string;
  currency: string;
  available_amount: string;
  pending_amount?: string;
  is_frozen?: boolean;
}

interface CountryDropdownSelectorProps {
  label: string;
  value: string;
  onChange: (code: string, currency: string) => void;
  onSelectCountry?: (country: CountryMeta) => void;
  disabledCode?: string;
  balances?: BalancePreviewInfo[];
  disabled?: boolean;
  className?: string;
}

export function CountryDropdownSelector({
  label,
  value,
  onChange,
  onSelectCountry,
  disabledCode,
  balances = [],
  disabled = false,
  className = "",
}: CountryDropdownSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = getCountryByCode(value);

  // Find if merchant has an active wallet balance for this selected country
  const currentWallet = balances.find(
    (b) => b.country.toUpperCase() === selectedCountry.code
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Filter countries by search term
  const query = search.trim().toLowerCase();
  const filteredCountries = SASPAY_AFRICAN_COUNTRIES.filter((c) => {
    if (!query) return true;
    return (
      c.name.toLowerCase().includes(query) ||
      c.code.toLowerCase().includes(query) ||
      c.currency.toLowerCase().includes(query) ||
      (c.region && c.region.toLowerCase().includes(query))
    );
  });

  // Separate active merchant wallets from other SasPay countries
  const activeWalletCodes = new Set(
    balances.map((b) => b.country.toUpperCase())
  );

  const activeWalletCountries = filteredCountries.filter((c) =>
    activeWalletCodes.has(c.code)
  );

  const otherCountries = filteredCountries.filter(
    (c) => !activeWalletCodes.has(c.code)
  );

  const formatBalanceNumber = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {currentWallet && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
              currentWallet.is_frozen
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            <Wallet className="h-3 w-3" />
            {currentWallet.is_frozen ? (
              <span>Portefeuille gelé ❄️</span>
            ) : (
              <span>
                Dispo: {formatBalanceNumber(currentWallet.available_amount)}{" "}
                {currentWallet.currency}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Main Selector Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-all ${
          isOpen
            ? "border-[#0B3D91] ring-2 ring-[#0B3D91]/20 dark:border-[#F5B700] dark:ring-[#F5B700]/20"
            : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600"
        } ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800"
            : "bg-white dark:bg-slate-900 shadow-xs cursor-pointer"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl leading-none select-none">
            {selectedCountry.flag}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {selectedCountry.name}
              </span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {selectedCountry.code}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-[#0B3D91] dark:text-[#F5B700]">
                {selectedCountry.currency}
              </span>
              {selectedCountry.region && (
                <span>• {selectedCountry.region}</span>
              )}
            </div>
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-[#0B3D91] dark:text-[#F5B700]" : ""
          }`}
        />
      </button>

      {/* Dropdown Popover Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par pays, code ou devise..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Countries List */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-2">
            {/* Group 1: Merchant Active Wallets */}
            {activeWalletCountries.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#0B3D91] dark:text-[#F5B700] flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  <span>Vos Portefeuilles Actifs ({activeWalletCountries.length})</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {activeWalletCountries.map((c) => {
                    const isSelected = c.code === selectedCountry.code;
                    const isConflict = Boolean(
                      disabledCode && disabledCode.toUpperCase() === c.code
                    );
                    const wallet = balances.find(
                      (b) => b.country.toUpperCase() === c.code
                    );

                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          onChange(c.code, c.currency);
                          if (onSelectCountry) onSelectCountry(c);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-blue-50 font-bold text-[#0B3D91] dark:bg-blue-950/40 dark:text-[#F5B700]"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl leading-none">{c.flag}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold truncate">
                                {c.name}
                              </span>
                              <span className="rounded bg-slate-200/80 px-1 py-0.2 text-[9px] font-mono text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                {c.code}
                              </span>
                              {isConflict && (
                                <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  Autre sélection
                                </span>
                              )}
                            </div>
                            {wallet && (
                              <p
                                className={`text-[10px] ${
                                  wallet.is_frozen
                                    ? "text-rose-500 font-bold"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {wallet.is_frozen
                                  ? "Portefeuille gelé"
                                  : `Solde: ${formatBalanceNumber(
                                      wallet.available_amount
                                    )} ${wallet.currency}`}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {c.currency}
                          </span>
                          {isSelected && (
                            <Check className="h-4 w-4 text-[#0B3D91] dark:text-[#F5B700]" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Group 2: Other Supported SasPay Countries */}
            {otherCountries.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Autres Pays SasPay ({otherCountries.length})
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {otherCountries.map((c) => {
                    const isSelected = c.code === selectedCountry.code;
                    const isConflict = Boolean(
                      disabledCode && disabledCode.toUpperCase() === c.code
                    );

                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          onChange(c.code, c.currency);
                          if (onSelectCountry) onSelectCountry(c);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-blue-50 font-bold text-[#0B3D91] dark:bg-blue-950/40 dark:text-[#F5B700]"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl leading-none">{c.flag}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold truncate">
                                {c.name}
                              </span>
                              <span className="rounded bg-slate-200/80 px-1 py-0.2 text-[9px] font-mono text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                {c.code}
                              </span>
                              {isConflict && (
                                <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  Autre sélection
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {c.region || "Afrique"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {c.currency}
                          </span>
                          {isSelected && (
                            <Check className="h-4 w-4 text-[#0B3D91] dark:text-[#F5B700]" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredCountries.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                <AlertCircle className="mx-auto mb-1 h-4 w-4 text-slate-400" />
                Aucun pays trouvé pour &quot;{search}&quot;.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  SUPPORTED_CURRENCIES,
  getCurrencyByCode,
  type CurrencyMeta,
} from "@/lib/country-catalog";

interface CurrencyDropdownSelectorProps {
  label?: string;
  value: string;
  onChange: (currencyCode: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CurrencyDropdownSelector({
  label = "Devise (ISO-3)",
  value,
  onChange,
  disabled = false,
  className = "",
}: CurrencyDropdownSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCurrency = getCurrencyByCode(value);

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

  const query = search.trim().toLowerCase();
  const filteredCurrencies = SUPPORTED_CURRENCIES.filter((c) => {
    if (!query) return true;
    return (
      c.code.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query) ||
      c.symbol.toLowerCase().includes(query)
    );
  });

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
      )}

      {/* Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all ${
          isOpen
            ? "border-[#0B3D91] ring-2 ring-[#0B3D91]/20 dark:border-[#F5B700] dark:ring-[#F5B700]/20"
            : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600"
        } ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800"
            : "bg-white dark:bg-slate-900 shadow-xs cursor-pointer"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedCurrency.flag && (
            <span className="text-lg leading-none select-none">
              {selectedCurrency.flag}
            </span>
          )}
          <span className="text-xs font-mono font-bold text-[#0B3D91] dark:text-[#F5B700]">
            {selectedCurrency.code}
          </span>
          <span className="text-xs text-slate-500 truncate dark:text-slate-400">
            {selectedCurrency.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {selectedCurrency.symbol}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-[#0B3D91] dark:text-[#F5B700]" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher devise (ex: XOF, EUR, $)..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0B3D91] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
            {filteredCurrencies.map((c) => {
              const isSelected = c.code === selectedCurrency.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-blue-50 font-bold text-[#0B3D91] dark:bg-blue-950/40 dark:text-[#F5B700]"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {c.flag && (
                      <span className="text-base leading-none">{c.flag}</span>
                    )}
                    <span className="font-mono font-bold">{c.code}</span>
                    <span className="text-slate-500 truncate dark:text-slate-400 text-[11px]">
                      {c.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {c.symbol}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-[#0B3D91] dark:text-[#F5B700]" />
                    )}
                  </div>
                </button>
              );
            })}

            {filteredCurrencies.length === 0 && (
              <div className="p-3 text-center text-xs text-slate-400">
                Aucune devise trouvée.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

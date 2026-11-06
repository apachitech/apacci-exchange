import React from "react";
import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 font-bold tracking-tight select-none ${className}`}
      aria-label="Apacci Exchange"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B3D91] text-white shadow-sm ring-1 ring-[#F5B700]/40">
        <span className="text-lg font-extrabold tracking-tighter">A</span>
        <span
          className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#F5B700] ring-2 ring-white dark:ring-slate-900"
          aria-hidden="true"
        />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-lg font-extrabold text-[#0B3D91] dark:text-white">
          Apacci{" "}
          <span className="text-[#F5B700]">Exchange</span>
        </span>
        <span className="text-[10px] font-medium tracking-wider uppercase text-slate-500 dark:text-slate-400">
          Pan-African Transfers
        </span>
      </span>
    </Link>
  );
}


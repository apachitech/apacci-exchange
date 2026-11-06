"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Send,
  Users,
  History,
  ShieldCheck,
  LogIn,
  LogOut,
  Globe,
  Moon,
  Sun,
  Home,
  UserCheck,
  ShieldAlert,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  HelpCircle,
  Lock,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAppPreferences } from "./AppPreferencesProvider";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, t, theme, toggleTheme } = useAppPreferences();
  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileSummary, setProfileSummary] = useState<{
    full_name: string;
    email: string;
    role: "client" | "admin";
    kyc_status: string;
    kyc_provisioned: boolean;
    country_code: string;
  } | null>(null);
  const configured = isSupabaseConfigured();

  const fetchProfileSummary = async () => {
    try {
      const authRes = await fetch("/api/auth", { cache: "no-store" });
      const authJson = await authRes.json();

      if (!authJson.authenticated || !authJson.user) {
        setUserEmail(null);
        setProfileSummary(null);
        return;
      }

      setUserEmail(authJson.user.email || null);

      const profRes = await fetch("/api/profile", { cache: "no-store" });
      const profJson = await profRes.json();

      if (profJson.success && profJson.data?.profile) {
        const p = profJson.data.profile;
        setProfileSummary({
          full_name: p.full_name || "Client",
          email: p.email || "",
          role: p.role === "admin" ? "admin" : "client",
          kyc_status: p.kyc_status || "unverified",
          kyc_provisioned: Boolean(
            p.kyc_provisioned || p.kyc_status !== "unverified"
          ),
          country_code: p.country_code || "CI",
        });
      } else {
        setProfileSummary({
          full_name: authJson.user.full_name || "Client",
          email: authJson.user.email || "",
          role: authJson.user.role === "admin" ? "admin" : "client",
          kyc_status: authJson.user.kyc_status || "unverified",
          kyc_provisioned: Boolean(authJson.user.kyc_provisioned),
          country_code: authJson.user.country_code || "CI",
        });
      }
    } catch {
      setUserEmail(null);
      setProfileSummary(null);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchProfileSummary();
    const onProfileUpdated = () => fetchProfileSummary();
    window.addEventListener("apacci-profile-updated", onProfileUpdated);

    if (!configured) {
      return () => {
        window.removeEventListener("apacci-profile-updated", onProfileUpdated);
      };
    }
    const supabase = createClient();
    supabase.auth.getUser().then((res: { data: { user: { email?: string } | null } }) => {
      if (res.data.user?.email) {
        setUserEmail(res.data.user.email);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user?: { email?: string } } | null) => {
        setUserEmail(session?.user?.email ?? null);
      }
    );
    return () => {
      window.removeEventListener("apacci-profile-updated", onProfileUpdated);
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signout" }),
      });
      if (configured) {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
    } catch {
      // ignore
    }
    setUserEmail(null);
    setProfileSummary(null);
    window.dispatchEvent(new CustomEvent("apacci-profile-updated"));
    router.push("/login");
    router.refresh();
  };

  const isAuthenticated = mounted && Boolean(userEmail && profileSummary);
  const isAdmin = isAuthenticated && profileSummary?.role === "admin";

  const navItems = isAuthenticated
    ? [
        { href: "/", label: t.nav.home, icon: Home },
        { href: "/send", label: t.nav.send, icon: Send },
        { href: "/recipients", label: t.nav.recipients, icon: Users },
        { href: "/transactions", label: t.nav.transactions, icon: History },
        {
          href: "/profile",
          label: locale === "fr" ? "Profil & KYC" : "Profile & KYC",
          icon: UserCheck,
        },
        ...(isAdmin
          ? [{ href: "/admin", label: t.nav.admin, icon: ShieldCheck }]
          : []),
      ]
    : [
        { href: "/", label: t.nav.home, icon: Home },
        {
          href: "/login",
          label:
            locale === "fr"
              ? "Connexion / Inscription"
              : "Sign In / Register",
          icon: LogIn,
        },
      ];

  const legalItems = [
    {
      href: "/legal/how-it-works",
      label: locale === "fr" ? "Comment ça marche" : "How it works",
      icon: HelpCircle,
    },
    {
      href: "/legal/terms",
      label: locale === "fr" ? "Conditions d'utilisation" : "Terms of Service",
      icon: FileText,
    },
    {
      href: "/legal/privacy",
      label: locale === "fr" ? "Confidentialité" : "Privacy Policy",
      icon: Lock,
    },
  ];

  const activeNavItem = navItems.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* ===================================================================== */}
      {/* DESKTOP LEFT SIDEBAR                                                  */}
      {/* ===================================================================== */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 transition-all duration-200 sticky top-0 h-screen z-40 ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800">
          {!sidebarCollapsed ? (
            <Logo />
          ) : (
            <Link
              href="/"
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3D91] text-[#F5B700] font-extrabold text-sm shadow-xs"
              title="Apacci Exchange"
            >
              AE
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Toggle sidebar"
            title={sidebarCollapsed ? "Déplier le menu" : "Réduire le menu"}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Primary Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {locale === "fr" ? "Navigation Principale" : "Main Menu"}
              </p>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                    active
                      ? "bg-[#0B3D91] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80"
                  } ${sidebarCollapsed ? "justify-center" : ""}`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      active ? "text-[#F5B700]" : "text-slate-500 dark:text-slate-400"
                    }`}
                  />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {/* Secondary Legal & Info Links */}
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {!sidebarCollapsed && (
              <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {locale === "fr" ? "Informations & Légal" : "Legal & Info"}
              </p>
            )}
            {legalItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? "bg-slate-100 text-[#0B3D91] font-bold dark:bg-slate-800 dark:text-[#F5B700]"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60"
                  } ${sidebarCollapsed ? "justify-center" : ""}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sidebar Bottom User Profile Card */}
        {mounted && (
          <div className="border-t border-slate-200/80 p-3 dark:border-slate-800">
            {profileSummary ? (
              <Link
                href="/profile"
                className={`flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 transition ${
                  sidebarCollapsed ? "justify-center" : ""
                }`}
                title={`${profileSummary.full_name} (${profileSummary.country_code})`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B3D91] text-xs font-extrabold text-[#F5B700]">
                  {profileSummary.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                      {profileSummary.full_name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold text-slate-500">
                        {profileSummary.country_code}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[9px] font-extrabold uppercase ${
                          profileSummary.role === "admin"
                            ? "bg-[#0B3D91] text-[#F5B700]"
                            : profileSummary.kyc_status === "verified"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : profileSummary.kyc_status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {profileSummary.role === "admin"
                          ? "ADMIN"
                          : `KYC: ${profileSummary.kyc_status}`}
                      </span>
                    </div>
                  </div>
                )}
              </Link>
            ) : (
              <Link
                href="/login"
                className={`flex items-center gap-2.5 rounded-2xl border border-amber-300 bg-amber-50/80 p-2.5 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 transition ${
                  sidebarCollapsed ? "justify-center" : ""
                }`}
                title="Connexion requise pour accéder au tableau de bord et envoyer de l'argent"
              >
                <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-[#F5B700]" />
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-extrabold">
                      {locale === "fr" ? "Accès Verrouillé" : "Locked Access"}
                    </p>
                    <p className="text-[10px] opacity-80 leading-tight">
                      {locale === "fr"
                        ? "Connectez-vous pour transiger & voir le dashboard"
                        : "Sign in to transact & view dashboard"}
                    </p>
                  </div>
                )}
              </Link>
            )}
          </div>
        )}
      </aside>

      {/* ===================================================================== */}
      {/* MOBILE SLIDE-OVER SIDEBAR DRAWER                                      */}
      {/* ===================================================================== */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            className="w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full flex flex-col justify-between p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <Logo />
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                        active
                          ? "bg-[#0B3D91] text-white"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="space-y-1 border-t border-slate-200 dark:border-slate-800 pt-3">
                {legalItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {mounted && profileSummary && (
              <Link
                href="/profile"
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B3D91] text-xs font-extrabold text-[#F5B700]">
                  {profileSummary.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold">
                    {profileSummary.full_name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {profileSummary.country_code} • KYC:{" "}
                    {profileSummary.kyc_status.toUpperCase()}
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* RIGHT MAIN COLUMN (SPACIOUS TOP NAVBAR + CONTENT + FOOTER)            */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Spacious Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
            {/* Left: Mobile Drawer Trigger + Active Section Title */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="inline-flex md:hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="md:hidden">
                <Logo />
              </div>

              <div className="hidden md:flex items-center gap-3">
                <h2 className="text-base font-extrabold text-[#0B3D91] dark:text-white">
                  {activeNavItem?.label || "Apacci Exchange"}
                </h2>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {locale === "fr"
                    ? "Transferts internationaux Mobile Money & Cartes Virtuelles"
                    : "International Mobile Money & Virtual Card Transfers"}
                </span>
              </div>
            </div>

            {/* Right: Quick Send CTA, Language, Theme, KYC Pill & Auth */}
            <div className="flex items-center gap-2.5">
              {pathname !== "/send" && (
                <Link
                  href="/send"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#008751] px-3.5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-[#006b40] transition"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{t.nav.send}</span>
                </Link>
              )}

              <button
                type="button"
                onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Toggle language"
              >
                <Globe className="h-3.5 w-3.5 text-[#0B3D91] dark:text-[#F5B700]" />
                {locale.toUpperCase()}
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Toggle dark mode"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-[#F5B700]" />
                ) : (
                  <Moon className="h-4 w-4 text-[#0B3D91]" />
                )}
              </button>

              {mounted && profileSummary && (
                <Link
                  href="/profile"
                  className={`hidden lg:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                    profileSummary.role === "admin"
                      ? "bg-[#0B3D91] text-[#F5B700]"
                      : profileSummary.kyc_status === "verified"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                      : profileSummary.kyc_status === "pending"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                  }`}
                >
                  {profileSummary.role === "admin" ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {profileSummary.full_name.split(" ")[0]} ({profileSummary.country_code}) •{" "}
                    {profileSummary.role === "admin"
                      ? "SUPER ADMIN"
                      : `KYC: ${profileSummary.kyc_status.toUpperCase()}`}
                  </span>
                </Link>
              )}

              {mounted && userEmail ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5 text-rose-500" />
                    <span className="hidden sm:inline">{t.nav.logout}</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B3D91] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0B3D91]/90 transition"
                >
                  <LogIn className="h-3.5 w-3.5 text-[#F5B700]" />
                  <span>{t.nav.login}</span>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Global KYC Provisioning Notice Banner if User Has Not Provisioned KYC */}
        {mounted &&
          profileSummary &&
          !profileSummary.kyc_provisioned &&
          pathname !== "/profile" && (
            <div className="bg-amber-400/95 text-slate-950 border-b border-amber-500">
              <div className="mx-auto max-w-6xl px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    {locale === "fr"
                      ? `Action requise (${profileSummary.full_name}) : Veuillez compléter votre provisionnement KYC (photos Recto/Verso + Selfie) avant d'effectuer un transfert.`
                      : `Action required (${profileSummary.full_name}): Please complete your KYC provisioning (ID front/back + Selfie) before sending money.`}
                  </span>
                </div>
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#0B3D91] px-3 py-1 text-[11px] font-extrabold text-white shrink-0 hover:bg-[#0B3D91]/90"
                >
                  <span>
                    {locale === "fr" ? "Provisionner mon KYC →" : "Complete KYC →"}
                  </span>
                </Link>
              </div>
            </div>
          )}

        {/* Main Content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-6 pb-24 md:pb-12">
          {children}
        </main>

        {/* Footer with Legal Links & Non-Bank Disclaimer */}
        <footer className="border-t border-slate-200 bg-white py-6 pb-24 md:pb-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#0B3D91] dark:text-white">
                  Apacci Exchange
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Send money across Africa & worldwide, fast and safely.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                <Link
                  href="/legal/how-it-works"
                  className="hover:text-[#0B3D91] dark:hover:text-[#F5B700]"
                >
                  {locale === "fr"
                    ? "Comment fonctionne Apacci Exchange"
                    : "How Apacci Exchange works"}
                </Link>
                <Link
                  href="/legal/terms"
                  className="hover:text-[#0B3D91] dark:hover:text-[#F5B700]"
                >
                  {locale === "fr" ? "Conditions d'utilisation" : "Terms of Service"}
                </Link>
                <Link
                  href="/legal/privacy"
                  className="hover:text-[#0B3D91] dark:hover:text-[#F5B700]"
                >
                  {locale === "fr"
                    ? "Politique de confidentialité"
                    : "Privacy Policy"}
                </Link>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
              {t.legalNotice}
            </p>
          </div>
        </footer>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around border-t border-slate-200 bg-white/95 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-1 text-[11px] font-medium rounded-lg ${
                  active
                    ? "text-[#0B3D91] dark:text-[#F5B700] font-bold"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

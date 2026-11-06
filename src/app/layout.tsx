import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppPreferencesProvider } from "@/components/layout/AppPreferencesProvider";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: {
    default: "Apacci Exchange — Send money across Africa, fast and safely.",
    template: "%s | Apacci Exchange",
  },
  description:
    "Apacci Exchange — Send money across Africa, fast and safely. Transferts d'argent Mobile Money et carte via SasPay.",
  applicationName: "Apacci Exchange",
  appleWebApp: {
    capable: true,
    title: "Apacci Exchange",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B3D91",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <AppPreferencesProvider>
          <AppShell>{children}</AppShell>
        </AppPreferencesProvider>
      </body>
    </html>
  );
}


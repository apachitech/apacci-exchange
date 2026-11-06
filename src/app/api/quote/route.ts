import { NextResponse } from "next/server";
import {
  getDynamicCorridors,
  computeCrossExchangeRate,
} from "@/lib/corridors";
import { calculateQuote, findMatchingTier, type FeeChargeMode } from "@/lib/money";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { quoteRequestSchema } from "@/lib/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit({
    key: `quote:${ip}`,
    limit: 40,
    windowMs: 60_000,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "rate_limited",
          message: "Trop de demandes de simulation. Veuillez patienter quelques secondes.",
        },
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "invalid_json", message: "Corps JSON invalide." },
      },
      { status: 400 }
    );
  }

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message || "Paramètres de simulation invalides.",
        },
      },
      { status: 400 }
    );
  }

  const {
    sendAmount,
    senderCountry,
    destinationCountry,
    destinationNetwork,
  } = parsed.data;

  const corridors = await getDynamicCorridors();
  const sender =
    corridors.senders.find((c) => c.isoCode === senderCountry) ||
    corridors.senderCountry;
  const dest = corridors.destinations.find(
    (c) => c.isoCode === destinationCountry
  );

  if (!dest || !dest.isDestinationAvailable) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "corridor_unavailable",
          message:
            dest?.statusNote ||
            `Le corridor vers ${destinationCountry} n'est pas encore actif sur le compte SasPay.`,
        },
      },
      { status: 422 }
    );
  }

  const net = dest.networks.find(
    (n) => n.code === destinationNetwork && n.payoutAvailable
  );

  if (!net) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "invalid_method",
          message: "Ce réseau mobile money n'est pas disponible pour la réception.",
        },
      },
      { status: 422 }
    );
  }

  // Load fee mode and platform fee settings from Supabase `settings` if configured
  let feeChargeMode: FeeChargeMode = "ADD_ON";
  let platformFeePercent = "1.000";
  let platformFeeFixed = "0.00";

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: settingsRow } = await supabase
        .from("settings")
        .select("fee_charge_mode, platform_fee_percent, platform_fee_fixed_xof")
        .eq("id", 1)
        .maybeSingle();

      if (settingsRow) {
        feeChargeMode = settingsRow.fee_charge_mode as FeeChargeMode;
        platformFeePercent = String(settingsRow.platform_fee_percent);
        platformFeeFixed = String(settingsRow.platform_fee_fixed_xof);
      }
    } catch {
      // Fallback to defaults if DB not reachable in preview mode
    }
  }

  const senderDefaultPayinTier = findMatchingTier(
    sendAmount,
    sender.networks[0]?.payinTiers || []
  );
  const destPayoutTier = findMatchingTier(sendAmount, net.payoutTiers || []);
  const crossExchangeRate = computeCrossExchangeRate(sender, dest);

  try {
    const quote = calculateQuote({
      sendAmount,
      senderCurrency: sender.currency,
      destinationCurrency: dest.currency,
      exchangeRate: crossExchangeRate,
      feeChargeMode,
      payinTier: senderDefaultPayinTier,
      payoutTier: destPayoutTier,
      platformFeePercent,
      platformFeeFixed,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...quote,
        senderCountry: sender.isoCode,
        senderCountryName: sender.name,
        destinationCountry: dest.isoCode,
        destinationCountryName: dest.name,
        destinationNetwork: net.code,
        destinationNetworkName: net.name,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "quote_error",
          message: err instanceof Error ? err.message : "Erreur de calcul du devis.",
        },
      },
      { status: 422 }
    );
  }
}


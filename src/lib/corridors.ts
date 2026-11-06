import "server-only";
import {
  getCountries,
  getMyRates,
  getExchangeRates,
  getNetworks,
  isSasPayConfigured,
  type SasPayMyRateItem,
} from "./saspay";
import type { PricingTier } from "./money";
import { formatMoney, formatRate, parseScaled } from "./money";
import { logger } from "./logger";

export interface CorridorNetwork {
  code: string;
  name: string;
  payinAvailable: boolean;
  payoutAvailable: boolean;
  otpRequired: boolean;
  otpInstructions: string;
  payinTiers: PricingTier[];
  payoutTiers: PricingTier[];
}

export interface CorridorCountry {
  isoCode: string;
  name: string;
  currency: string;
  dialCode: string;
  flag: string;
  hasMobileMoneyFacility: boolean;
  isSenderAvailable: boolean;
  isDestinationAvailable: boolean;
  virtualCardSupported: boolean;
  exchangeRateFromXof: string; // 8-decimal string ("1.00000000")
  networks: CorridorNetwork[];
  statusNote?: string;
}

export interface CorridorsData {
  senderCountry: CorridorCountry;
  senders: CorridorCountry[];
  destinations: CorridorCountry[];
  liveApiConfirmed: boolean;
  updatedAt: string;
}

/**
 * Computes exact cross-currency rate `1 senderCurrency = ? destinationCurrency`
 * using 10^8-scaled BigInt arithmetic (never floats).
 */
export function computeCrossExchangeRate(
  sender: CorridorCountry,
  destination: CorridorCountry
): string {
  if (sender.currency.toUpperCase() === destination.currency.toUpperCase()) {
    return "1.00000000";
  }
  const scale = 100_000_000n;
  const senderRateScaled = parseScaled(sender.exchangeRateFromXof || "1.00000000");
  const destRateScaled = parseScaled(destination.exchangeRateFromXof || "1.00000000");
  if (senderRateScaled <= 0n) return "1.00000000";
  const crossScaled = (destRateScaled * scale + senderRateScaled / 2n) / senderRateScaled;
  return formatRate(crossScaled > 0n ? crossScaled : 1n);
}

/**
 * Converts an amount in `sender.currency` into its XOF equivalent for KYC limit comparison.
 */
export function convertAmountToXof(
  amountInSenderCurrency: string,
  sender: CorridorCountry
): string {
  if (sender.currency.toUpperCase() === "XOF") {
    return amountInSenderCurrency;
  }
  const scale = 100_000_000n;
  const amountScaled = parseScaled(amountInSenderCurrency);
  const senderRateScaled = parseScaled(sender.exchangeRateFromXof || "1.00000000");
  if (senderRateScaled <= 0n) return amountInSenderCurrency;
  const xofScaled = (amountScaled * scale + senderRateScaled / 2n) / senderRateScaled;
  return formatMoney(xofScaled);
}

const DEFAULT_PAYIN_TIER_XOF: PricingTier = {
  min_amount: "0.00",
  max_amount: "5000000.00",
  currency: "XOF",
  percent: "2.000",
  fixed: "0.00",
  floor_amount: "50.00",
  cap_amount: null,
  fee_charge_mode: "ADD_ON",
};

const DEFAULT_PAYOUT_TIER: PricingTier = {
  min_amount: "0.00",
  max_amount: "5000000.00",
  currency: "XOF",
  percent: "1.500",
  fixed: "0.00",
  floor_amount: null,
  cap_amount: null,
  fee_charge_mode: "DEDUCTED",
};

interface StaticCountrySeed {
  isoCode: string;
  defaultNameFr: string;
  currency: string;
  dialCode: string;
  flag: string;
  defaultRateFromXof: string;
  networks: Array<{
    code: string;
    name: string;
    active: boolean;
    otpRequired?: boolean;
    otpInstructions?: string;
  }>;
}

/**
 * Full official SasPay reference catalog from https://docs.saspay.me/api-reference/reference/formats
 * plus Gabon (GA) and South Africa (ZA).
 */
const SASPAY_COUNTRY_CATALOG: StaticCountrySeed[] = [
  {
    isoCode: "CI",
    defaultNameFr: "Côte d'Ivoire",
    currency: "XOF",
    dialCode: "+225",
    flag: "🇨🇮",
    defaultRateFromXof: "1.00000000",
    networks: [
      { code: "wave_ci", name: "Wave CI", active: true },
      {
        code: "orange_ci",
        name: "Orange Money CI",
        active: true,
        otpRequired: true,
        otpInstructions:
          "Sur votre téléphone, composez #144*82# puis choisissez l'option 2 pour obtenir votre code de paiement.",
      },
      { code: "mtn_ci", name: "MTN MoMo CI", active: true },
      { code: "moov_ci", name: "Moov Money CI", active: true },
    ],
  },
  {
    isoCode: "ML",
    defaultNameFr: "Mali",
    currency: "XOF",
    dialCode: "+223",
    flag: "🇲🇱",
    defaultRateFromXof: "1.00000000",
    networks: [
      { code: "orange_ml", name: "Orange Money Mali", active: true },
      { code: "moov_ml", name: "Moov Money Mali", active: true },
      { code: "mobi_cash_ml", name: "Mobi Cash Mali", active: true },
    ],
  },
  {
    isoCode: "SN",
    defaultNameFr: "Sénégal",
    currency: "XOF",
    dialCode: "+221",
    flag: "🇸🇳",
    defaultRateFromXof: "1.00000000",
    networks: [
      { code: "wave_sn", name: "Wave Senegal", active: true },
      { code: "orange_sn", name: "Orange Money Senegal", active: true },
      { code: "freemoney_sn", name: "Free Money Senegal", active: true },
      { code: "wizall_sn", name: "Wizall Senegal", active: true },
      { code: "e_money_sn", name: "E-Money Senegal", active: false },
    ],
  },
  {
    isoCode: "BJ",
    defaultNameFr: "Bénin",
    currency: "XOF",
    dialCode: "+229",
    flag: "🇧🇯",
    defaultRateFromXof: "1.00000000",
    networks: [
      { code: "mtn_bj", name: "MTN MoMo Benin", active: true },
      { code: "moov_bj", name: "Moov Money Benin", active: true },
      { code: "celtiis_bj", name: "Celtiis Cash Bénin", active: true },
    ],
  },
  {
    isoCode: "BF",
    defaultNameFr: "Burkina Faso",
    currency: "XOF",
    dialCode: "+226",
    flag: "🇧🇫",
    defaultRateFromXof: "1.00000000",
    networks: [
      { code: "orange_bf", name: "Orange Burkina Faso", active: true },
      { code: "moov_bf", name: "Moov Burkina Faso", active: true },
    ],
  },
  {
    isoCode: "TG",
    defaultNameFr: "Togo",
    currency: "XOF",
    dialCode: "+228",
    flag: "🇹🇬",
    defaultRateFromXof: "1.00000000",
    networks: [
      { code: "togocel", name: "Togocel Money", active: true },
      { code: "moov_tg", name: "Moov Money Togo", active: true },
    ],
  },
  {
    isoCode: "NE",
    defaultNameFr: "Niger",
    currency: "XOF",
    dialCode: "+227",
    flag: "🇳🇪",
    defaultRateFromXof: "1.00000000",
    networks: [{ code: "airtel_ne", name: "Airtel Niger", active: true }],
  },
  {
    isoCode: "CM",
    defaultNameFr: "Cameroun",
    currency: "XAF",
    dialCode: "+237",
    flag: "🇨🇲",
    defaultRateFromXof: "1.00000000",
    networks: [
      { code: "mtn_cm", name: "MTN MoMo Cameroon", active: true },
      { code: "orange_cm", name: "Orange Money Cameroon", active: true },
      { code: "eu_mobile_cm", name: "EU Mobile Money Cameroon", active: false },
    ],
  },
  {
    isoCode: "CD",
    defaultNameFr: "République Démocratique du Congo",
    currency: "CDF",
    dialCode: "+243",
    flag: "🇨🇩",
    defaultRateFromXof: "4.65000000",
    networks: [
      { code: "vodacom_cd", name: "Vodacom Congo (M-Pesa)", active: true },
      { code: "airtel_cd", name: "Airtel Congo", active: true },
      { code: "orange_cd", name: "Orange Congo", active: true },
    ],
  },
  {
    isoCode: "GH",
    defaultNameFr: "Ghana",
    currency: "GHS",
    dialCode: "+233",
    flag: "🇬🇭",
    defaultRateFromXof: "0.02550000",
    networks: [
      { code: "mtn_gh", name: "MTN MoMo Ghana", active: true },
      { code: "tigo_gh", name: "Airtel/Tigo Ghana", active: true },
      { code: "vodafone_gh", name: "Vodafone Ghana", active: true },
    ],
  },
  {
    isoCode: "GN",
    defaultNameFr: "Guinée",
    currency: "GNF",
    dialCode: "+224",
    flag: "🇬🇳",
    defaultRateFromXof: "14.20000000",
    networks: [
      { code: "mtn_gn", name: "MTN MoMo Guinea", active: true },
      { code: "orange_gn", name: "Orange Money Guinea", active: false },
    ],
  },
  {
    isoCode: "KE",
    defaultNameFr: "Kenya",
    currency: "KES",
    dialCode: "+254",
    flag: "🇰🇪",
    defaultRateFromXof: "0.21500000",
    networks: [{ code: "mpesa_ke", name: "M-Pesa Kenya", active: true }],
  },
  {
    isoCode: "MW",
    defaultNameFr: "Malawi",
    currency: "MWK",
    dialCode: "+265",
    flag: "🇲🇼",
    defaultRateFromXof: "2.88000000",
    networks: [
      { code: "airtel_mw", name: "Airtel Money Malawi", active: true },
      { code: "tnm_mw", name: "TNM Mpamba Malawi", active: true },
    ],
  },
  {
    isoCode: "NG",
    defaultNameFr: "Nigeria",
    currency: "NGN",
    dialCode: "+234",
    flag: "🇳🇬",
    defaultRateFromXof: "2.65000000",
    networks: [
      { code: "mtn_ng", name: "MTN Nigeria", active: true },
      { code: "airtel_ng", name: "Airtel Money Nigeria", active: true },
      { code: "allbanks_ng", name: "Virement bancaire Nigeria", active: true },
    ],
  },
  {
    isoCode: "RW",
    defaultNameFr: "Rwanda",
    currency: "RWF",
    dialCode: "+250",
    flag: "🇷🇼",
    defaultRateFromXof: "2.25000000",
    networks: [
      { code: "mtn_rw", name: "MTN MoMo Rwanda", active: true },
      { code: "airtel_rw", name: "Airtel Rwanda", active: true },
    ],
  },
  {
    isoCode: "TZ",
    defaultNameFr: "Tanzanie",
    currency: "TZS",
    dialCode: "+255",
    flag: "🇹🇿",
    defaultRateFromXof: "4.45000000",
    networks: [
      { code: "mpesa_tz", name: "Vodacom Tanzania", active: true },
      { code: "airtel_tz", name: "Airtel Tanzania", active: true },
      { code: "tigo_tz", name: "Tigo Tanzania", active: true },
      { code: "halopesa_tz", name: "Halopesa", active: true },
    ],
  },
  {
    isoCode: "UG",
    defaultNameFr: "Ouganda",
    currency: "UGX",
    dialCode: "+256",
    flag: "🇺🇬",
    defaultRateFromXof: "6.10000000",
    networks: [
      { code: "mtn_ug", name: "MTN MoMo Uganda", active: true },
      { code: "airtel_ug", name: "Airtel Uganda", active: true },
    ],
  },
  {
    isoCode: "ZM",
    defaultNameFr: "Zambie",
    currency: "ZMW",
    dialCode: "+260",
    flag: "🇿🇲",
    defaultRateFromXof: "0.04400000",
    networks: [
      { code: "mtn_zm", name: "MTN MoMo Zambia", active: true },
      { code: "airtel_zm", name: "Airtel Zambia", active: true },
      { code: "zamtel_zm", name: "Zamtel Kwacha", active: true },
    ],
  },
  {
    isoCode: "GA",
    defaultNameFr: "Gabon",
    currency: "XAF",
    dialCode: "+241",
    flag: "🇬🇦",
    defaultRateFromXof: "1.00000000",
    networks: [],
  },
  {
    isoCode: "ZA",
    defaultNameFr: "Afrique du Sud",
    currency: "ZAR",
    dialCode: "+27",
    flag: "🇿🇦",
    defaultRateFromXof: "0.03000000",
    networks: [],
  },
  {
    isoCode: "MA",
    defaultNameFr: "Maroc",
    currency: "MAD",
    dialCode: "+212",
    flag: "🇲🇦",
    defaultRateFromXof: "0.01650000",
    networks: [],
  },
  {
    isoCode: "EG",
    defaultNameFr: "Égypte",
    currency: "EGP",
    dialCode: "+20",
    flag: "🇪🇬",
    defaultRateFromXof: "0.08100000",
    networks: [],
  },
  {
    isoCode: "FR",
    defaultNameFr: "France / Zone Euro",
    currency: "EUR",
    dialCode: "+33",
    flag: "🇫🇷",
    defaultRateFromXof: "0.00152449",
    networks: [],
  },
  {
    isoCode: "US",
    defaultNameFr: "États-Unis",
    currency: "USD",
    dialCode: "+1",
    flag: "🇺🇸",
    defaultRateFromXof: "0.00165000",
    networks: [],
  },
  {
    isoCode: "GB",
    defaultNameFr: "Royaume-Uni",
    currency: "GBP",
    dialCode: "+44",
    flag: "🇬🇧",
    defaultRateFromXof: "0.00130000",
    networks: [],
  },
  {
    isoCode: "CA",
    defaultNameFr: "Canada",
    currency: "CAD",
    dialCode: "+1",
    flag: "🇨🇦",
    defaultRateFromXof: "0.00228000",
    networks: [],
  },
];

const COUNTRY_META_MAP = new Map<string, StaticCountrySeed>(
  SASPAY_COUNTRY_CATALOG.map((c) => [c.isoCode, c])
);

function buildCatalogCorridors(
  publicCountriesMap: Map<string, { is_active?: boolean; default_currency: string; name: string }>
): CorridorsData {
  const allCountries: CorridorCountry[] = SASPAY_COUNTRY_CATALOG.map((seed) => {
    const pub = publicCountriesMap.get(seed.isoCode);
    const isCountryActiveInApi = pub ? pub.is_active !== false : true;
    const activeNetworks: CorridorNetwork[] = seed.networks
      .filter((n) => n.active)
      .map((n) => ({
        code: n.code,
        name: n.name,
        payinAvailable: true,
        payoutAvailable: true,
        otpRequired: Boolean(n.otpRequired),
        otpInstructions: n.otpInstructions || "",
        payinTiers: [{ ...DEFAULT_PAYIN_TIER_XOF, currency: seed.currency }],
        payoutTiers: [{ ...DEFAULT_PAYOUT_TIER, currency: seed.currency }],
      }));

    const hasMobileMoney = isCountryActiveInApi && activeNetworks.length > 0;

    return {
      isoCode: seed.isoCode,
      name: pub?.name || seed.defaultNameFr,
      currency: pub?.default_currency || seed.currency,
      dialCode: seed.dialCode,
      flag: seed.flag,
      hasMobileMoneyFacility: hasMobileMoney,
      // Senders can send from any country: via Mobile Money if available, or via Virtual Card (Visa / Mastercard)
      isSenderAvailable: true,
      isDestinationAvailable: hasMobileMoney,
      virtualCardSupported: true,
      exchangeRateFromXof: seed.defaultRateFromXof,
      networks: activeNetworks,
      statusNote: !hasMobileMoney
        ? `Aucun service Mobile Money direct disponible pour ${seed.defaultNameFr} (${seed.currency}) — l'envoi depuis ce pays d'origine s'effectue par Carte Virtuelle (Visa ou Mastercard).`
        : undefined,
    };
  });

  const senderCountry = allCountries.find((c) => c.isoCode === "CI")!;

  return {
    senderCountry,
    senders: allCountries,
    destinations: allCountries,
    liveApiConfirmed: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Dynamically loads all supported countries, networks, and rates from the SasPay API.
 * Only enables corridors and networks that the SasPay API confirms are active and available.
 */
export async function getDynamicCorridors(): Promise<CorridorsData> {
  const publicCountriesMap = new Map<
    string,
    { is_active?: boolean; default_currency: string; name: string }
  >();

  try {
    const publicCountries = await getCountries();
    for (const c of publicCountries) {
      publicCountriesMap.set(c.iso_code.toUpperCase(), {
        is_active: c.is_active,
        default_currency: c.default_currency,
        name: c.name,
      });
    }
  } catch (err) {
    logger.warn("Could not fetch public /countries/ from SasPay, using seed metadata", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (!isSasPayConfigured()) {
    return buildCatalogCorridors(publicCountriesMap);
  }

  try {
    const [myRates, fxPaginated, networksPaginated] = await Promise.all([
      getMyRates(),
      getExchangeRates(1, 100),
      getNetworks(1, 100),
    ]);

    const activeNetworkCodes = new Set(
      (networksPaginated.results || [])
        .filter((n) => n.is_active)
        .map((n) => n.code)
    );

    const fxMap = new Map<string, string>();
    for (const fx of fxPaginated.results || []) {
      fxMap.set(`${fx.from_currency.toUpperCase()}->${fx.to_currency.toUpperCase()}`, fx.rate);
    }

    // Group `my-rates` items by country_code
    const byCountry = new Map<string, SasPayMyRateItem[]>();
    for (const item of myRates) {
      const code = item.country_code.toUpperCase();
      const list = byCountry.get(code) ?? [];
      list.push(item);
      byCountry.set(code, list);
    }

    const targetCountryCodes = new Set<string>([
      ...SASPAY_COUNTRY_CATALOG.map((c) => c.isoCode),
      ...Array.from(byCountry.keys()),
    ]);

    const resolvedCountries: CorridorCountry[] = [];

    for (const isoCode of targetCountryCodes) {
      const countryInfo = publicCountriesMap.get(isoCode);
      const rateItems = byCountry.get(isoCode) ?? [];
      const seed = COUNTRY_META_MAP.get(isoCode);

      const currency =
        rateItems[0]?.currency ||
        countryInfo?.default_currency ||
        seed?.currency ||
        "XOF";

      const networks: CorridorNetwork[] = rateItems
        .filter((r) => activeNetworkCodes.size === 0 || activeNetworkCodes.has(r.network_code))
        .map((r) => ({
          code: r.network_code,
          name: r.network_name,
          payinAvailable: Boolean(r.payin?.available),
          payoutAvailable: Boolean(r.payout?.available),
          otpRequired: Boolean(r.payin?.otp_required),
          otpInstructions: r.payin?.otp_instructions || "",
          payinTiers: r.payin?.tiers || [],
          payoutTiers: r.payout?.tiers || [],
        }));

      const isCountryActive = countryInfo ? countryInfo.is_active !== false : true;
      const hasPayin = isCountryActive && networks.some((n) => n.payinAvailable);
      const hasPayout = isCountryActive && networks.some((n) => n.payoutAvailable);

      let exchangeRateFromXof = "1.00000000";
      if (currency !== "XOF") {
        exchangeRateFromXof =
          fxMap.get(`XOF->${currency}`) || seed?.defaultRateFromXof || "0.00000000";
      }

      const canConvert = currency === "XOF" || exchangeRateFromXof !== "0.00000000";

      resolvedCountries.push({
        isoCode,
        name: rateItems[0]?.country_name || countryInfo?.name || seed?.defaultNameFr || isoCode,
        currency,
        dialCode: seed?.dialCode || "",
        flag: seed?.flag || "🌍",
        hasMobileMoneyFacility: hasPayin,
        isSenderAvailable: true,
        isDestinationAvailable: hasPayout && canConvert,
        virtualCardSupported: true,
        exchangeRateFromXof: canConvert ? exchangeRateFromXof : "1.00000000",
        networks,
        statusNote:
          !hasPayout || !canConvert
            ? `Aucun réseau Mobile Money direct actif pour ${isoCode} (${currency}) — envoi depuis ce pays d'origine disponible par Carte Virtuelle (Visa ou Mastercard).`
            : undefined,
      });
    }

    const senderCountry =
      resolvedCountries.find((c) => c.isoCode === "CI") ??
      buildCatalogCorridors(publicCountriesMap).senderCountry;

    return {
      senderCountry,
      senders: resolvedCountries,
      destinations: resolvedCountries,
      liveApiConfirmed: true,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn("Failed to load live SasPay rates/networks; falling back to catalog corridors", {
      error: err instanceof Error ? err.message : String(err),
    });
    return buildCatalogCorridors(publicCountriesMap);
  }
}

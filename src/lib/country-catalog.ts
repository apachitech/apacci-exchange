export interface CountryMeta {
  code: string;
  name: string;
  currency: string;
  flag: string;
  dialCode: string;
  region?: string;
  defaultRateFromXof?: string;
  defaultPayoutRails?: string;
}

export interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
  flag?: string;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: "XOF", name: "Franc CFA UEMOA", symbol: "CFA", flag: "🇨🇮" },
  { code: "XAF", name: "Franc CFA CEMAC", symbol: "FCFA", flag: "🇨🇲" },
  { code: "EUR", name: "Euro (Zone Euro)", symbol: "€", flag: "🇪🇺" },
  { code: "USD", name: "Dollar Américain", symbol: "$", flag: "🇺🇸" },
  { code: "GBP", name: "Livre Sterling", symbol: "£", flag: "🇬🇧" },
  { code: "CAD", name: "Dollar Canadien", symbol: "CA$", flag: "🇨🇦" },
  { code: "CDF", name: "Franc Congolais", symbol: "FC", flag: "🇨🇩" },
  { code: "GHS", name: "Cedi Ghanéen", symbol: "GH₵", flag: "🇬🇭" },
  { code: "GNF", name: "Franc Guinéen", symbol: "FG", flag: "🇬🇳" },
  { code: "KES", name: "Shilling Kényan", symbol: "KSh", flag: "🇰🇪" },
  { code: "MWK", name: "Kwacha Malawite", symbol: "MK", flag: "🇲🇼" },
  { code: "NGN", name: "Naira Nigérian", symbol: "₦", flag: "🇳🇬" },
  { code: "RWF", name: "Franc Rwandais", symbol: "FRw", flag: "🇷🇼" },
  { code: "TZS", name: "Shilling Tanzanien", symbol: "TSh", flag: "🇹🇿" },
  { code: "UGX", name: "Shilling Ougandais", symbol: "USh", flag: "🇺🇬" },
  { code: "ZMW", name: "Kwacha Zambien", symbol: "ZK", flag: "🇿🇲" },
  { code: "ZAR", name: "Rand Sud-Africain", symbol: "R", flag: "🇿🇦" },
  { code: "MAD", name: "Dirham Marocain", symbol: "DH", flag: "🇲🇦" },
  { code: "EGP", name: "Livre Égyptienne", symbol: "E£", flag: "🇪🇬" },
];

export const SASPAY_AFRICAN_COUNTRIES: CountryMeta[] = [
  {
    code: "CI",
    name: "Côte d'Ivoire",
    currency: "XOF",
    flag: "🇨🇮",
    dialCode: "+225",
    region: "UEMOA",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "Wave CI, Orange Money CI (#144*82#), MTN MoMo CI, Moov Money CI",
  },
  {
    code: "SN",
    name: "Sénégal",
    currency: "XOF",
    flag: "🇸🇳",
    dialCode: "+221",
    region: "UEMOA",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "Wave Sénégal, Orange Money SN, Free Money SN, Wizall SN",
  },
  {
    code: "ML",
    name: "Mali",
    currency: "XOF",
    flag: "🇲🇱",
    dialCode: "+223",
    region: "UEMOA",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "Orange Money Mali, Moov Money Mali, Malitel / MobiCash",
  },
  {
    code: "BF",
    name: "Burkina Faso",
    currency: "XOF",
    flag: "🇧🇫",
    dialCode: "+226",
    region: "UEMOA",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "Orange Money BF, Moov Africa BF",
  },
  {
    code: "BJ",
    name: "Bénin",
    currency: "XOF",
    flag: "🇧🇯",
    dialCode: "+229",
    region: "UEMOA",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "MTN MoMo Bénin, Moov Money Bénin, Celtiis Cash",
  },
  {
    code: "TG",
    name: "Togo",
    currency: "XOF",
    flag: "🇹🇬",
    dialCode: "+228",
    region: "UEMOA",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "T-Money (Togocel), Moov Money Togo",
  },
  {
    code: "NE",
    name: "Niger",
    currency: "XOF",
    flag: "🇳🇪",
    dialCode: "+227",
    region: "UEMOA",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "Airtel Money Niger, Moov Money Niger",
  },
  {
    code: "CM",
    name: "Cameroun",
    currency: "XAF",
    flag: "🇨🇲",
    dialCode: "+237",
    region: "CEMAC",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "MTN MoMo Cameroun, Orange Money Cameroun",
  },
  {
    code: "GA",
    name: "Gabon",
    currency: "XAF",
    flag: "🇬🇦",
    dialCode: "+241",
    region: "CEMAC",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "Airtel Money Gabon, Moov Money Gabon",
  },
  {
    code: "CG",
    name: "Congo (Brazzaville)",
    currency: "XAF",
    flag: "🇨🇬",
    dialCode: "+242",
    region: "CEMAC",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "MTN MoMo Congo, Airtel Money Congo",
  },
  {
    code: "TD",
    name: "Tchad",
    currency: "XAF",
    flag: "🇹🇩",
    dialCode: "+235",
    region: "CEMAC",
    defaultRateFromXof: "1.00000000",
    defaultPayoutRails: "Airtel Money Tchad, Moov Tchad",
  },
  {
    code: "CD",
    name: "RD Congo",
    currency: "CDF",
    flag: "🇨🇩",
    dialCode: "+243",
    region: "Afrique Centrale",
    defaultRateFromXof: "4.65000000",
    defaultPayoutRails: "Vodacom M-Pesa, Airtel Money RDC, Orange Money RDC",
  },
  {
    code: "GH",
    name: "Ghana",
    currency: "GHS",
    flag: "🇬🇭",
    dialCode: "+233",
    region: "Afrique de l'Ouest",
    defaultRateFromXof: "0.02550000",
    defaultPayoutRails: "MTN MoMo Ghana, Vodafone Cash / Telecel, AirtelTigo",
  },
  {
    code: "GN",
    name: "Guinée",
    currency: "GNF",
    flag: "🇬🇳",
    dialCode: "+224",
    region: "Afrique de l'Ouest",
    defaultRateFromXof: "14.20000000",
    defaultPayoutRails: "Orange Money Guinée, MTN Mobile Money Guinée",
  },
  {
    code: "KE",
    name: "Kenya",
    currency: "KES",
    flag: "🇰🇪",
    dialCode: "+254",
    region: "Afrique de l'Est",
    defaultRateFromXof: "0.21500000",
    defaultPayoutRails: "Safaricom M-Pesa Kenya, Airtel Money Kenya",
  },
  {
    code: "MW",
    name: "Malawi",
    currency: "MWK",
    flag: "🇲🇼",
    dialCode: "+265",
    region: "Afrique de l'Est",
    defaultRateFromXof: "2.88000000",
    defaultPayoutRails: "Airtel Money Malawi, TNM Mpamba",
  },
  {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    flag: "🇳🇬",
    dialCode: "+234",
    region: "Afrique de l'Ouest",
    defaultRateFromXof: "2.65000000",
    defaultPayoutRails: "MTN MoMo PSB, Airtel SmartCash, Virement Bancaire NIBSS",
  },
  {
    code: "RW",
    name: "Rwanda",
    currency: "RWF",
    flag: "🇷🇼",
    dialCode: "+250",
    region: "Afrique de l'Est",
    defaultRateFromXof: "2.25000000",
    defaultPayoutRails: "MTN MoMo Rwanda, Airtel Money Rwanda",
  },
  {
    code: "TZ",
    name: "Tanzanie",
    currency: "TZS",
    flag: "🇹🇿",
    dialCode: "+255",
    region: "Afrique de l'Est",
    defaultRateFromXof: "4.45000000",
    defaultPayoutRails: "Vodacom M-Pesa Tanzania, Tigo Pesa, Airtel Money, Halopesa",
  },
  {
    code: "UG",
    name: "Ouganda",
    currency: "UGX",
    flag: "🇺🇬",
    dialCode: "+256",
    region: "Afrique de l'Est",
    defaultRateFromXof: "6.10000000",
    defaultPayoutRails: "MTN Mobile Money Uganda, Airtel Money Uganda",
  },
  {
    code: "ZM",
    name: "Zambie",
    currency: "ZMW",
    flag: "🇿🇲",
    dialCode: "+260",
    region: "Afrique Australe",
    defaultRateFromXof: "0.04400000",
    defaultPayoutRails: "MTN MoMo Zambia, Airtel Money Zambia, Zamtel",
  },
  {
    code: "ZA",
    name: "Afrique du Sud",
    currency: "ZAR",
    flag: "🇿🇦",
    dialCode: "+27",
    region: "Afrique Australe",
    defaultRateFromXof: "0.03000000",
    defaultPayoutRails: "Vodacom Virtual Card Payin / Bidvest Bank Card Payout",
  },
  {
    code: "MA",
    name: "Maroc",
    currency: "MAD",
    flag: "🇲🇦",
    dialCode: "+212",
    region: "Afrique du Nord",
    defaultRateFromXof: "0.01650000",
    defaultPayoutRails: "Inwi Money, Orange Money Maroc, Cash Plus",
  },
  {
    code: "EG",
    name: "Égypte",
    currency: "EGP",
    flag: "🇪🇬",
    dialCode: "+20",
    region: "Afrique du Nord",
    defaultRateFromXof: "0.08100000",
    defaultPayoutRails: "Vodafone Cash Égypte, InstaPay, Orange Money Égypte",
  },
  {
    code: "FR",
    name: "France / Zone Euro",
    currency: "EUR",
    flag: "🇫🇷",
    dialCode: "+33",
    region: "Europe (Émetteur)",
    defaultRateFromXof: "0.00152449",
    defaultPayoutRails: "Carte bancaire CB/Visa/Mastercard, Virement SEPA",
  },
  {
    code: "US",
    name: "États-Unis",
    currency: "USD",
    flag: "🇺🇸",
    dialCode: "+1",
    region: "Amérique du Nord (Émetteur)",
    defaultRateFromXof: "0.00165000",
    defaultPayoutRails: "Cartes Visa/Mastercard, Apple Pay",
  },
  {
    code: "GB",
    name: "Royaume-Uni",
    currency: "GBP",
    flag: "🇬🇧",
    dialCode: "+44",
    region: "Europe (Émetteur)",
    defaultRateFromXof: "0.00130000",
    defaultPayoutRails: "Cartes bancaires UK, Faster Payments",
  },
  {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    flag: "🇨🇦",
    dialCode: "+1",
    region: "Amérique du Nord (Émetteur)",
    defaultRateFromXof: "0.00228000",
    defaultPayoutRails: "Interac e-Transfer, Carte de crédit/débit",
  },
];

export function getCountryByCode(code?: string): CountryMeta {
  if (!code) {
    return {
      code: "CI",
      name: "Côte d'Ivoire",
      currency: "XOF",
      flag: "🇨🇮",
      dialCode: "+225",
      defaultRateFromXof: "1.00000000",
    };
  }
  const upper = code.trim().toUpperCase();
  const found = SASPAY_AFRICAN_COUNTRIES.find((c) => c.code === upper);
  if (found) return found;
  return {
    code: upper,
    name: upper,
    currency: "XOF",
    flag: "🌍",
    dialCode: "",
    defaultRateFromXof: "1.00000000",
  };
}

export function getCurrencyByCode(code?: string): CurrencyMeta {
  if (!code) {
    return { code: "XOF", name: "Franc CFA UEMOA", symbol: "CFA", flag: "🇨🇮" };
  }
  const upper = code.trim().toUpperCase();
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === upper);
  if (found) return found;
  return { code: upper, name: upper, symbol: upper };
}

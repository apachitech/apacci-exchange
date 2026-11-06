export interface CountryMeta {
  code: string;
  name: string;
  currency: string;
  flag: string;
  dialCode: string;
  region?: string;
}

export const SASPAY_AFRICAN_COUNTRIES: CountryMeta[] = [
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", flag: "🇨🇮", dialCode: "+225", region: "UEMOA" },
  { code: "SN", name: "Sénégal", currency: "XOF", flag: "🇸🇳", dialCode: "+221", region: "UEMOA" },
  { code: "ML", name: "Mali", currency: "XOF", flag: "🇲🇱", dialCode: "+223", region: "UEMOA" },
  { code: "BF", name: "Burkina Faso", currency: "XOF", flag: "🇧🇫", dialCode: "+226", region: "UEMOA" },
  { code: "BJ", name: "Bénin", currency: "XOF", flag: "🇧🇯", dialCode: "+229", region: "UEMOA" },
  { code: "TG", name: "Togo", currency: "XOF", flag: "🇹🇬", dialCode: "+228", region: "UEMOA" },
  { code: "NE", name: "Niger", currency: "XOF", flag: "🇳🇪", dialCode: "+227", region: "UEMOA" },
  { code: "CM", name: "Cameroun", currency: "XAF", flag: "🇨🇲", dialCode: "+237", region: "CEMAC" },
  { code: "GA", name: "Gabon", currency: "XAF", flag: "🇬🇦", dialCode: "+241", region: "CEMAC" },
  { code: "CG", name: "Congo (Brazzaville)", currency: "XAF", flag: "🇨🇬", dialCode: "+242", region: "CEMAC" },
  { code: "TD", name: "Tchad", currency: "XAF", flag: "🇹🇩", dialCode: "+235", region: "CEMAC" },
  { code: "CD", name: "RD Congo", currency: "CDF", flag: "🇨🇩", dialCode: "+243", region: "Afrique Centrale" },
  { code: "GH", name: "Ghana", currency: "GHS", flag: "🇬🇭", dialCode: "+233", region: "Afrique de l'Ouest" },
  { code: "GN", name: "Guinée", currency: "GNF", flag: "🇬🇳", dialCode: "+224", region: "Afrique de l'Ouest" },
  { code: "KE", name: "Kenya", currency: "KES", flag: "🇰🇪", dialCode: "+254", region: "Afrique de l'Est" },
  { code: "MW", name: "Malawi", currency: "MWK", flag: "🇲🇼", dialCode: "+265", region: "Afrique de l'Est" },
  { code: "NG", name: "Nigeria", currency: "NGN", flag: "🇳🇬", dialCode: "+234", region: "Afrique de l'Ouest" },
  { code: "RW", name: "Rwanda", currency: "RWF", flag: "🇷🇼", dialCode: "+250", region: "Afrique de l'Est" },
  { code: "TZ", name: "Tanzanie", currency: "TZS", flag: "🇹🇿", dialCode: "+255", region: "Afrique de l'Est" },
  { code: "UG", name: "Ouganda", currency: "UGX", flag: "🇺🇬", dialCode: "+256", region: "Afrique de l'Est" },
  { code: "ZM", name: "Zambie", currency: "ZMW", flag: "🇿🇲", dialCode: "+260", region: "Afrique Australe" },
  { code: "ZA", name: "Afrique du Sud", currency: "ZAR", flag: "🇿🇦", dialCode: "+27", region: "Afrique Australe" },
  { code: "MA", name: "Maroc", currency: "MAD", flag: "🇲🇦", dialCode: "+212", region: "Afrique du Nord" },
  { code: "EG", name: "Égypte", currency: "EGP", flag: "🇪🇬", dialCode: "+20", region: "Afrique du Nord" },
];

export function getCountryByCode(code?: string): CountryMeta {
  if (!code) {
    return {
      code: "CI",
      name: "Côte d'Ivoire",
      currency: "XOF",
      flag: "🇨🇮",
      dialCode: "+225",
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
  };
}

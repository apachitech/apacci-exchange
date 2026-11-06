/**
 * Pure decimal string arithmetic for financial calculations.
 * Money is ALWAYS represented and returned as decimal strings ("2500.00"), NEVER floats.
 * Internally uses BigInt scaled by 10^8 (SCALE = 100_000_000n) for exact intermediate math,
 * and rounds to 2 decimal places ("0.00") using standard half-up rounding for currency amounts.
 */

export type FeeChargeMode = "ADD_ON" | "DEDUCTED";

export interface PricingTier {
  min_amount: string;
  max_amount: string | null;
  currency: string;
  percent: string;
  fixed: string;
  floor_amount: string | null;
  cap_amount: string | null;
  fee_charge_mode: FeeChargeMode;
}

export interface QuoteInput {
  sendAmount: string; // e.g. "25000.00"
  senderCurrency: string; // e.g. "XOF"
  destinationCurrency: string; // e.g. "XOF", "XAF", "TZS", "ZAR"
  exchangeRate: string; // e.g. "1.00000000" or "0.00984000"
  feeChargeMode: FeeChargeMode;
  payinTier?: PricingTier | null;
  payoutTier?: PricingTier | null;
  platformFeePercent?: string; // e.g. "1.000"
  platformFeeFixed?: string; // e.g. "0.00"
}

export interface QuoteResult {
  sendAmount: string; // Requested send amount ("25000.00")
  feeAmount: string; // Total fee in senderCurrency ("625.00")
  totalCharged: string; // Amount debited from sender ("25625.00" in ADD_ON, "25000.00" in DEDUCTED)
  netSendAmount: string; // Amount converted to destination ("25000.00" in ADD_ON, "24375.00" in DEDUCTED)
  exchangeRate: string; // 8-decimal string ("1.00000000")
  payoutAmount: string; // Exact amount received by recipient in destinationCurrency ("25000.00")
  senderCurrency: string;
  destinationCurrency: string;
  feeChargeMode: FeeChargeMode;
}

const SCALE_DECIMALS = 8;
const SCALE = 100_000_000n; // 10^8
const CENTS_FACTOR = 1_000_000n; // 10^6 (converts 10^8 internal units to 10^2 cents)

const DECIMAL_REGEX = /^\d+(\.\d{1,8})?$/;

export function isValidDecimalString(value: string): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return DECIMAL_REGEX.test(trimmed);
}

/**
 * Parses a positive decimal string into a BigInt scaled by 10^8.
 * Throws if invalid or negative.
 */
export function parseScaled(value: string): bigint {
  const trimmed = value.trim();
  if (!DECIMAL_REGEX.test(trimmed)) {
    throw new Error(`Invalid decimal string: "${value}"`);
  }
  const [intPart, fracPart = ""] = trimmed.split(".");
  const paddedFrac = fracPart.padEnd(SCALE_DECIMALS, "0").slice(0, SCALE_DECIMALS);
  return BigInt(intPart) * SCALE + BigInt(paddedFrac);
}

/**
 * Formats a 10^8-scaled BigInt as a 2-decimal currency string ("2500.00") using half-up rounding.
 */
export function formatMoney(scaled: bigint): string {
  if (scaled < 0n) {
    throw new Error("Negative money amount is not allowed");
  }
  // Round to nearest cent (10^6 in 10^8 scale)
  const cents = (scaled + CENTS_FACTOR / 2n) / CENTS_FACTOR;
  const whole = cents / 100n;
  const rem = cents % 100n;
  return `${whole.toString()}.${rem.toString().padStart(2, "0")}`;
}

/**
 * Formats a 10^8-scaled BigInt as an 8-decimal exchange rate string ("1.00000000").
 */
export function formatRate(scaled: bigint): string {
  if (scaled <= 0n) {
    throw new Error("Exchange rate must be positive");
  }
  const whole = scaled / SCALE;
  const rem = scaled % SCALE;
  return `${whole.toString()}.${rem.toString().padStart(SCALE_DECIMALS, "0")}`;
}

/**
 * Normalizes a user-supplied amount string to "0.00" format and validates it is > 0.
 */
export function normalizeMoneyString(value: string): string {
  const scaled = parseScaled(value);
  if (scaled <= 0n) {
    throw new Error("Amount must be greater than zero");
  }
  return formatMoney(scaled);
}

/**
 * Compares two decimal strings: returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function compareMoney(a: string, b: string): -1 | 0 | 1 {
  const sa = parseScaled(a);
  const sb = parseScaled(b);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

/**
 * Adds two decimal money strings and returns a "0.00" string.
 */
export function addMoney(a: string, b: string): string {
  return formatMoney(parseScaled(a) + parseScaled(b));
}

/**
 * Evaluates a single SasPay pricing tier fee in 10^8 scaled units.
 */
export function computeTierFeeScaled(amountScaled: bigint, tier: PricingTier): bigint {
  const percentScaled = parseScaled(tier.percent || "0.00"); // e.g. 2.500 -> 2.5 * 10^8
  const fixedScaled = parseScaled(tier.fixed || "0.00");

  // (amountScaled * percentScaled) / (100 * SCALE)
  const divisor = 100n * SCALE;
  const rawPercentFee = (amountScaled * percentScaled + divisor / 2n) / divisor;
  let fee = rawPercentFee + fixedScaled;

  if (tier.floor_amount) {
    const floorScaled = parseScaled(tier.floor_amount);
    if (fee < floorScaled) fee = floorScaled;
  }
  if (tier.cap_amount) {
    const capScaled = parseScaled(tier.cap_amount);
    if (fee > capScaled) fee = capScaled;
  }

  // Round tier fee to nearest cent
  const feeCents = (fee + CENTS_FACTOR / 2n) / CENTS_FACTOR;
  return feeCents * CENTS_FACTOR;
}

/**
 * Selects the matching tier from a list of SasPay pricing tiers for the given amount.
 */
export function findMatchingTier(amount: string, tiers: PricingTier[]): PricingTier | null {
  if (!tiers || tiers.length === 0) return null;
  const amountScaled = parseScaled(amount);
  for (const tier of tiers) {
    const minScaled = parseScaled(tier.min_amount || "0.00");
    const maxScaled = tier.max_amount ? parseScaled(tier.max_amount) : null;
    if (amountScaled >= minScaled && (maxScaled === null || amountScaled <= maxScaled)) {
      return tier;
    }
  }
  return tiers[0] ?? null;
}

/**
 * Computes the complete server-side quote (sendAmount, feeAmount, totalCharged, netSendAmount, payoutAmount).
 * Uses only BigInt-scaled integer math — zero floating point operations.
 */
export function calculateQuote(input: QuoteInput): QuoteResult {
  const sendScaled = parseScaled(input.sendAmount);
  if (sendScaled <= 0n) {
    throw new Error("Send amount must be greater than zero");
  }

  const rateScaled = parseScaled(input.exchangeRate);
  if (rateScaled <= 0n) {
    throw new Error("Exchange rate must be greater than zero");
  }

  // 1. Payin fee from SasPay tier (if provided)
  let totalFeeScaled = 0n;
  if (input.payinTier) {
    totalFeeScaled += computeTierFeeScaled(sendScaled, input.payinTier);
  }

  // 2. Payout fee from SasPay tier (if provided, expressed in sender currency terms)
  if (input.payoutTier) {
    // Percent applies proportionally; fixed/floor/cap are converted only if currencies match
    const payoutPercentScaled = parseScaled(input.payoutTier.percent || "0.00");
    const divisor = 100n * SCALE;
    const payoutPercentFee = (sendScaled * payoutPercentScaled + divisor / 2n) / divisor;
    const payoutPercentCents = ((payoutPercentFee + CENTS_FACTOR / 2n) / CENTS_FACTOR) * CENTS_FACTOR;
    totalFeeScaled += payoutPercentCents;
  }

  // 3. Platform fee (from `settings` table)
  if (input.platformFeePercent) {
    const platPctScaled = parseScaled(input.platformFeePercent);
    const divisor = 100n * SCALE;
    const platPctFee = (sendScaled * platPctScaled + divisor / 2n) / divisor;
    const platPctCents = ((platPctFee + CENTS_FACTOR / 2n) / CENTS_FACTOR) * CENTS_FACTOR;
    totalFeeScaled += platPctCents;
  }
  if (input.platformFeeFixed) {
    const platFixedScaled = parseScaled(input.platformFeeFixed);
    totalFeeScaled += platFixedScaled;
  }

  // Round total fee to exact cents
  const feeCents = (totalFeeScaled + CENTS_FACTOR / 2n) / CENTS_FACTOR;
  const roundedFeeScaled = feeCents * CENTS_FACTOR;

  let totalChargedScaled: bigint;
  let netSendScaled: bigint;

  if (input.feeChargeMode === "ADD_ON") {
    totalChargedScaled = sendScaled + roundedFeeScaled;
    netSendScaled = sendScaled;
  } else {
    // DEDUCTED mode: sender pays exact sendAmount; fee is deducted from netSendAmount
    totalChargedScaled = sendScaled;
    netSendScaled = sendScaled - roundedFeeScaled;
    if (netSendScaled <= 0n) {
      throw new Error("Send amount is too small to cover transaction fees in DEDUCTED mode");
    }
  }

  // Convert netSendScaled to destination currency using rateScaled
  const payoutScaled = (netSendScaled * rateScaled + SCALE / 2n) / SCALE;
  if (payoutScaled <= 0n) {
    throw new Error("Converted payout amount must be greater than zero");
  }

  return {
    sendAmount: formatMoney(sendScaled),
    feeAmount: formatMoney(roundedFeeScaled),
    totalCharged: formatMoney(totalChargedScaled),
    netSendAmount: formatMoney(netSendScaled),
    exchangeRate: formatRate(rateScaled),
    payoutAmount: formatMoney(payoutScaled),
    senderCurrency: input.senderCurrency.toUpperCase(),
    destinationCurrency: input.destinationCurrency.toUpperCase(),
    feeChargeMode: input.feeChargeMode,
  };
}


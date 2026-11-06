import { z } from "zod";
import { isValidDecimalString } from "./money";

export const decimalAmountSchema = z
  .string()
  .trim()
  .refine(isValidDecimalString, {
    message: "Montant invalide. Utilisez une chaîne décimale positive (ex: 10000.00).",
  });

export const isoCountrySchema = z
  .string()
  .trim()
  .length(2, "Le code pays doit comporter 2 lettres ISO (ex: CI, ML, GA, TZ, ZA).")
  .transform((v) => v.toUpperCase());

export const isoCurrencySchema = z
  .string()
  .trim()
  .length(3, "Le code devise doit comporter 3 lettres ISO (ex: XOF, XAF, TZS, ZAR).")
  .transform((v) => v.toUpperCase());

export const msisdnSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, {
    message: "Numéro de téléphone invalide (8 à 15 chiffres, format local ou +indicatif).",
  });

export const quoteRequestSchema = z.object({
  sendAmount: decimalAmountSchema,
  senderCountry: isoCountrySchema.default("CI"),
  destinationCountry: isoCountrySchema,
  destinationNetwork: z.string().trim().min(2).max(64),
});

export const createRecipientSchema = z.object({
  fullName: z.string().trim().min(2, "Le nom complet est requis.").max(120),
  countryCode: isoCountrySchema,
  currency: isoCurrencySchema,
  networkCode: z.string().trim().min(2).max(64),
  networkName: z.string().trim().min(2).max(120),
  msisdn: msisdnSchema,
});

export const createTransactionSchema = z.object({
  sendAmount: decimalAmountSchema,
  senderCountry: isoCountrySchema.default("CI"),
  destinationCountry: isoCountrySchema,
  destinationNetwork: z.string().trim().min(2).max(64),
  paymentMethod: z
    .enum(["checkout", "softpay", "virtual_card"])
    .default("checkout"),
  senderNetwork: z.string().trim().min(2).max(64).optional(),
  senderPhone: msisdnSchema.optional(),
  virtualCardProvider: z.string().trim().max(80).optional(),
  cardHolderName: z.string().trim().max(120).optional(),
  prepaymentOtp: z.string().trim().max(16).optional(),
  recipientId: z.string().uuid().optional(),
  newRecipient: createRecipientSchema.optional(),
  idempotencyKey: z.string().uuid("Idempotency-Key doit être un UUID valide."),
});

export const updateSettingsSchema = z.object({
  feeChargeMode: z.enum(["ADD_ON", "DEDUCTED"]),
  platformFeePercent: decimalAmountSchema,
  platformFeeFixedXof: decimalAmountSchema,
  unverifiedTxLimitXof: decimalAmountSchema,
  unverifiedMonthlyLimitXof: decimalAmountSchema,
  verifiedTxLimitXof: decimalAmountSchema,
  verifiedMonthlyLimitXof: decimalAmountSchema,
});

export const adminUpdateUserSchema = z.object({
  kycStatus: z.enum(["unverified", "pending", "verified", "rejected"]),
  customTxLimitXof: decimalAmountSchema.nullable().optional(),
  customMonthlyLimitXof: decimalAmountSchema.nullable().optional(),
});


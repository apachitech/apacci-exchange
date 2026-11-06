import "server-only";
import { logger } from "./logger";
import type { FeeChargeMode, PricingTier } from "./money";

/**
 * Official SasPay REST API v1 Server-Only Client
 * Base URL: https://api.saspay.me/api/v1
 * Source of truth: https://docs.saspay.me/api-reference/openapi.json
 *
 * Uses ONLY endpoints, fields, and error codes defined in the official SasPay documentation.
 */

const SASPAY_BASE_URL = (process.env.SASPAY_BASE_URL || "https://api.saspay.me/api/v1").replace(/\/$/, "");

export type SasPayTransactionStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface SasPayApiErrorPayload {
  message?: string;
  code?: string;
  [field: string]: string | string[] | undefined;
}

export class SasPayError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly rawError: SasPayApiErrorPayload | null;

  constructor(message: string, statusCode: number, errorCode: string, rawError: SasPayApiErrorPayload | null = null) {
    super(message);
    this.name = "SasPayError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.rawError = rawError;
  }
}

/**
 * Maps official SasPay error codes and HTTP status codes to clear user-facing messages in FR & EN.
 */
export function mapSasPayErrorToUserMessage(errorCode: string, locale: "fr" | "en" = "fr"): string {
  const dictionary: Record<string, { fr: string; en: string }> = {
    insufficient_balance: {
      fr: "Liquidité temporairement insuffisante sur ce corridor. Notre équipe a été alertée.",
      en: "Temporary liquidity shortage on this corridor. Our team has been notified.",
    },
    ip_not_whitelisted: {
      fr: "L'adresse IP du serveur n'est pas encore autorisée pour les retraits SasPay.",
      en: "Server IP address is not yet whitelisted for SasPay payouts.",
    },
    api_key_scope_forbidden: {
      fr: "La clé API configurée n'a pas les permissions requises (PAYIN/PAYOUT).",
      en: "The configured API key lacks the required scope (PAYIN/PAYOUT).",
    },
    payout_not_enabled: {
      fr: "Les retraits ne sont pas encore activés sur ce compte marchand SasPay.",
      en: "Payouts are not yet enabled on this SasPay merchant account.",
    },
    currency_country_mismatch: {
      fr: "La devise ne correspond pas au pays du bénéficiaire.",
      en: "The currency does not match the recipient's country.",
    },
    invalid_country: {
      fr: "Le pays sélectionné n'est pas valide ou n'est pas pris en charge.",
      en: "The selected country is invalid or unsupported.",
    },
    invalid_method: {
      fr: "Le réseau mobile money sélectionné est inconnu ou temporairement inactif.",
      en: "The selected mobile money network is unknown or temporarily inactive.",
    },
    missing_method: {
      fr: "Veuillez choisir un réseau mobile money.",
      en: "Please select a mobile money network.",
    },
    invalid_customer: {
      fr: "Les informations du client ou le numéro de téléphone sont invalides.",
      en: "Customer details or phone number are invalid.",
    },
    no_exchange_rate: {
      fr: "Aucun taux de change n'est disponible pour cette paire de devises.",
      en: "No exchange rate is available for this currency pair.",
    },
    no_route_available: {
      fr: "Aucune route de paiement n'est disponible pour cet opérateur actuellement.",
      en: "No payment route is currently available for this network.",
    },
    prepayment_otp_missing: {
      fr: "Ce réseau exige un code OTP pré-paiement (composez le code USSD indiqué sur votre téléphone).",
      en: "This network requires a pre-payment OTP code (dial the USSD code shown on your phone).",
    },
    otp_confirmation_failed: {
      fr: "Échec de la confirmation du code OTP. Vérifiez le code ou réessayez.",
      en: "OTP confirmation failed. Please check the code and try again.",
    },
    otp_not_applicable: {
      fr: "Ce moyen de paiement ne nécessite pas de confirmation par code OTP.",
      en: "This payment method does not require OTP confirmation.",
    },
    wallet_frozen: {
      fr: "Le portefeuille de ce pays est temporairement gelé pour les sorties.",
      en: "The wallet for this country is temporarily frozen for outbound transfers.",
    },
    merchant_suspended: {
      fr: "Le compte marchand est temporairement suspendu.",
      en: "The merchant account is temporarily suspended.",
    },
    not_found: {
      fr: "Transaction ou session introuvable.",
      en: "Transaction or session not found.",
    },
    not_retryable: {
      fr: "Cette transaction est déjà terminée et ne peut plus être relancée.",
      en: "This transaction is already in a terminal state and cannot be retried.",
    },
    rate_limited: {
      fr: "Trop de requêtes. Veuillez patienter quelques secondes avant de réessayer.",
      en: "Too many requests. Please wait a few seconds before trying again.",
    },
    validation_error: {
      fr: "Certains champs du formulaire sont invalides. Veuillez vérifier votre saisie.",
      en: "Some form fields are invalid. Please check your input.",
    },
  };

  return (
    dictionary[errorCode]?.[locale] ??
    (locale === "fr"
      ? "Une erreur est survenue lors de la communication avec le service de paiement."
      : "An error occurred while communicating with the payment provider.")
  );
}

// ============================================================================
// Official SasPay Response Types (from OpenAPI 3.1.0 spec)
// ============================================================================

export interface SasPayEnvelope<T> {
  success: boolean;
  data?: T;
  error?: SasPayApiErrorPayload;
  code: number;
}

export interface SasPayPaginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SasPayCountry {
  id: string;
  iso_code: string;
  name: string;
  default_currency: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SasPayNetwork {
  id: string;
  country: string; // UUID of country
  code: string; // e.g. "mtn_ci", "orange_ml", "mpesa_tz"
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SasPayNetworkDirectionRate {
  available: boolean;
  is_custom: boolean;
  otp_required: boolean;
  otp_instructions: string;
  tiers: PricingTier[];
}

export interface SasPayMyRateItem {
  country_code: string;
  country_name: string;
  currency: string;
  network_code: string;
  network_name: string;
  payin: SasPayNetworkDirectionRate;
  payout: SasPayNetworkDirectionRate;
}

export interface SasPayExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: string; // 8-decimal string e.g. "0.00984000"
  auto_update: boolean;
  created_at: string;
  updated_at: string;
}

export interface SasPayMerchantBalance {
  id: string;
  merchant: string;
  country: string; // 2-letter ISO code e.g. "CI", "ML"
  currency: string;
  available_amount: string;
  pending_amount: string;
  is_frozen: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCheckoutSessionRequest {
  amount: string; // decimal string "5000.00"
  currency: string; // 3-letter ISO "XOF"
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  description?: string;
  country?: string; // 2-letter ISO "CI"
  return_url?: string;
  metadata?: Record<string, unknown>;
  fee_charge_mode?: FeeChargeMode | null;
  expires_at?: string;
}

export interface SasPayCheckoutSession {
  id: string;
  merchant?: string;
  slug: string;
  checkout_url: string;
  amount?: string;
  currency?: string;
  description?: string;
  country?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  return_url?: string;
  metadata?: Record<string, unknown>;
  fee_charge_mode?: string;
  status: string; // "PENDING" | "PAID" | "EXPIRED" | "CANCELLED"
  expires_at?: string | null;
  transaction?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SasPayCheckoutSessionStatus {
  id: string;
  slug: string;
  status: string; // e.g. "PAID" | "PENDING"
  transaction_id: string | null;
  transaction_status: SasPayTransactionStatus | null;
  transaction_reference: string | null;
}

export interface CreateSoftpayRequest {
  amount: string;
  currency: string;
  country: string;
  network: string;
  description?: string;
  customer: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  return_url?: string;
  metadata?: Record<string, unknown>;
  fee_charge_mode?: FeeChargeMode | null;
  preferred_gateway?: string;
  otp?: string;
}

export interface SasPaySoftpayResponse {
  message: string;
  id: string;
  status: SasPayTransactionStatus;
  checkout_url: string;
  instructions?: string;
  bank_transfer?: {
    bank_name: string;
    account_number: string;
    account_name: string;
    amount_expected: string;
    currency: string;
    expires_at: string;
    reference: string;
  };
}

export interface SasPayVerifiedTransaction {
  message?: string;
  id: string;
  reference: string;
  merchant: string;
  customer: string;
  country: string;
  network: string;
  transaction_type: "PAIEMENT" | "RETRAIT" | "RECHARGE" | "TRANSFERT";
  flow_direction: "INBOUND" | "OUTBOUND";
  description: string;
  requested_amount: string;
  fee_charge_mode: FeeChargeMode;
  client_fee: string;
  gateway_fee?: string;
  platform_fee?: string;
  debited_amount: string;
  net_amount: string;
  currency: string;
  status: SasPayTransactionStatus;
  external_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface InitializePayoutRequest {
  amount: string; // decimal string "10000.00"
  currency: string; // must match destination country's currency
  country: string; // 2-letter ISO
  customer: {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
  method: string; // network code e.g. "orange_ml", "mpesa_tz"
  recipient: {
    msisdn: string;
  };
  description?: string;
  metadata?: Record<string, unknown>;
  fee_charge_mode?: FeeChargeMode | null;
}

export interface SasPayPayoutInitResponse {
  message: string;
  id: string;
  status?: SasPayTransactionStatus;
}

export interface ConfirmPaymentOtpRequest {
  otp: string;
}

export interface ConfirmPaymentOtpResponse {
  message: string;
  id: string;
  status: SasPayTransactionStatus;
}

export interface RetryPaymentRequest {
  methods?: string[];
  customer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
  preferred_gateway?: string;
}

export interface RetryPaymentResponse {
  message: string;
  id: string;
  checkout_url: string;
}

export interface CreateWalletTransferRequest {
  from_country: string;
  to_country: string;
  from_amount: string;
}

export interface SasPayWalletTransferResponse {
  id: string;
  reference: string;
  from_country: string;
  to_country: string;
  from_amount: string;
  from_currency: string;
  to_amount: string;
  to_currency: string;
  exchange_rate: string;
  fee_amount: string;
  fee_percent_applied: string;
  status: "PENDING" | "COMPLETED" | "REJECTED";
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Internal HTTP Helper
// ============================================================================

function getSecretKey(): string {
  const key = process.env.SASPAY_SECRET_KEY;
  if (!key || key.trim().length === 0) {
    throw new SasPayError(
      "SASPAY_SECRET_KEY is not configured on the server",
      500,
      "missing_api_key"
    );
  }
  return key.trim();
}

export function isSasPayConfigured(): boolean {
  const key = process.env.SASPAY_SECRET_KEY;
  return Boolean(
    key &&
      key.trim().length > 0 &&
      !key.includes("replace_with_your")
  );
}

async function saspayRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    idempotencyKey?: string;
    requireAuth?: boolean;
    revalidateSeconds?: number;
  } = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    idempotencyKey,
    requireAuth = true,
    revalidateSeconds,
  } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (requireAuth) {
    headers["Authorization"] = `Bearer ${getSecretKey()}`;
  }

  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const url = `${SASPAY_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const fetchOptions: RequestInit & { next?: { revalidate?: number } } = {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  if (method === "GET" && revalidateSeconds !== undefined) {
    fetchOptions.next = { revalidate: revalidateSeconds };
  } else {
    fetchOptions.cache = "no-store";
  }

  const response = await fetch(url, fetchOptions);

  if (response.status === 429) {
    logger.warn("SasPay rate limit reached (429)", { path, method });
    throw new SasPayError("Too Many Requests", 429, "rate_limited");
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new SasPayError(
      `Invalid JSON response from SasPay (${response.status})`,
      response.status,
      "invalid_response"
    );
  }

  // Handle raw JSON array fallback if /countries/ ever returns unwrapped array
  if (Array.isArray(parsed)) {
    return parsed as unknown as T;
  }

  const envelope = parsed as SasPayEnvelope<T>;

  if (!response.ok || envelope.success === false) {
    const errObj = envelope.error ?? {};
    const code =
      typeof errObj.code === "string"
        ? errObj.code
        : response.status === 400 || response.status === 422
        ? "validation_error"
        : `http_${response.status}`;

    const message =
      typeof errObj.message === "string"
        ? errObj.message
        : `SasPay API error (${response.status})`;

    logger.warn("SasPay API call returned error", {
      path,
      method,
      statusCode: response.status,
      errorCode: code,
    });

    throw new SasPayError(message, response.status, code, errObj);
  }

  return (envelope.data !== undefined ? envelope.data : (parsed as T));
}

// ============================================================================
// Public SasPay Client Functions
// ============================================================================

/**
 * GET /countries/ — Public list of countries
 */
export async function getCountries(): Promise<SasPayCountry[]> {
  return saspayRequest<SasPayCountry[]>("/countries/", {
    method: "GET",
    requireAuth: false,
    revalidateSeconds: 300,
  });
}

/**
 * GET /networks/ — Authenticated paginated list of mobile money networks
 */
export async function getNetworks(page = 1, pageSize = 100): Promise<SasPayPaginated<SasPayNetwork>> {
  return saspayRequest<SasPayPaginated<SasPayNetwork>>(
    `/networks/?page=${page}&page_size=${pageSize}`,
    {
      method: "GET",
      requireAuth: true,
      revalidateSeconds: 300,
    }
  );
}

/**
 * GET /pricing/my-rates/ — Resolved payin/payout availability, OTP rules, and fee tiers per network
 */
export async function getMyRates(): Promise<SasPayMyRateItem[]> {
  return saspayRequest<SasPayMyRateItem[]>("/pricing/my-rates/", {
    method: "GET",
    requireAuth: true,
    revalidateSeconds: 120,
  });
}

/**
 * GET /exchange-rates/ — Paginated currency conversion rates
 */
export async function getExchangeRates(page = 1, pageSize = 100): Promise<SasPayPaginated<SasPayExchangeRate>> {
  return saspayRequest<SasPayPaginated<SasPayExchangeRate>>(
    `/exchange-rates/?page=${page}&page_size=${pageSize}`,
    {
      method: "GET",
      requireAuth: true,
      revalidateSeconds: 120,
    }
  );
}

/**
 * GET /merchant-balances/ — Paginated per-country merchant balances
 */
export async function getBalances(page = 1, pageSize = 100): Promise<SasPayPaginated<SasPayMerchantBalance>> {
  return saspayRequest<SasPayPaginated<SasPayMerchantBalance>>(
    `/merchant-balances/?page=${page}&page_size=${pageSize}`,
    {
      method: "GET",
      requireAuth: true,
    }
  );
}

/**
 * POST /checkout-sessions/ — Create a hosted checkout session
 * Sends Idempotency-Key header on every payment request.
 */
export async function createCheckoutSession(
  payload: CreateCheckoutSessionRequest,
  idempotencyKey: string
): Promise<SasPayCheckoutSession> {
  logger.info("Creating SasPay checkout session", {
    amount: payload.amount,
    currency: payload.currency,
    country: payload.country,
    idempotencyKey,
  });
  return saspayRequest<SasPayCheckoutSession>("/checkout-sessions/", {
    method: "POST",
    body: payload,
    idempotencyKey,
    requireAuth: true,
  });
}

/**
 * GET /checkout-sessions/{id}/status/ — Check hosted checkout session status (re-verifies with gateway)
 */
export async function getCheckoutSessionStatus(
  sessionId: string
): Promise<SasPayCheckoutSessionStatus> {
  return saspayRequest<SasPayCheckoutSessionStatus>(
    `/checkout-sessions/${encodeURIComponent(sessionId)}/status/`,
    {
      method: "GET",
      requireAuth: true,
    }
  );
}

/**
 * POST /payments/softpay/ — Direct push / redirect payment with Idempotency-Key
 */
export async function createSoftpayPayment(
  payload: CreateSoftpayRequest,
  idempotencyKey: string
): Promise<SasPaySoftpayResponse> {
  logger.info("Creating SasPay softpay payment", {
    amount: payload.amount,
    currency: payload.currency,
    country: payload.country,
    network: payload.network,
    idempotencyKey,
  });
  return saspayRequest<SasPaySoftpayResponse>("/payments/softpay/", {
    method: "POST",
    body: payload,
    idempotencyKey,
    requireAuth: true,
  });
}

/**
 * GET /payments/{payment_id}/verify/ — Verify real gateway payment status
 */
export async function verifyPayment(
  paymentId: string
): Promise<SasPayVerifiedTransaction> {
  return saspayRequest<SasPayVerifiedTransaction>(
    `/payments/${encodeURIComponent(paymentId)}/verify/`,
    {
      method: "GET",
      requireAuth: true,
    }
  );
}

/**
 * POST /payouts/initialize/ — Initialize outbound Mobile Money payout to recipient
 * Requires Idempotency-Key and whitelisted server IP.
 */
export async function createPayout(
  payload: InitializePayoutRequest,
  idempotencyKey: string
): Promise<SasPayPayoutInitResponse> {
  logger.info("Initializing SasPay payout", {
    amount: payload.amount,
    currency: payload.currency,
    country: payload.country,
    method: payload.method,
    recipient: payload.recipient,
    idempotencyKey,
  });
  return saspayRequest<SasPayPayoutInitResponse>("/payouts/initialize/", {
    method: "POST",
    body: payload,
    idempotencyKey,
    requireAuth: true,
  });
}

/**
 * GET /payouts/{payout_id}/verify/ — Verify real gateway status of an outbound payout
 */
export async function verifyPayout(
  payoutId: string
): Promise<SasPayVerifiedTransaction> {
  return saspayRequest<SasPayVerifiedTransaction>(
    `/payouts/${encodeURIComponent(payoutId)}/verify/`,
    {
      method: "GET",
      requireAuth: true,
    }
  );
}

/**
 * POST /payments/{payment_id}/confirm-otp/ — Confirm post-push OTP for networks that require it
 */
export async function confirmPaymentOtp(
  paymentId: string,
  payload: ConfirmPaymentOtpRequest
): Promise<ConfirmPaymentOtpResponse> {
  return saspayRequest<ConfirmPaymentOtpResponse>(
    `/payments/${encodeURIComponent(paymentId)}/confirm-otp/`,
    {
      method: "POST",
      body: payload,
      requireAuth: true,
    }
  );
}

/**
 * POST /payments/{payment_id}/retry/ — Retry a failed inbound payment on the same transaction ID
 * Sends Idempotency-Key header as required by AGENTS.md.
 */
export async function retryPayment(
  paymentId: string,
  payload: RetryPaymentRequest,
  idempotencyKey: string
): Promise<RetryPaymentResponse> {
  logger.info("Retrying failed SasPay inbound payment", {
    paymentId,
    methods: payload.methods,
    idempotencyKey,
  });
  return saspayRequest<RetryPaymentResponse>(
    `/payments/${encodeURIComponent(paymentId)}/retry/`,
    {
      method: "POST",
      body: payload,
      idempotencyKey,
      requireAuth: true,
    }
  );
}

/**
 * POST /wallet-transfers/ — Initiate an inter-wallet transfer between two country wallets of the same merchant
 * Sends Idempotency-Key header as required by AGENTS.md.
 */
export async function createWalletTransfer(
  payload: CreateWalletTransferRequest,
  idempotencyKey: string
): Promise<SasPayWalletTransferResponse> {
  logger.info("Initiating SasPay inter-wallet transfer", {
    from_country: payload.from_country,
    to_country: payload.to_country,
    from_amount: payload.from_amount,
    idempotencyKey,
  });
  return saspayRequest<SasPayWalletTransferResponse>("/wallet-transfers/", {
    method: "POST",
    body: payload,
    idempotencyKey,
    requireAuth: true,
  });
}


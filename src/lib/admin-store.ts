import "server-only";
import type { TransactionStatus } from "./state-machine";

export interface SavedVirtualCardRecord {
  id: string;
  provider: string;
  brand: "VISA" | "MASTERCARD";
  cardholder_name: string;
  last4: string;
  expiry: string;
  origin_country: string;
  currency: string;
  is_default: boolean;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  country_code: string;
  role: "client" | "admin";
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  kyc_provisioned?: boolean;
  date_of_birth?: string;
  nationality?: string;
  address_line?: string;
  city?: string;
  occupation?: string;
  source_of_funds?: string;
  kyc_document_type?: "national_id" | "passport" | "driver_license" | "residence_permit";
  kyc_document_number?: string;
  kyc_issuing_country?: string;
  kyc_document_expiry?: string;
  kyc_id_recto_url?: string | null;
  kyc_id_verso_url?: string | null;
  kyc_selfie_url?: string | null;
  kyc_selfie_verified?: boolean;
  kyc_submitted_at?: string | null;
  kyc_rejection_reason?: string | null;
  default_sender_country?: string;
  default_payment_method?: "virtual_card" | "softpay" | "checkout";
  default_virtual_card_provider?: string;
  default_virtual_card_last4?: string;
  saved_virtual_cards?: SavedVirtualCardRecord[];
  preferred_locale?: "fr" | "en";
  notify_email?: boolean;
  notify_sms?: boolean;
  notify_push_pwa?: boolean;
  two_factor_enabled?: boolean;
  transaction_pin_enabled?: boolean;
  custom_tx_limit_xof: string | null;
  custom_monthly_limit_xof: string | null;
  created_at: string;
}

export interface AdminRecipientRecord {
  id: string;
  user_id: string;
  full_name: string;
  country_code: string;
  currency: string;
  network_code: string;
  network_name: string;
  msisdn: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminTxRecord {
  id: string;
  reference: string;
  user_id: string;
  recipient_id: string;
  sender_country: string;
  sender_currency: string;
  destination_country: string;
  destination_currency: string;
  destination_network: string;
  destination_network_name: string;
  recipient_name: string;
  recipient_msisdn: string;
  send_amount: string;
  fee_amount: string;
  total_charged: string;
  net_send_amount: string;
  exchange_rate: string;
  payout_amount: string;
  fee_charge_mode: "ADD_ON" | "DEDUCTED";
  status: TransactionStatus;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface AdminWalletRecord {
  id: string;
  country: string;
  currency: string;
  available_amount: string;
  pending_amount: string;
  is_frozen: boolean;
  updated_at: string;
}

export interface AdminWalletTransferRecord {
  id: string;
  from_country: string;
  from_currency: string;
  to_country: string;
  to_currency: string;
  from_amount: string;
  exchange_rate: string;
  to_amount: string;
  status: string;
  idempotency_key: string;
  created_at: string;
}

export interface AdminCmsContentRecord {
  id: string;
  slug: string;
  category: "announcement" | "faq" | "corridor_notice" | "legal";
  title_fr: string;
  title_en: string;
  body_fr: string;
  body_en: string;
  is_published: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface AdminCorridorOverrideRecord {
  id: string;
  iso_code: string;
  country_name: string;
  currency: string;
  custom_rate_from_xof: string;
  fee_spread_percent: string;
  is_enabled: boolean;
  payout_rail_note: string;
  updated_at: string;
}

export interface AdminPlatformSettings {
  fee_charge_mode: "ADD_ON" | "DEDUCTED";
  platform_fee_percent: string;
  platform_fee_fixed_xof: string;
  unverified_tx_limit_xof: string;
  unverified_monthly_limit_xof: string;
  verified_tx_limit_xof: string;
  verified_monthly_limit_xof: string;
}

export interface AdminAuditEventRecord {
  id: string;
  transaction_id: string;
  from_status: string | null;
  to_status: string;
  actor_type: string;
  reason: string;
  created_at: string;
}

export interface AdminWebhookEventRecord {
  id: string;
  provider_event_id: string;
  event_type: string;
  signature_valid: boolean;
  processed: boolean;
  processing_error: string | null;
  created_at: string;
}

interface SandboxState {
  activeUserId: string;
  users: AdminUserRecord[];
  recipients: AdminRecipientRecord[];
  transactions: AdminTxRecord[];
  wallets: AdminWalletRecord[];
  walletTransfers: AdminWalletTransferRecord[];
  cmsContents: AdminCmsContentRecord[];
  corridorOverrides: AdminCorridorOverrideRecord[];
  settings: AdminPlatformSettings;
  events: AdminAuditEventRecord[];
  webhooks: AdminWebhookEventRecord[];
}

declare global {
  var __apacciAdminSandboxStore: SandboxState | undefined;
}

export function buildSampleKycSvgDataUrl(
  kind: "RECTO" | "VERSO" | "SELFIE",
  holderName: string,
  docNum: string
): string {
  const bg =
    kind === "RECTO" ? "#0B3D91" : kind === "VERSO" ? "#1E293B" : "#008751";
  const subtitle =
    kind === "RECTO"
      ? `PIECE D'IDENTITE - RECTO (${docNum})`
      : kind === "VERSO"
      ? `PIECE D'IDENTITE - VERSO (MRZ / CODE-BARRES)`
      : `SELFIE BIOMETRIQUE CERTIFIE`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">
    <rect width="480" height="300" rx="20" fill="${bg}"/>
    <rect x="20" y="20" width="440" height="260" rx="14" fill="none" stroke="#F5B700" stroke-width="2" stroke-dasharray="6 4"/>
    <circle cx="95" cy="145" r="46" fill="#F5B700" opacity="0.25"/>
    <circle cx="95" cy="132" r="18" fill="#F5B700"/>
    <path d="M62 175 C62 155 128 155 128 175" fill="#F5B700"/>
    <text x="165" y="105" fill="#F5B700" font-family="sans-serif" font-size="13" font-weight="bold">APACCI EXCHANGE — KYC AML/CFT</text>
    <text x="165" y="138" fill="#FFFFFF" font-family="sans-serif" font-size="18" font-weight="bold">${holderName}</text>
    <text x="165" y="168" fill="#E2E8F0" font-family="monospace" font-size="12">${subtitle}</text>
    <text x="165" y="210" fill="#94A3B8" font-family="monospace" font-size="11">VERIFIED DOCUMENT CAPTURE</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createInitialSandboxState(): SandboxState {
  const now = new Date().toISOString();
  return {
    activeUserId: "usr-client-004",
    users: [
      {
        id: "usr-admin-001",
        email: "admin@apacci-exchange.com",
        full_name: "Kouassi Yao (Super Admin)",
        phone: "+2250708091011",
        country_code: "CI",
        role: "admin",
        kyc_status: "verified",
        kyc_provisioned: true,
        date_of_birth: "1986-04-12",
        nationality: "CI",
        address_line: "Cocody Ambassades, Rue des Jardins",
        city: "Abidjan",
        occupation: "Directeur des Opérations Fintech",
        source_of_funds: "salary",
        kyc_document_type: "passport",
        kyc_document_number: "CI-PASS-8839201",
        kyc_issuing_country: "CI",
        kyc_document_expiry: "2031-04-12",
        kyc_id_recto_url: buildSampleKycSvgDataUrl("RECTO", "Kouassi Yao", "CI-PASS-8839201"),
        kyc_id_verso_url: buildSampleKycSvgDataUrl("VERSO", "Kouassi Yao", "CI-PASS-8839201"),
        kyc_selfie_url: buildSampleKycSvgDataUrl("SELFIE", "Kouassi Yao", "CI-PASS-8839201"),
        kyc_selfie_verified: true,
        kyc_submitted_at: now,
        default_sender_country: "CI",
        default_payment_method: "softpay",
        default_virtual_card_provider: "Wave Carte Virtuelle Visa",
        default_virtual_card_last4: "9012",
        saved_virtual_cards: [
          {
            id: "vc-001",
            provider: "Wave Carte Virtuelle Visa",
            brand: "VISA",
            cardholder_name: "Kouassi Yao",
            last4: "9012",
            expiry: "08/28",
            origin_country: "CI",
            currency: "XOF",
            is_default: true,
          },
        ],
        preferred_locale: "fr",
        notify_email: true,
        notify_sms: true,
        notify_push_pwa: true,
        two_factor_enabled: true,
        transaction_pin_enabled: true,
        custom_tx_limit_xof: "10000000.00",
        custom_monthly_limit_xof: "50000000.00",
        created_at: now,
      },
      {
        id: "usr-client-002",
        email: "awa.konate@example.ci",
        full_name: "Awa Konaté",
        phone: "+2250504030201",
        country_code: "CI",
        role: "client",
        kyc_status: "verified",
        kyc_provisioned: true,
        date_of_birth: "1992-09-24",
        nationality: "CI",
        address_line: "Marcory Zone 4, Boulevard VGE",
        city: "Abidjan",
        occupation: "Commerçante Import-Export",
        source_of_funds: "business",
        kyc_document_type: "national_id",
        kyc_document_number: "CNI-CI-009281726",
        kyc_issuing_country: "CI",
        kyc_document_expiry: "2030-09-24",
        kyc_id_recto_url: buildSampleKycSvgDataUrl("RECTO", "Awa Konaté", "CNI-CI-009281726"),
        kyc_id_verso_url: buildSampleKycSvgDataUrl("VERSO", "Awa Konaté", "CNI-CI-009281726"),
        kyc_selfie_url: buildSampleKycSvgDataUrl("SELFIE", "Awa Konaté", "CNI-CI-009281726"),
        kyc_selfie_verified: true,
        kyc_submitted_at: now,
        default_sender_country: "CI",
        default_payment_method: "virtual_card",
        default_virtual_card_provider: "Orange Money Carte Virtuelle",
        default_virtual_card_last4: "4821",
        saved_virtual_cards: [
          {
            id: "vc-002",
            provider: "Orange Money Carte Virtuelle",
            brand: "VISA",
            cardholder_name: "Awa Konaté",
            last4: "4821",
            expiry: "11/28",
            origin_country: "CI",
            currency: "XOF",
            is_default: true,
          },
          {
            id: "vc-003",
            provider: "Vodacom Virtual Card (M-Pesa / VodaPay)",
            brand: "MASTERCARD",
            cardholder_name: "Awa Konaté",
            last4: "7740",
            expiry: "05/29",
            origin_country: "ZA",
            currency: "ZAR",
            is_default: false,
          },
        ],
        preferred_locale: "fr",
        notify_email: true,
        notify_sms: true,
        notify_push_pwa: true,
        two_factor_enabled: true,
        transaction_pin_enabled: false,
        custom_tx_limit_xof: null,
        custom_monthly_limit_xof: null,
        created_at: now,
      },
      {
        id: "usr-client-003",
        email: "sipho.dlamini@example.za",
        full_name: "Sipho Dlamini",
        phone: "+27821234567",
        country_code: "ZA",
        role: "client",
        kyc_status: "pending",
        kyc_provisioned: true,
        date_of_birth: "1989-11-03",
        nationality: "ZA",
        address_line: "Sandton Drive 140",
        city: "Johannesburg",
        occupation: "Consultant IT",
        source_of_funds: "salary",
        kyc_document_type: "passport",
        kyc_document_number: "ZA-99481023",
        kyc_issuing_country: "ZA",
        kyc_document_expiry: "2029-11-03",
        kyc_id_recto_url: buildSampleKycSvgDataUrl("RECTO", "Sipho Dlamini", "ZA-99481023"),
        kyc_id_verso_url: buildSampleKycSvgDataUrl("VERSO", "Sipho Dlamini", "ZA-99481023"),
        kyc_selfie_url: buildSampleKycSvgDataUrl("SELFIE", "Sipho Dlamini", "ZA-99481023"),
        kyc_selfie_verified: true,
        kyc_submitted_at: now,
        default_sender_country: "ZA",
        default_payment_method: "virtual_card",
        default_virtual_card_provider: "Vodacom Virtual Card (M-Pesa / VodaPay)",
        default_virtual_card_last4: "3319",
        saved_virtual_cards: [
          {
            id: "vc-004",
            provider: "Vodacom Virtual Card (M-Pesa / VodaPay)",
            brand: "VISA",
            cardholder_name: "Sipho Dlamini",
            last4: "3319",
            expiry: "09/28",
            origin_country: "ZA",
            currency: "ZAR",
            is_default: true,
          },
        ],
        preferred_locale: "en",
        notify_email: true,
        notify_sms: true,
        notify_push_pwa: false,
        two_factor_enabled: false,
        transaction_pin_enabled: true,
        custom_tx_limit_xof: null,
        custom_monthly_limit_xof: null,
        created_at: now,
      },
      {
        id: "usr-client-004",
        email: "fatou.diallo@example.sn",
        full_name: "Fatou Diallo",
        phone: "+221778899001",
        country_code: "SN",
        role: "client",
        kyc_status: "unverified",
        kyc_provisioned: false,
        date_of_birth: "",
        nationality: "SN",
        address_line: "",
        city: "Dakar",
        occupation: "",
        source_of_funds: "salary",
        kyc_document_type: "national_id",
        kyc_document_number: "",
        kyc_issuing_country: "SN",
        kyc_document_expiry: "",
        kyc_selfie_verified: false,
        kyc_submitted_at: null,
        default_sender_country: "SN",
        default_payment_method: "virtual_card",
        default_virtual_card_provider: "Wave Carte Virtuelle Visa",
        default_virtual_card_last4: "5510",
        saved_virtual_cards: [
          {
            id: "vc-005",
            provider: "Wave Carte Virtuelle Visa",
            brand: "VISA",
            cardholder_name: "Fatou Diallo",
            last4: "5510",
            expiry: "12/28",
            origin_country: "SN",
            currency: "XOF",
            is_default: true,
          },
        ],
        preferred_locale: "fr",
        notify_email: true,
        notify_sms: true,
        notify_push_pwa: true,
        two_factor_enabled: false,
        transaction_pin_enabled: false,
        custom_tx_limit_xof: null,
        custom_monthly_limit_xof: null,
        created_at: now,
      },
    ],
    recipients: [
      {
        id: "rec-001",
        user_id: "usr-client-002",
        full_name: "Moussa Traoré",
        country_code: "ML",
        currency: "XOF",
        network_code: "orange_ml",
        network_name: "Orange Money Mali",
        msisdn: "+22376123456",
        is_active: true,
        created_at: now,
      },
      {
        id: "rec-002",
        user_id: "usr-client-002",
        full_name: "Amani Nyerere",
        country_code: "TZ",
        currency: "TZS",
        network_code: "mpesa_tz",
        network_name: "Vodacom M-Pesa Tanzania",
        msisdn: "+255754112233",
        is_active: true,
        created_at: now,
      },
      {
        id: "rec-003",
        user_id: "usr-client-003",
        full_name: "Sipho Dlamini (Bidvest / Vodacom)",
        country_code: "ZA",
        currency: "ZAR",
        network_code: "vodacom_za",
        network_name: "Vodacom Pay / Bidvest ZA",
        msisdn: "+27821234567",
        is_active: true,
        created_at: now,
      },
      {
        id: "rec-004",
        user_id: "usr-client-004",
        full_name: "Clarisse Nguema",
        country_code: "CM",
        currency: "XAF",
        network_code: "mtn_cm",
        network_name: "MTN MoMo Cameroon",
        msisdn: "+237677889900",
        is_active: true,
        created_at: now,
      },
    ],
    transactions: [
      {
        id: "tx-demo-001",
        reference: "APC-20261106-8841",
        user_id: "usr-client-002",
        recipient_id: "rec-001",
        sender_country: "CI",
        sender_currency: "XOF",
        destination_country: "ML",
        destination_currency: "XOF",
        destination_network: "orange_ml",
        destination_network_name: "Orange Money Mali",
        recipient_name: "Moussa Traoré",
        recipient_msisdn: "+22376123456",
        send_amount: "50000.00",
        fee_amount: "1250.00",
        total_charged: "51250.00",
        net_send_amount: "50000.00",
        exchange_rate: "1.00000000",
        payout_amount: "50000.00",
        fee_charge_mode: "ADD_ON",
        status: "completed",
        failure_code: null,
        failure_reason: null,
        created_at: now,
      },
      {
        id: "tx-demo-002",
        reference: "APC-20261106-8842",
        user_id: "usr-client-002",
        recipient_id: "rec-002",
        sender_country: "CI",
        sender_currency: "XOF",
        destination_country: "TZ",
        destination_currency: "TZS",
        destination_network: "mpesa_tz",
        destination_network_name: "Vodacom M-Pesa Tanzania",
        recipient_name: "Amani Nyerere",
        recipient_msisdn: "+255754112233",
        send_amount: "25000.00",
        fee_amount: "625.00",
        total_charged: "25625.00",
        net_send_amount: "25000.00",
        exchange_rate: "4.35000000",
        payout_amount: "108750.00",
        fee_charge_mode: "ADD_ON",
        status: "payout_failed",
        failure_code: "ip_not_whitelisted",
        failure_reason: "Server IP must be whitelisted in SasPay dashboard for payouts",
        created_at: now,
      },
      {
        id: "tx-demo-003",
        reference: "APC-20261106-8843",
        user_id: "usr-client-004",
        recipient_id: "rec-004",
        sender_country: "CI",
        sender_currency: "XOF",
        destination_country: "CM",
        destination_currency: "XAF",
        destination_network: "mtn_cm",
        destination_network_name: "MTN MoMo Cameroon",
        recipient_name: "Clarisse Nguema",
        recipient_msisdn: "+237677889900",
        send_amount: "30000.00",
        fee_amount: "750.00",
        total_charged: "30750.00",
        net_send_amount: "30000.00",
        exchange_rate: "1.00000000",
        payout_amount: "30000.00",
        fee_charge_mode: "ADD_ON",
        status: "payment_pending",
        failure_code: null,
        failure_reason: null,
        created_at: now,
      },
    ],
    wallets: [
      {
        id: "wal-ci",
        country: "CI",
        currency: "XOF",
        available_amount: "4850000.00",
        pending_amount: "125000.00",
        is_frozen: false,
        updated_at: now,
      },
      {
        id: "wal-ml",
        country: "ML",
        currency: "XOF",
        available_amount: "1920000.00",
        pending_amount: "50000.00",
        is_frozen: false,
        updated_at: now,
      },
      {
        id: "wal-sn",
        country: "SN",
        currency: "XOF",
        available_amount: "1450000.00",
        pending_amount: "0.00",
        is_frozen: false,
        updated_at: now,
      },
      {
        id: "wal-cm",
        country: "CM",
        currency: "XAF",
        available_amount: "890000.00",
        pending_amount: "30000.00",
        is_frozen: false,
        updated_at: now,
      },
      {
        id: "wal-tz",
        country: "TZ",
        currency: "TZS",
        available_amount: "6400000.00",
        pending_amount: "108750.00",
        is_frozen: false,
        updated_at: now,
      },
      {
        id: "wal-za",
        country: "ZA",
        currency: "ZAR",
        available_amount: "45000.00",
        pending_amount: "0.00",
        is_frozen: false,
        updated_at: now,
      },
    ],
    walletTransfers: [
      {
        id: "wt-demo-001",
        from_country: "CI",
        from_currency: "XOF",
        to_country: "ML",
        to_currency: "XOF",
        from_amount: "500000.00",
        exchange_rate: "1.00000000",
        to_amount: "500000.00",
        status: "COMPLETED",
        idempotency_key: "wt-init-001",
        created_at: now,
      },
    ],
    cmsContents: [
      {
        id: "cms-001",
        slug: "promo-uemoa-zero-delay",
        category: "announcement",
        title_fr: "Transferts instantanés UEMOA (CI → ML, SN, BF, BJ, TG)",
        title_en: "Instant WAEMU Transfers (CI → ML, SN, BF, BJ, TG)",
        body_fr:
          "Les décaissements vers Wave et Orange Money au Mali, Sénégal et Burkina Faso sont traités en moins de 30 secondes après vérification SasPay.",
        body_en:
          "Payouts to Wave and Orange Money in Mali, Senegal, and Burkina Faso are processed in under 30 seconds after SasPay verification.",
        is_published: true,
        priority: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: "cms-002",
        slug: "south-africa-card-rail-notice",
        category: "corridor_notice",
        title_fr: "Corridor Afrique du Sud (ZA - ZAR) : Cartes Virtuelles & Bidvest Bank",
        title_en: "South Africa Corridor (ZA - ZAR): Virtual Cards & Bidvest Bank",
        body_fr:
          "Les fonds envoyés par carte virtuelle Mobile Money (ex. Vodacom Virtual Card) peuvent être encaissés via le Checkout Carte SasPay. Pour créditer une carte bancaire sud-africaine (ex. Bidvest Bank), un partenaire Visa Direct / Mastercard Send ou EFT RTC sud-africain est requis.",
        body_en:
          "Funds sent from a Mobile Money virtual card (e.g., Vodacom Virtual Card) can be collected via SasPay Card Checkout. Crediting a South African bank card (e.g., Bidvest Bank) requires a Visa Direct / Mastercard Send or South African RTC EFT payout partner.",
        is_published: true,
        priority: 2,
        created_at: now,
        updated_at: now,
      },
      {
        id: "cms-003",
        slug: "faq-kyc-limits",
        category: "faq",
        title_fr: "Quels sont les plafonds d'envoi sans vérification KYC ?",
        title_en: "What are the sending limits without KYC verification?",
        body_fr:
          "Les comptes non vérifiés peuvent envoyer jusqu'à 100 000 XOF par transaction et 500 000 XOF par mois. Après validation KYC, votre plafond passe à 2 000 000 XOF par transaction.",
        body_en:
          "Unverified accounts can send up to 100,000 XOF per transaction and 500,000 XOF per month. After KYC approval, your limit increases to 2,000,000 XOF per transaction.",
        is_published: true,
        priority: 3,
        created_at: now,
        updated_at: now,
      },
      {
        id: "cms-004",
        slug: "legal-disclaimer-non-bank",
        category: "legal",
        title_fr: "Mention légale obligatoire — Prestataire technique",
        title_en: "Mandatory Legal Disclaimer — Technical Platform",
        body_fr:
          "Apacci Exchange n'est ni une banque ni un établissement de paiement agréé. Toutes les opérations de collecte et de décaissement sont exécutées via l'infrastructure réglementée de SasPay.",
        body_en:
          "Apacci Exchange is neither a licensed bank nor a payment institution. All payin and payout operations are executed through SasPay's regulated infrastructure.",
        is_published: true,
        priority: 4,
        created_at: now,
        updated_at: now,
      },
    ],
    corridorOverrides: [
      {
        id: "corr-ml",
        iso_code: "ML",
        country_name: "Mali",
        currency: "XOF",
        custom_rate_from_xof: "1.00000000",
        fee_spread_percent: "0.000",
        is_enabled: true,
        payout_rail_note: "SasPay Mobile Money (Orange ML, Moov ML, Wave ML)",
        updated_at: now,
      },
      {
        id: "corr-sn",
        iso_code: "SN",
        country_name: "Sénégal",
        currency: "XOF",
        custom_rate_from_xof: "1.00000000",
        fee_spread_percent: "0.000",
        is_enabled: true,
        payout_rail_note: "SasPay Mobile Money (Wave SN, Orange Money SN, Free Money SN)",
        updated_at: now,
      },
      {
        id: "corr-cm",
        iso_code: "CM",
        country_name: "Cameroun",
        currency: "XAF",
        custom_rate_from_xof: "1.00000000",
        fee_spread_percent: "0.500",
        is_enabled: true,
        payout_rail_note: "SasPay Mobile Money CEMAC (MTN MoMo CM, Orange Money CM)",
        updated_at: now,
      },
      {
        id: "corr-tz",
        iso_code: "TZ",
        country_name: "Tanzanie",
        currency: "TZS",
        custom_rate_from_xof: "4.35000000",
        fee_spread_percent: "1.000",
        is_enabled: true,
        payout_rail_note: "SasPay Mobile Money (M-Pesa TZ, Airtel TZ, Tigo Pesa TZ)",
        updated_at: now,
      },
      {
        id: "corr-ga",
        iso_code: "GA",
        country_name: "Gabon",
        currency: "XAF",
        custom_rate_from_xof: "1.00000000",
        fee_spread_percent: "0.750",
        is_enabled: false,
        payout_rail_note: "En attente d'activation opérateur Airtel/Moov Gabon sur SasPay",
        updated_at: now,
      },
      {
        id: "corr-za",
        iso_code: "ZA",
        country_name: "Afrique du Sud",
        currency: "ZAR",
        custom_rate_from_xof: "0.03000000",
        fee_spread_percent: "1.500",
        is_enabled: false,
        payout_rail_note: "Collecte Carte Virtuelle Vodacom OK ; Décaissement Bidvest Bank nécessite rail Visa Direct / EFT ZA",
        updated_at: now,
      },
    ],
    settings: {
      fee_charge_mode: "ADD_ON",
      platform_fee_percent: "1.000",
      platform_fee_fixed_xof: "0.00",
      unverified_tx_limit_xof: "100000.00",
      unverified_monthly_limit_xof: "500000.00",
      verified_tx_limit_xof: "2000000.00",
      verified_monthly_limit_xof: "10000000.00",
    },
    events: [
      {
        id: "ev-001",
        transaction_id: "tx-demo-001",
        from_status: "paid",
        to_status: "completed",
        actor_type: "webhook",
        reason: "SasPay payout.completed webhook verified & confirmed",
        created_at: now,
      },
      {
        id: "ev-002",
        transaction_id: "tx-demo-002",
        from_status: "payout_pending",
        to_status: "payout_failed",
        actor_type: "system",
        reason: "SasPay returned 403 ip_not_whitelisted on POST /payouts/initialize/",
        created_at: now,
      },
    ],
    webhooks: [
      {
        id: "wh-001",
        provider_event_id: "evt_saspay_99201a",
        event_type: "payment.succeeded",
        signature_valid: true,
        processed: true,
        processing_error: null,
        created_at: now,
      },
      {
        id: "wh-002",
        provider_event_id: "evt_saspay_99202b",
        event_type: "payout.completed",
        signature_valid: true,
        processed: true,
        processing_error: null,
        created_at: now,
      },
    ],
  };
}

export function getAdminSandboxStore(): SandboxState {
  if (
    !globalThis.__apacciAdminSandboxStore ||
    !globalThis.__apacciAdminSandboxStore.activeUserId
  ) {
    globalThis.__apacciAdminSandboxStore = createInitialSandboxState();
  }
  return globalThis.__apacciAdminSandboxStore;
}


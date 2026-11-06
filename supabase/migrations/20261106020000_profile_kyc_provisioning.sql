-- ==============================================================================
-- Apacci Exchange — Extended User Profile, KYC Provisioning & User Preferences
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL,
  ADD COLUMN IF NOT EXISTS nationality CHAR(2) NOT NULL DEFAULT 'CI',
  ADD COLUMN IF NOT EXISTS address_line TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS occupation TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_of_funds TEXT NOT NULL DEFAULT 'salary',
  ADD COLUMN IF NOT EXISTS kyc_document_type TEXT NOT NULL DEFAULT 'national_id',
  ADD COLUMN IF NOT EXISTS kyc_document_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS kyc_issuing_country CHAR(2) NOT NULL DEFAULT 'CI',
  ADD COLUMN IF NOT EXISTS kyc_document_expiry DATE NULL,
  ADD COLUMN IF NOT EXISTS kyc_id_recto_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS kyc_id_verso_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS kyc_selfie_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS kyc_selfie_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kyc_provisioned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS default_sender_country CHAR(2) NOT NULL DEFAULT 'CI',
  ADD COLUMN IF NOT EXISTS default_payment_method TEXT NOT NULL DEFAULT 'virtual_card',
  ADD COLUMN IF NOT EXISTS default_virtual_card_provider TEXT NOT NULL DEFAULT 'Vodacom Virtual Card (M-Pesa / VodaPay)',
  ADD COLUMN IF NOT EXISTS default_virtual_card_last4 CHAR(4) NOT NULL DEFAULT '4821',
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_sms BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_push_pwa BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transaction_pin_enabled BOOLEAN NOT NULL DEFAULT FALSE;


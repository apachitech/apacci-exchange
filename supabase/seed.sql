-- ==============================================================================
-- Apacci Exchange — Development Seed Data
-- Sender Country: Côte d'Ivoire (CI - XOF)
-- Destination Countries: Mali (ML - XOF), Gabon (GA - XAF), Tanzania (TZ - TZS), South Africa (ZA - ZAR)
-- Note: Live availability is always confirmed dynamically against the SasPay API.
-- ==============================================================================

INSERT INTO public.settings (
  id,
  fee_charge_mode,
  platform_fee_percent,
  platform_fee_fixed_xof,
  unverified_tx_limit_xof,
  unverified_monthly_limit_xof,
  verified_tx_limit_xof,
  verified_monthly_limit_xof
) VALUES (
  1,
  'ADD_ON',
  1.000,
  0.00,
  100000.00,
  500000.00,
  2000000.00,
  10000000.00
) ON CONFLICT (id) DO UPDATE SET
  fee_charge_mode = EXCLUDED.fee_charge_mode,
  platform_fee_percent = EXCLUDED.platform_fee_percent,
  unverified_tx_limit_xof = EXCLUDED.unverified_tx_limit_xof,
  unverified_monthly_limit_xof = EXCLUDED.unverified_monthly_limit_xof;


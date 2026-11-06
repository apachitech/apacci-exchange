-- ==============================================================================
-- Apacci Exchange — Initial Database Schema, RLS, and Atomic State Machine RPCs
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE kyc_status_type AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fee_charge_mode_type AS ENUM ('ADD_ON', 'DEDUCTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status_type AS ENUM (
    'created',
    'payment_pending',
    'paid',
    'payout_pending',
    'completed',
    'payment_failed',
    'payout_failed',
    'retry',
    'refunded',
    'manual_review'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 2. Tables
-- ==============================================================================

-- 2.1 profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  country_code CHAR(2) NOT NULL DEFAULT 'CI',
  role user_role NOT NULL DEFAULT 'client',
  kyc_status kyc_status_type NOT NULL DEFAULT 'unverified',
  custom_tx_limit_xof NUMERIC(18, 2) NULL,
  custom_monthly_limit_xof NUMERIC(18, 2) NULL,
  preferred_locale TEXT NOT NULL DEFAULT 'fr' CHECK (preferred_locale IN ('fr', 'en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON public.profiles(kyc_status);

-- 2.2 recipients
CREATE TABLE IF NOT EXISTS public.recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  currency CHAR(3) NOT NULL,
  network_code TEXT NOT NULL,
  network_name TEXT NOT NULL,
  msisdn TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipients_user_id ON public.recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_recipients_country_code ON public.recipients(country_code);

-- 2.3 transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE RESTRICT,
  sender_country CHAR(2) NOT NULL DEFAULT 'CI',
  sender_currency CHAR(3) NOT NULL DEFAULT 'XOF',
  destination_country CHAR(2) NOT NULL,
  destination_currency CHAR(3) NOT NULL,
  destination_network TEXT NOT NULL,
  destination_network_name TEXT NOT NULL DEFAULT '',
  recipient_msisdn TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  send_amount NUMERIC(18, 2) NOT NULL CHECK (send_amount > 0),
  fee_amount NUMERIC(18, 2) NOT NULL CHECK (fee_amount >= 0),
  total_charged NUMERIC(18, 2) NOT NULL CHECK (total_charged > 0),
  net_send_amount NUMERIC(18, 2) NOT NULL CHECK (net_send_amount > 0),
  exchange_rate NUMERIC(18, 8) NOT NULL CHECK (exchange_rate > 0),
  payout_amount NUMERIC(18, 2) NOT NULL CHECK (payout_amount > 0),
  fee_charge_mode fee_charge_mode_type NOT NULL DEFAULT 'ADD_ON',
  status transaction_status_type NOT NULL DEFAULT 'created',
  payment_idempotency_key TEXT NOT NULL UNIQUE,
  payout_idempotency_key TEXT NULL UNIQUE,
  payout_attempt_count INT NOT NULL DEFAULT 0,
  payout_locked_at TIMESTAMPTZ NULL,
  saspay_checkout_id UUID NULL UNIQUE,
  saspay_checkout_slug TEXT NULL,
  saspay_checkout_url TEXT NULL,
  saspay_payment_id UUID NULL UNIQUE,
  saspay_payout_id UUID NULL UNIQUE,
  failure_code TEXT NULL,
  failure_reason TEXT NULL,
  paid_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_pending_reconcile ON public.transactions(status, updated_at)
  WHERE status IN ('payment_pending', 'paid', 'payout_pending');

-- 2.4 transaction_events (Audit Log of every state change & admin action)
CREATE TABLE IF NOT EXISTS public.transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  from_status transaction_status_type NULL,
  to_status transaction_status_type NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'webhook', 'cron', 'admin')),
  actor_id UUID NULL,
  reason TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_events_tx_id ON public.transaction_events(transaction_id, created_at ASC);

-- 2.5 webhook_events (Raw payload, signature verification, idempotency)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  parsed_payload JSONB NULL,
  signature_header TEXT NOT NULL DEFAULT '',
  timestamp_header TEXT NOT NULL DEFAULT '',
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed, created_at DESC);

-- 2.6 settings (Singleton configuration row for fee mode & user transaction limits)
CREATE TABLE IF NOT EXISTS public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fee_charge_mode fee_charge_mode_type NOT NULL DEFAULT 'ADD_ON',
  platform_fee_percent NUMERIC(6, 3) NOT NULL DEFAULT 1.000 CHECK (platform_fee_percent >= 0),
  platform_fee_fixed_xof NUMERIC(18, 2) NOT NULL DEFAULT 0.00 CHECK (platform_fee_fixed_xof >= 0),
  unverified_tx_limit_xof NUMERIC(18, 2) NOT NULL DEFAULT 100000.00 CHECK (unverified_tx_limit_xof > 0),
  unverified_monthly_limit_xof NUMERIC(18, 2) NOT NULL DEFAULT 500000.00 CHECK (unverified_monthly_limit_xof > 0),
  verified_tx_limit_xof NUMERIC(18, 2) NOT NULL DEFAULT 2000000.00 CHECK (verified_tx_limit_xof > 0),
  verified_monthly_limit_xof NUMERIC(18, 2) NOT NULL DEFAULT 10000000.00 CHECK (verified_monthly_limit_xof > 0),
  updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default singleton settings row
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
) ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 3. Triggers for Auth Profile Creation & Privileged Column Protection
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, country_code, role, kyc_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'country_code', 'CI'),
    'client',
    'unverified'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent regular authenticated clients from escalating role, kyc_status, or custom limits
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'authenticated' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot modify role directly';
    END IF;
    IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status AND NOT (OLD.kyc_status = 'unverified' AND NEW.kyc_status = 'pending') THEN
      RAISE EXCEPTION 'Cannot modify kyc_status directly';
    END IF;
    IF NEW.custom_tx_limit_xof IS DISTINCT FROM OLD.custom_tx_limit_xof
       OR NEW.custom_monthly_limit_xof IS DISTINCT FROM OLD.custom_monthly_limit_xof THEN
      RAISE EXCEPTION 'Cannot modify custom transaction limits directly';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ==============================================================================
-- 4. Row Level Security (RLS)
-- Users can read/write ONLY their own rows. Admin access only through server-side service role.
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- profiles policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- recipients policies
DROP POLICY IF EXISTS "recipients_select_own" ON public.recipients;
CREATE POLICY "recipients_select_own" ON public.recipients
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "recipients_insert_own" ON public.recipients;
CREATE POLICY "recipients_insert_own" ON public.recipients
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "recipients_update_own" ON public.recipients;
CREATE POLICY "recipients_update_own" ON public.recipients
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "recipients_delete_own" ON public.recipients;
CREATE POLICY "recipients_delete_own" ON public.recipients
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- transactions policies (read-only for own rows; mutations go through server-side state machine)
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- transaction_events policies (read-only for events belonging to user's own transactions)
DROP POLICY IF EXISTS "transaction_events_select_own" ON public.transaction_events;
CREATE POLICY "transaction_events_select_own" ON public.transaction_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_events.transaction_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

-- settings policies (authenticated users can read active fee mode & limits; writes via service_role only)
DROP POLICY IF EXISTS "settings_select_authenticated" ON public.settings;
CREATE POLICY "settings_select_authenticated" ON public.settings
  FOR SELECT TO authenticated
  USING (true);

-- webhook_events has NO policies for anon/authenticated -> accessible strictly by service_role.

-- ==============================================================================
-- 5. Atomic Payout Lock RPC (Prevents duplicate payouts from `paid`)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.acquire_payout_lock(
  p_tx_id UUID,
  p_actor_type TEXT DEFAULT 'system',
  p_actor_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Initiating SasPay payout after confirmed payment'
)
RETURNS SETOF public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_attempt INT;
  v_idem_key TEXT;
BEGIN
  -- Lock the row exclusively if and only if it is in `paid` (or `retry`) and has no active payout
  SELECT * INTO v_tx
  FROM public.transactions
  WHERE id = p_tx_id
    AND status IN ('paid', 'retry')
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_attempt := COALESCE(v_tx.payout_attempt_count, 0) + 1;
  v_idem_key := 'apacci-payout-' || v_tx.id::text || '-attempt-' || v_attempt::text;

  UPDATE public.transactions
  SET status = 'payout_pending',
      payout_locked_at = NOW(),
      payout_attempt_count = v_attempt,
      payout_idempotency_key = v_idem_key,
      failure_code = NULL,
      failure_reason = NULL,
      updated_at = NOW()
  WHERE id = p_tx_id
  RETURNING * INTO v_tx;

  INSERT INTO public.transaction_events (
    transaction_id,
    from_status,
    to_status,
    actor_type,
    actor_id,
    reason,
    metadata
  ) VALUES (
    p_tx_id,
    CASE WHEN v_attempt = 1 THEN 'paid'::transaction_status_type ELSE 'retry'::transaction_status_type END,
    'payout_pending',
    p_actor_type,
    p_actor_id,
    p_reason,
    jsonb_build_object('payout_idempotency_key', v_idem_key, 'attempt', v_attempt)
  );

  RETURN NEXT v_tx;
END;
$$;


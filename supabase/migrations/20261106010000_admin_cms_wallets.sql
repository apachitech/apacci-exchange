-- ==============================================================================
-- Apacci Exchange — Admin CMS Contents, Corridor Overrides & Wallet Ledger
-- ==============================================================================

-- 1. cms_contents: Manageable banners, FAQs, corridor guides & legal sections
CREATE TABLE IF NOT EXISTS public.cms_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('announcement', 'faq', 'corridor_notice', 'legal')),
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  body_fr TEXT NOT NULL,
  body_en TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 10,
  updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_contents_category ON public.cms_contents(category, priority ASC);

ALTER TABLE public.cms_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cms_contents_select_published" ON public.cms_contents;
CREATE POLICY "cms_contents_select_published" ON public.cms_contents
  FOR SELECT TO anon, authenticated
  USING (is_published = TRUE);

-- 2. corridor_overrides: Admin-controlled corridor activation, FX spread & rail notes
CREATE TABLE IF NOT EXISTS public.corridor_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code CHAR(2) NOT NULL UNIQUE,
  country_name TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  custom_rate_from_xof NUMERIC(18, 8) NOT NULL CHECK (custom_rate_from_xof > 0),
  fee_spread_percent NUMERIC(6, 3) NOT NULL DEFAULT 0.000,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  payout_rail_note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.corridor_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corridor_overrides_select_all" ON public.corridor_overrides;
CREATE POLICY "corridor_overrides_select_all" ON public.corridor_overrides
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3. wallet_ledger: Local mirror & sandbox ledger for merchant country wallets
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country CHAR(2) NOT NULL UNIQUE,
  currency CHAR(3) NOT NULL,
  available_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  pending_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
-- Accessible strictly via service_role in /api/admin


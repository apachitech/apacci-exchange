# Apacci Exchange

> **Send money across Africa, fast and safely.**  
> Mobile-first money-transfer web app (PWA) built with Next.js (App Router, TypeScript, Tailwind CSS), Supabase (Auth, PostgreSQL, Row Level Security), and the official **SasPay REST API** (`https://api.saspay.me/api/v1`).

---

## 1. Local Setup

### Prerequisites
- Node.js 20+ and npm
- A Supabase project (or local Supabase CLI stack)
- A SasPay merchant account (`https://app.saspay.me`) with a Sandbox API key (`sk_test_...`)

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```

3. Apply the Supabase database migration and seed data:
   - Open the Supabase SQL Editor (or run `supabase db push`) and execute:
     1. `supabase/migrations/20261106000000_init.sql`
     2. `supabase/seed.sql`

4. Run the development server with your `sk_test_...` key:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

5. Run the test suite (Vitest):
   ```bash
   npm test
   ```

---

## 2. Environment Variables

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Public | Base URL of your deployment (e.g. `http://localhost:3000` or `https://apacci-exchange.vercel.app`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Your Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only** | Supabase service-role secret key (used by webhook, cron, and admin server routes) |
| `SASPAY_BASE_URL` | **Server-Only** | `https://api.saspay.me/api/v1` |
| `SASPAY_SECRET_KEY` | **Server-Only** | SasPay secret key: `sk_test_...` in dev/sandbox, `sk_live_...` in production |
| `SASPAY_WEBHOOK_SECRET` | **Server-Only** | Webhook signing secret generated in the SasPay Dashboard |
| `CRON_SECRET` | **Server-Only** | Secret token (min 32 chars) used by Vercel Cron to authenticate `/api/cron/reconcile` |

---

## 3. Creating the Webhook in the SasPay Dashboard

Per the official SasPay documentation (`/api-reference/webhooks`), webhook creation and modification happen **exclusively from the SasPay Dashboard** (`https://app.saspay.me`):

1. Log in to `https://app.saspay.me` and navigate to **Développeur → Webhooks**.
2. Create a new Webhook endpoint:
   - **URL**: `https://<your-domain>/api/webhooks/saspay`
   - **Environment**: `SANDBOX` (for testing with `sk_test_`) or `LIVE` (for production with `sk_live_`)
3. Subscribe the endpoint to the following events:
   - `transaction.created`
   - `transaction.success`
   - `transaction.failed`
   - `transaction.cancelled`
   - `wallet_transfer.completed`
   - `webhook.test`
4. **Copy the `signing_secret` immediately** when SasPay displays it (it is shown only once) and set it as `SASPAY_WEBHOOK_SECRET` in `.env.local` and in your Vercel Project Environment Variables.

---

## 4. Deploying to Vercel & Going Live

1. Push the repository to GitHub/GitLab and import it into Vercel.
2. Add all variables from `.env.example` in **Vercel → Settings → Environment Variables**.
3. Ensure `vercel.json` is present at the root—Vercel will automatically register the reconciliation cron job (`/api/cron/reconcile` every 10 minutes, authenticated via `Authorization: Bearer <CRON_SECRET>`).
4. **Important — IP Whitelisting for Payouts (`POST /payouts/initialize/`)**:
   - SasPay requires the calling server's outbound IP to be whitelisted on your merchant account when calling `POST /payouts/initialize/` with an API key (`403 ip_not_whitelisted` otherwise).
   - Enable **Vercel Static IPs** (or route outbound payout calls through a static egress IP) and add that IP in the SasPay Dashboard before initiating live payouts.
5. Switch `SASPAY_SECRET_KEY` from `sk_test_...` to `sk_live_...` (with scope `BOTH`) and create a `LIVE` webhook in the SasPay Dashboard.

---

## 5. Manual Steps Checklist for You

- [ ] **1. Create your SasPay account & Merchant**: Sign up at `https://app.saspay.me` and create your merchant profile.
- [ ] **2. Complete Merchant KYC**: Submit your KYC dossier (`BUSINESS` or `INDIVIDUAL` with ID card, RCCM/IFU if applicable) in the SasPay dashboard and wait for `kyc_status: "VERIFIED"` and `is_active: true`.
- [ ] **3. Generate API Keys**: Create a `SANDBOX` key (`sk_test_...`, scope `BOTH`) for testing and a `LIVE` key (`sk_live_...`, scope `BOTH`) for production. Copy the `secret` immediately.
- [ ] **4. Configure Webhook & Secret**: Register `https://<your-domain>/api/webhooks/saspay` in the SasPay Dashboard, subscribe to `transaction.*` events, and copy the `signing_secret` into `SASPAY_WEBHOOK_SECRET`.
- [ ] **5. Whitelist Server Outbound IP**: Add your production server's static outbound IP to the SasPay IP whitelist so `POST /payouts/initialize/` is permitted.
- [ ] **6. Fund Destination Country Wallets**: Ensure your per-country SasPay wallets (e.g. Mali `ML`, Tanzania `TZ`, or other active corridors) have available balance or configure inter-wallet transfers (`POST /wallet-transfers/`).
- [ ] **7. Review Licensing & Legal Requirements**: Have a qualified lawyer in your operating jurisdiction(s) (e.g. UEMOA/BCEAO, CEMAC, Tanzania, South Africa) review the regulatory licensing requirements for cross-border money transfer as well as the placeholder Terms of Service (`/legal/terms`), Privacy Policy (`/legal/privacy`), and How It Works (`/legal/how-it-works`) pages.
- [ ] **8. Test with Small Amounts**: Run end-to-end tests in Sandbox (`sk_test_`) and then with small real amounts in Live mode across each enabled corridor.

---

## 6. Items Not Verified End-to-End (Require Real Credentials)

While the public `GET https://api.saspay.me/api/v1/countries/` endpoint was tested live against SasPay's production server and all 15 unit tests (HMAC-SHA256 webhook verification, 300s timestamp tolerance, state-machine transitions, decimal string fee/FX math, and concurrent payout idempotency locking) pass, the following require your real SasPay & Supabase credentials to verify end-to-end:

1. **Authenticated SasPay Endpoints**: `GET /pricing/my-rates/`, `GET /networks/`, `GET /exchange-rates/`, `GET /merchant-balances/`, `POST /checkout-sessions/`, `GET /checkout-sessions/{id}/status/`, `GET /payments/{id}/verify/`, `POST /payouts/initialize/`, and `GET /payouts/{id}/verify/` require a valid `SASPAY_SECRET_KEY` (`sk_test_...` or `sk_live_...`).
2. **Outbound Payout IP Whitelist**: Live execution of `POST /payouts/initialize/` requires a whitelisted server IP on your SasPay merchant account.
3. **Gabon (`GA`) & South Africa (`ZA`) Corridor Activation**: Live `GET /countries/` currently returns `ZA` (`Afrique du Sud`, `ZAR`) with `is_active: false` and `GA` (`Gabon`, `XAF`) without active default Mobile Money networks; our dynamic corridor loader includes both in the seed/UI and automatically enables them as soon as `GET /pricing/my-rates/` confirms an active route on your SasPay account.
4. **Live Supabase Auth & Postgres Execution**: Executing the SQL migration (`supabase/migrations/20261106000000_init.sql`) and Google OAuth sign-in requires connecting your Supabase project URL and keys in `.env.local`.


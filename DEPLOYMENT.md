# Guide Complet de Déploiement en Production — Apacci Exchange (`DEPLOYMENT.md`)

Ce document décrit **étape par étape** la procédure complète pour déployer **Apacci Exchange** en production avec **Next.js (App Router)**, **Supabase (PostgreSQL, Auth, RLS)** et l'API **SasPay (`https://api.saspay.me/api/v1`)**.

---

## 1. Vue d'Ensemble & Prérequis de Production

Avant de lancer la mise en production, assurez-vous de disposer des éléments suivants :
1. **Un nom de domaine sécurisé en HTTPS** (ex. `https://apacci-exchange.com`).
2. **Un projet Supabase de Production** (PostgreSQL + Authentication).
3. **Un compte marchand SasPay validé en Production** :
   - Clé secrète Live : `sk_live_...` *(ne jamais l'exposer côté frontend ni la commiter dans Git)*.
   - Secret de signature Webhook : `whsec_...` (pour la vérification HMAC-SHA256 de `X-Webhook-Signature` et `X-Webhook-Timestamp`).
4. **Une adresse IPv4 sortante fixe (Static Outbound IP)** :
   - **Règle SasPay critique (`AGENTS.md`)** : Pour exécuter un retrait/payout (`POST /payouts/initialize/`), l'adresse IP du serveur backend **doit** être whitelistée dans le dashboard SasPay, sinon l'API renvoie **`403 ip_not_whitelisted`**.

---

## 2. Étape 1 — Préparation et Vérification du Code en Local

Avant tout déploiement, vérifiez que le build de production, le typage TypeScript et les tests unitaires passent sans aucune erreur :

```powershell
# 1. Installer les dépendances propres
npm.cmd ci

# 2. Vérifier le typage TypeScript (0 erreur attendue)
npx.cmd tsc --noEmit

# 3. Exécuter la suite de tests unitaires (Calculs décimaux, Webhooks HMAC, Machine à états, Idempotence Payout)
npm.cmd test -- --run

# 4. Tester la compilation de production Next.js
npm.cmd run build
```

---

## 3. Étape 2 — Configuration de la Base de Données & Auth Supabase

### 3.1. Créer le projet Supabase
1. Connectez-vous sur [https://supabase.com/dashboard](https://supabase.com/dashboard) et créez un nouveau projet (ex. `apacci-exchange-prod`).
2. Dans **Project Settings → API**, récupérez :
   - `Project URL` → correspond à `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → correspond à `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → correspond à `SUPABASE_SERVICE_ROLE_KEY` *(strictement côté serveur)*

### 3.2. Exécuter les migrations SQL dans l'ordre
Ouvrez **SQL Editor** dans le dashboard Supabase (ou utilisez la CLI `npx supabase db push`) et exécutez successivement les **3 fichiers de migration** présents dans `supabase/migrations/` :

1. **`supabase/migrations/20261106000000_apacci_exchange_init.sql`**
   - Crée les tables principales : `profiles`, `recipients`, `transactions`, `transaction_events`, `webhook_events`, `settings`.
   - Active le **Row-Level Security (RLS)** sur toutes les tables et crée la fonction RPC atomique de verrouillage des payouts.
2. **`supabase/migrations/20261106010000_admin_cms_and_corridors.sql`**
   - Crée les tables `cms_contents`, `corridor_overrides` et `wallet_transfers` pour le Back-Office Administrateur.
3. **`supabase/migrations/20261106020000_profile_kyc_provisioning.sql`**
   - Ajoute toutes les colonnes de provisionnement KYC réglementaire (`kyc_document_type`, `kyc_document_number`, `kyc_id_recto_url`, `kyc_id_verso_url`, `kyc_selfie_url`, `kyc_provisioned`, `source_of_funds`, cartes virtuelles et préférences).

### 3.3. Configurer les URLs d'Authentification Supabase
Dans **Authentication → URL Configuration** sur Supabase :
- **Site URL** : `https://votre-domaine.com`
- **Redirect URLs** :
  - `https://votre-domaine.com/auth/callback`
  - `https://votre-domaine.com/login`

### 3.4. Créer et promouvoir le compte Super Administrateur
1. Inscrivez votre compte administrateur via la page `https://votre-domaine.com/login` (onglet **Créer un compte**).
2. Dans **Supabase → SQL Editor**, exécutez la requête suivante pour lui attribuer le rôle `admin` :

```sql
UPDATE public.profiles
SET
  role = 'admin',
  kyc_status = 'verified',
  kyc_provisioned = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@votre-domaine.com'
);
```

---

## 4. Étape 3 — Configuration de l'API SasPay en Production

Connectez-vous à votre tableau de bord marchand **SasPay** :

1. **Clé API de Production (`SASPAY_SECRET_KEY`)** :
   - Générez votre clé secrète de production commençant par `sk_live_...`.
   - Le backend Apacci Exchange l'enverra automatiquement dans l'en-tête `Authorization: Bearer sk_live_...` vers `https://api.saspay.me/api/v1`.
2. **Configuration du Webhook SasPay (`SASPAY_WEBHOOK_SECRET`)** :
   - Déclarez l'URL de réception des webhooks :
     ```text
     https://votre-domaine.com/api/webhooks/saspay
     ```
   - Sélectionnez les événements de paiement et de payout (`payment.success`, `payment.failed`, `payout.success`, `payout.failed`).
   - Copiez le secret de signature Webhook dans la variable `SASPAY_WEBHOOK_SECRET`.
   - *Rappel sécurité* : L'endpoint `/api/webhooks/saspay` vérifie la signature HMAC-SHA256 sur le corps brut (`rawBody`) via `X-Webhook-Signature` et rejette tout événement dont `X-Webhook-Timestamp` a plus de **300 secondes**.
3. **Whitelist de l'Adresse IP du Serveur (Obligatoire pour les Payouts)** :
   - Ajoutez l'adresse IPv4 publique fixe de votre serveur de production dans la liste blanche (**IP Whitelist**) du dashboard SasPay.
   - Sans cette étape, tout appel à `POST /payouts/initialize/` renverra `403 ip_not_whitelisted`.

---

## 5. Étape 4 — Variables d'Environnement de Production

Configurez les variables suivantes dans votre gestionnaire de secrets (Vercel Environment Variables, AWS Secrets Manager, ou fichier `.env.production` protégé par `chmod 600` sur VPS) :

```env
# ==============================================================================
# 1. URL PUBLIQUE DE L'APPLICATION
# ==============================================================================
NEXT_PUBLIC_APP_URL=https://votre-domaine.com

# ==============================================================================
# 2. SASPAY API (STRICTEMENT CÔTÉ BACKEND — NE JAMAIS PRÉFIXER PAR NEXT_PUBLIC_)
# ==============================================================================
SASPAY_BASE_URL=https://api.saspay.me/api/v1
SASPAY_SECRET_KEY=sk_live_votre_cle_secrete_saspay_production
SASPAY_WEBHOOK_SECRET=whsec_votre_secret_webhook_saspay_production

# ==============================================================================
# 3. SUPABASE (AUTH & POSTGRESQL)
# ==============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://votre-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ==============================================================================
# 4. CRON DE RÉCONCILIATION AUTOMATIQUE
# ==============================================================================
# Générer avec : openssl rand -hex 32
CRON_SECRET=votre_secret_cron_aleatoire_64_caracteres
```

> **Important (`AGENTS.md`)** : Ne commitez jamais `.env.local` ou `.env.production` dans Git. Vérifiez que `.env*` figure bien dans `.gitignore`.

---

## 6. Étape 5 — Déploiement du Serveur (2 Options au Choix)

### Option A — Déploiement sur un VPS / Serveur Dédié (Recommandé pour l'IP Fixe SasPay)

Un VPS (Ubuntu 22.04/24.04 LTS sur DigitalOcean, AWS EC2, Hetzner ou OVH) vous fournit nativement une **adresse IPv4 publique dédiée et fixe**, idéale pour la whitelist IP SasPay (`POST /payouts/initialize/`).

#### 1. Installer Node.js 20 LTS, PM2 et Nginx sur le serveur
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

#### 2. Cloner le dépôt et compiler l'application
```bash
cd /var/www
sudo git clone https://github.com/votre-org/apacci-exchange.git
cd apacci-exchange

# Créer et sécuriser le fichier .env.production
sudo nano .env.local
sudo chmod 600 .env.local

# Installer les dépendances et builder en mode production
npm ci
npm run build
```

#### 3. Démarrer avec PM2 (Process Manager avec redémarrage automatique)
```bash
pm2 start npm --name "apacci-exchange" -- start
pm2 save
pm2 startup
```

#### 4. Configurer Nginx en Reverse Proxy + Certificat SSL Let's Encrypt
Créez `/etc/nginx/sites-available/apacci-exchange` :
```nginx
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Activez le site et HTTPS :
```bash
sudo ln -s /etc/nginx/sites-available/apacci-exchange /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
```

#### 5. Configurer le Cron de Réconciliation Automatique (toutes les 5 minutes)
Ouvrez `crontab -e` sur le serveur et ajoutez :
```cron
*/5 * * * * curl -s -X GET "https://votre-domaine.com/api/cron/reconcile-transactions" -H "Authorization: Bearer VOTRE_CRON_SECRET" > /dev/null 2>&1
```

---

### Option B — Déploiement sur Vercel

Si vous déployez sur **Vercel** :

1. **Créer un fichier `vercel.json` à la racine** pour planifier le Cron de réconciliation des transactions :
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/reconcile-transactions",
         "schedule": "*/5 * * * *"
       }
     ]
   }
   ```
2. **Lier et déployer le projet avec Vercel CLI** :
   ```powershell
   npx.cmd vercel link
   npx.cmd vercel env add SASPAY_BASE_URL production
   npx.cmd vercel env add SASPAY_SECRET_KEY production
   npx.cmd vercel env add SASPAY_WEBHOOK_SECRET production
   npx.cmd vercel env add NEXT_PUBLIC_SUPABASE_URL production
   npx.cmd vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   npx.cmd vercel env add SUPABASE_SERVICE_ROLE_KEY production
   npx.cmd vercel env add NEXT_PUBLIC_APP_URL production
   npx.cmd vercel env add CRON_SECRET production

   # Déployer en production
   npx.cmd vercel --prod
   ```
3. **Important pour la Whitelist IP SasPay sur Vercel** :
   - Activez **Vercel Secure Compute / Static IPs** (ou passez les appels sortants SasPay via un proxy à IP fixe comme QuotaGuard / Fixie) et ajoutez cette IP fixe dans le dashboard SasPay afin d'éviter `403 ip_not_whitelisted` lors des payouts.

---

## 7. Étape 6 — Checklist de Vérification Post-Déploiement (Go-Live)

Une fois le déploiement terminé, validez chaque point ci-dessous :

- [ ] **1. Verrouillage Authentification & Dashboard (`/`)** :
  - Ouvrez `https://votre-domaine.com` en navigation privée (non connecté).
  - Vérifiez que le tableau de bord est verrouillé et que `/send`, `/transactions`, `/recipients`, `/profile` et `/admin` redirigent automatiquement vers `/login`.
- [ ] **2. Contrôle d'Accès Administrateur (`/admin` & `/api/admin`)** :
  - Connectez-vous avec un compte client standard (`role = 'client'`) et vérifiez que `/admin` affiche bien **HTTP 403 — Accès Réservé à l'Administrateur**.
  - Connectez-vous avec votre compte Super Admin (`role = 'admin'`) et vérifiez que `/admin` s'ouvre et affiche les 6 onglets CRUD.
- [ ] **3. Portail KYC Complet (Recto, Verso & Selfie)** :
  - Créez un nouveau compte client, soumettez la pièce d'identité (**Recto** + **Verso**) et le **Selfie** sur `/profile`.
  - Depuis le compte Admin (`/admin` → **Utilisateurs & KYC** → **Inspecter KYC**), prévisualisez les 3 photos en haute définition et approuvez le dossier (`verified`).
- [ ] **4. Test de Transfert Réel de Bout en Bout (Micro-montant)** :
  - Initiez un transfert test (ex. `1000.00` XOF) depuis `/send`.
  - Vérifiez dans `/admin` → **Transactions** et **Webhooks & Audit** que :
    1. Le paiement passe à `paid` après vérification `GET /payments/{payment_id}/verify/ === SUCCESS`.
    2. Le verrou atomique déclenche `POST /payouts/initialize/` une seule fois avec `Idempotency-Key`.
    3. Le statut final passe à `completed`.


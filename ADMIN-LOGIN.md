# Guide de Connexion Administrateur — Apacci Exchange (`ADMIN-LOGIN.md`)

Ce document explique comment vous connecter en tant qu'**Administrateur (`role = 'admin'`)** pour accéder au Back-Office complet (`/admin`) d'**Apacci Exchange**, aussi bien en **Mode Sandbox / Développement local** qu'en **Mode Production Supabase**.

---

## 1. Identifiants Administrateur par Défaut (Mode Sandbox / Local)

Lorsque l'application tourne en local (sans base Supabase externe ou en mode démonstration), un compte **Super Administrateur** est pré-configuré :

| Champ | Valeur |
| :--- | :--- |
| **URL de connexion** | `http://localhost:3000/login` (ou `http://localhost:3000/login?next=/admin`) |
| **URL du Back-Office** | `http://localhost:3000/admin` |
| **Nom complet** | `Kouassi Yao (Super Admin)` |
| **Email Administrateur** | `admin@apacci-exchange.com` |
| **Mot de passe principal** | `Admin@2026!` *(accepte aussi `admin123` ou `admin` en local)* |
| **Rôle (`role`)** | `admin` |
| **Statut KYC** | `verified` (Provisionné) |

---

## 2. Les 3 Méthodes pour se Connecter en tant qu'Admin

### Méthode A — Connexion en 1 Clic depuis `/login` (Le plus rapide)
1. Ouvrez `http://localhost:3000/login`.
2. Descendez jusqu'à la section **« Comptes de Connexion Rapide (RBAC Admin & Clients) »**.
3. Cliquez sur la première carte bleue :
   > **Kouassi Yao (Super Admin)** — `ROLE: ADMIN` (`admin@apacci-exchange.com`)
4. Vous êtes immédiatement authentifié avec un cookie de session HTTP-only (`apacci_session`) et redirigé vers **`http://localhost:3000/admin`**.

### Méthode B — Saisie manuelle du formulaire sur `/login`
1. Rendez-vous sur `http://localhost:3000/login`.
2. Sélectionnez l'onglet **Se connecter**.
3. Saisissez :
   - **Adresse email** : `admin@apacci-exchange.com`
   - **Mot de passe** : `Admin@2026!`
4. Cliquez sur **Se connecter**.
5. L'application détecte `user.role === "admin"`, affiche le badge **`SUPER ADMIN`** + l'onglet **`Admin`** dans la barre de navigation supérieure, et ouvre `/admin`.

### Méthode C — Bascule rapide depuis la page `/profile` (Mode Sandbox)
1. Rendez-vous sur `http://localhost:3000/profile`.
2. En haut à droite de la bannière d'identité, utilisez le menu déroulant **« Changer de profil démo (Tester le portail KYC) »**.
3. Sélectionnez **`Kouassi Yao (Super Admin) — [VERIFIED]`**.
4. Le cookie `apacci_session` est automatiquement mis à jour avec `role: "admin"` et l'onglet **Admin (`/admin`)** apparaît dans le menu.

---

## 3. Fonctionnement de la Sécurité & du Contrôle d'Accès (RBAC)

L'accès au tableau de bord administrateur est verrouillé sur **3 niveaux** :

1. **Barre de Navigation (`src/components/layout/AppShell.tsx`)** :
   - Le lien **Admin (`/admin`)** est masqué pour tous les utilisateurs ayant `role === "client"`.
   - Il n'apparaît que lorsque la session active possède `role === "admin"`.
2. **Protection de la Page (`src/app/admin/page.tsx`)** :
   - Si un client non-admin ou un visiteur non connecté accède directement à l'URL `http://localhost:3000/admin`, l'interface du Back-Office n'est **pas** affichée.
   - À la place, un écran de sécurité **« HTTP 403 — Accès Réservé à l'Administrateur »** s'affiche avec un bouton **« Se connecter en tant qu'Admin »** (`/login?next=/admin`).
3. **Protection de l'API Backend (`src/app/api/admin/route.ts`)** :
   - La fonction `resolveAdminContext()` vérifie systématiquement la session (`apacci_session` en mode Sandbox ou `supabase.auth.getUser()` + `public.profiles` en mode Supabase).
   - Si l'utilisateur n'est pas connecté : renvoie **`401 Unauthorized`**.
   - Si l'utilisateur est connecté avec un compte client (`role !== "admin"`) : renvoie **`403 Forbidden`**.

---

## 4. Comptes Clients de Test (pour vérifier le blocage 403 de `/admin`)

Sur `http://localhost:3000/login`, vous pouvez également tester les comptes clients pour vérifier qu'ils n'ont pas accès à `/admin` :

| Utilisateur | Email | Mot de passe | Rôle | Statut KYC | Accès `/admin` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Kouassi Yao** | `admin@apacci-exchange.com` | `Admin@2026!` | `admin` | `verified` | **Autorisé (`200 OK`)** |
| **Awa Konaté** (🇨🇮) | `awa.konate@example.ci` | `Client@2026!` | `client` | `verified` | **Bloqué (`403 Forbidden`)** |
| **Sipho Dlamini** (🇿🇦) | `sipho.dlamini@example.za` | `Client@2026!` | `client` | `pending` | **Bloqué (`403 Forbidden`)** |
| **Fatou Diallo** (🇸🇳) | `fatou.diallo@example.sn` | `Client@2026!` | `client` | `unverified` | **Bloqué (`403 Forbidden`)** + Portail KYC |

---

## 5. Configuration d'un Administrateur en Production (Supabase)

Lorsque les variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont configurées dans `.env.local` :

1. Créez d'abord votre compte utilisateur via `http://localhost:3000/login` (onglet **Créer un compte**) ou depuis le dashboard **Supabase Authentication**.
2. Ouvrez l'**Éditeur SQL (SQL Editor)** dans votre projet Supabase et exécutez la requête suivante pour attribuer le rôle `admin` à votre compte :

```sql
UPDATE public.profiles
SET
  role = 'admin',
  kyc_status = 'verified',
  kyc_provisioned = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'votre-email-admin@domaine.com'
);
```

3. Reconnectez-vous sur `/login` avec cet email et votre mot de passe : vous aurez immédiatement accès à `/admin` et à toutes les opérations CRUD (Transactions, Utilisateurs & KYC, Bénéficiaires, Wallets SasPay, Contenus CMS, Corridors & Taux FX, Paramètres).

---

## 6. Test de Connexion Admin en Ligne de Commande (PowerShell / API)

Vous pouvez tester l'authentification Admin et l'accès à `/api/admin` directement depuis PowerShell :

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# 1. Connexion en tant qu'Administrateur
Invoke-RestMethod -Uri "http://localhost:3000/api/auth" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"action":"signin","email":"admin@apacci-exchange.com","password":"Admin@2026!"}' `
  -WebSession $session

# 2. Appel authentifié au Back-Office (/api/admin)
Invoke-RestMethod -Uri "http://localhost:3000/api/admin" -WebSession $session
```


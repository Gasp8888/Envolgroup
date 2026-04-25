# Déploiement Envol — Guide Netlify + Railway/Render

L'app Envol est composée de **3 services** qui doivent être hébergés séparément :

```
┌─────────────────┐      ┌──────────────────┐      ┌────────────────┐
│  Netlify        │ ───> │  Railway/Render  │ ───> │ MongoDB Atlas  │
│  (React build)  │      │  (FastAPI)       │      │  (cluster M0)  │
└─────────────────┘      └──────────────────┘      └────────────────┘
```

---

## 1. MongoDB Atlas (base de données — gratuit)

1. Créer un compte sur https://www.mongodb.com/cloud/atlas/register
2. Créer un cluster **M0 (Free Tier)** — région la plus proche (ex: Paris)
3. Dans **Database Access** → "Add new database user" :
   - Username : `envol`
   - Password : génère un mot de passe sécurisé (sauvegarde-le !)
4. Dans **Network Access** → "Add IP Address" → cocher **"Allow access from anywhere"** (0.0.0.0/0)
5. Cliquer **Connect** → "Drivers" → copier la connection string :
   ```
   mongodb+srv://envol:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Remplacer `<password>` par le vrai mot de passe.

---

## 2. Backend FastAPI sur Railway (recommandé — gratuit 5$/mois inclus)

### 2.1. Préparer le dépôt
1. Pousse ton code sur GitHub via le bouton **"Save to GitHub"** d'Emergent.
2. Vérifie qu'il y a bien :
   - `/backend/requirements.txt`
   - `/backend/server.py`
3. Crée un fichier `/backend/Procfile` :
   ```
   web: uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
4. Crée un fichier `/backend/runtime.txt` :
   ```
   python-3.11
   ```

### 2.2. Déployer sur Railway
1. Crée un compte sur https://railway.app (login GitHub)
2. **New Project** → **Deploy from GitHub repo** → sélectionne ton repo Envol
3. Railway détecte le projet Python automatiquement.
4. Dans **Settings** → **Root Directory** : mets `backend`
5. Dans **Variables** (onglet Variables) → ajoute toutes ces variables :
   ```
   MONGO_URL          mongodb+srv://envol:xxx@cluster0.xxxx.mongodb.net/
   DB_NAME            envol_prod
   CORS_ORIGINS       https://envol.netlify.app,https://www.tonsite.fr
   EMERGENT_LLM_KEY   sk-emergent-019D57286D0F2AdAaE
   JWT_SECRET         <génère 64 caractères aléatoires>
   STRIPE_API_KEY     sk_live_xxx (ou sk_test_xxx pour le test)
   ADMIN_EMAIL        admin@envol.com
   ADMIN_PASSWORD     <ton mot de passe admin sécurisé>
   ```
6. Dans **Settings** → **Networking** → **Generate Domain** → tu obtiens une URL du type :
   `https://envol-backend-production.up.railway.app`
7. Teste : `https://envol-backend-production.up.railway.app/api/` doit retourner `{"message":"Envol API"}`

> **Alternatives gratuites** : [Render.com](https://render.com) (gratuit avec sleep après 15min), [Fly.io](https://fly.io) (3 VM gratuites), [Koyeb](https://koyeb.com) (1 service gratuit).

### 2.3. Installer la dépendance emergentintegrations sur Railway
La librairie `emergentintegrations` est sur un dépôt privé. Sur Railway, ajoute dans `requirements.txt` :
```
--extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
emergentintegrations==0.1.0
```
Si Railway refuse l'index custom, tu peux remplacer Claude par une intégration directe :
```
anthropic>=0.40.0
stripe>=11.0.0
```
Et adapter `server.py` pour utiliser `anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)` directement.

---

## 3. Frontend React sur Netlify

### 3.1. Préparer le frontend
1. Dans `/frontend/.env.production` (à créer), mets :
   ```
   REACT_APP_BACKEND_URL=https://envol-backend-production.up.railway.app
   ```
2. Crée `/frontend/netlify.toml` :
   ```toml
   [build]
     base = "frontend"
     command = "yarn build"
     publish = "frontend/build"

   [build.environment]
     CI = "false"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

### 3.2. Déployer
1. Crée un compte sur https://netlify.com (login GitHub)
2. **Add new site** → **Import an existing project** → GitHub → sélectionne ton repo
3. Configuration :
   - Base directory : `frontend`
   - Build command : `yarn build`
   - Publish directory : `frontend/build`
4. **Environment variables** (Site configuration → Environment variables) :
   ```
   REACT_APP_BACKEND_URL = https://envol-backend-production.up.railway.app
   CI = false
   ```
5. **Deploy site** → ~2min plus tard, tu as ton URL : `https://envol-xxxxx.netlify.app`
6. (Optionnel) **Domain settings** → Add custom domain → `envol.fr` ou autre

### 3.3. Mettre à jour le CORS du backend
Retourne sur Railway → Variables → mets à jour :
```
CORS_ORIGINS=https://envol-xxxxx.netlify.app,https://envol.fr
```
Redémarre le backend.

---

## 4. Stripe Live mode (paiements réels)

1. Sur https://dashboard.stripe.com → bascule en mode **Live** (toggle en haut à droite)
2. **Developers → API keys → Reveal live secret key** → copie la clé `sk_live_xxx`
3. Sur Railway → Variables → remplace `STRIPE_API_KEY` par `sk_live_xxx`
4. **Webhooks** :
   - Stripe Dashboard → Developers → Webhooks → Add endpoint
   - URL : `https://envol-backend-production.up.railway.app/api/webhook/stripe`
   - Events : `checkout.session.completed`
   - Copie le **Signing secret** (whsec_xxx) → ajoute sur Railway en variable `STRIPE_WEBHOOK_SECRET`

---

## 5. Stockage fichiers (photos profil + documents)

⚠️ **Important** : Railway et Render n'ont pas de stockage persistant gratuit. Les fichiers uploadés (`/app/backend/uploads/`) sont perdus à chaque redéploiement.

**Solution recommandée : Cloudinary** (gratuit jusqu'à 25Go)
1. Compte sur https://cloudinary.com
2. Récupère `CLOUD_NAME`, `API_KEY`, `API_SECRET`
3. Demande à Emergent d'intégrer Cloudinary dans le code (ça remplacera le stockage local par des URLs Cloudinary persistantes)

---

## 6. Email pour reset password

Le backend retourne actuellement le token de reset directement (mode DEV). Pour la prod, brancher un service email :

**Option A — Resend** (3000 emails gratuits/mois) :
1. Compte sur https://resend.com
2. Vérifier ton domaine
3. Récupérer la clé API
4. Demander à Emergent d'intégrer Resend (le code remplacera la ligne `logger.info(token)` par un envoi email)

**Option B — SendGrid** (100 emails/jour gratuits)

---

## 7. Checklist finale avant production

- [ ] MongoDB Atlas cluster créé + IP whitelist
- [ ] Backend Railway déployé + URL active (`/api/` répond)
- [ ] Frontend Netlify déployé + `REACT_APP_BACKEND_URL` pointe sur Railway
- [ ] CORS_ORIGINS du backend inclut le domaine Netlify
- [ ] Variables d'env Railway toutes définies (MONGO_URL, JWT_SECRET, EMERGENT_LLM_KEY, STRIPE_API_KEY, ADMIN_EMAIL/PASSWORD)
- [ ] JWT_SECRET changé (pas la valeur par défaut !)
- [ ] ADMIN_PASSWORD changé (pas `admin2026` !)
- [ ] Stripe en mode Live + webhook configuré
- [ ] Cloudinary intégré pour photos / documents persistants
- [ ] Email service intégré pour reset password
- [ ] Test complet : register → onboarding → checkout Stripe → admin

---

## Coût total estimé (mensuel)

| Service | Free tier | Coût |
|---|---|---|
| MongoDB Atlas M0 | 512Mo | **0€** |
| Railway | 5$ inclus | **0€** (jusqu'à ~5k visiteurs) |
| Netlify | 100Go bandwidth | **0€** |
| Cloudinary | 25Go | **0€** |
| Resend | 3000 emails/mois | **0€** |
| Stripe | Pay per transaction | **2.9% + 0.25€ par paiement** |
| **TOTAL** | | **~0€/mois jusqu'à ~10k users** |

Au-delà : Railway ~5-20€/mois, MongoDB ~9$/mois (M2).

---

## Aide

Si quelque chose coince :
- Logs Railway : Railway dashboard → ton service → onglet "Deployments" → "View Logs"
- Logs Netlify : Netlify dashboard → ton site → onglet "Deploys" → cliquer un deploy → logs
- Erreur CORS : vérifier que `CORS_ORIGINS` du backend contient bien le domaine du frontend
- Erreur 404 sur les routes React (ex: `/admin`) : vérifier que `netlify.toml` a bien la redirection `/* → /index.html`

# Envol - PRD

## Original Problem Statement (FR)
Plateforme d'incubation Envol pour 15-25 ans. Phase 1 : MVP avec sidebar 8 items + bulle IA + onboarding 10 questions Claude. Phase 2 : design premium, cockpit, post-its, projet enrichi, documents, admin, Stripe. **Phase 3** (Jan 2026) : logo Envol intégré, 2e admin Gaspard, "Qui sommes-nous", animations CountUp+Reveal, lucide-react icons, photo de profil, reset password, vraies vidéos formations, calendrier full-month, toasts.

## Architecture
- **Frontend** : React, axios, lucide-react icons, fonts Fraunces + Outfit, design or/lavande/dark
- **Backend** : FastAPI + MongoDB + JWT + bcrypt + emergentintegrations (Claude + Stripe)
- **Storage** : MongoDB (users, onboardings, projects, postits, events, resources, documents, payment_transactions, password_resets) + filesystem `/app/backend/uploads/<user_id>/`
- **AI** : Claude Sonnet 4.5 via Emergent LLM Key
- **Payments** : Stripe TEST mode

## Implementation status

### Phase 1 (MVP)
- [x] Auth JWT + bcrypt, register/login, /auth/me
- [x] Landing avec orbes, hero, features
- [x] Onboarding 10 questions → Claude → analyse JSON + score/100 + 4 sections
- [x] Dashboard 8 items: Vue d'ensemble · Formations · Missions · Mon projet · Suivi & Experts · Ressources · Chat · Mon profil
- [x] AI Bubble Claude flottante

### Phase 2 (extension)
- [x] Cockpit complet (score+sparkline, status stepper, post-its or/bleu, événements)
- [x] Post-its bidirectionnels (admin or, user bleu, badge "Nouveau")
- [x] Mon projet enrichi (pitch, objectifs, roadmap timeline, statut)
- [x] Profil sub-tabs (Profil & Projet · Documents) avec upload local
- [x] Espace Admin sécurisé (4 sections: users, events, resources, postits)
- [x] Stripe TEST mode (Bronze 49€/Silver 99€/Gold 199€) avec checkout + webhook
- [x] Feature gating par plan (modules, experts, ressources, événements)
- [x] Missions XP/level, Formations parcours

### Phase 3 (finitions premium)
- [x] **Logo Envol** intégré (`/assets/logo.png`) en landing, sidebar, footer, admin
- [x] **2e admin** : `gaspard.boachon@gmail.com / Stranger747!` (auto-seedé)
- [x] **"Qui sommes-nous"** : team Léo (or) + Gaspard (lavande), mission, 3 valeurs
- [x] **Animations** : CountUp (chiffres animés au scroll), Reveal (apparition progressive), transitions fluides
- [x] **Icons unifiés** : lucide-react partout (sidebar, admin, features), plus d'emojis
- [x] **Photo de profil** : POST /api/profile/photo (UploadFile png/jpg/webp), GET /api/profile/photo/{user_id}, overlay caméra cliquable
- [x] **Reset password** : flow complet `/auth/request-reset` → token (DEV: retourné directement) → `/auth/reset-password` (revoque le token après usage). Anti-enumeration. Lien depuis modal connexion.
- [x] **Vraies vidéos formations** : GET /api/formations retourne 5 modules avec `video_url` (YouTube embeds), `lessons` array, modal player avec iframe responsive
- [x] **Calendar full-month** : grille 7 colonnes avec navigation mois ‹ ›, dots sur jours avec événements, popover avec liste des évents du jour
- [x] **Toasts** : remplace `alert()`, success/info, animations soft
- [x] **GET /api/about** : team + mission + values (servi à la landing)

## Tests
- Phase 1 : 100% backend + 100% frontend
- Phase 2 : 97% → 100% backend (33/34 → fix appliqué) + 100% frontend
- Phase 3 : **100% backend (45/45)** + ~95% frontend (1 fix appliqué après testing : data-testid sur tous les modules formations + boutons Débloquer/Regarder)

## Backlog / Future
- P1: Vrai email pour reset password (Resend ou SendGrid)
- P1: Realtime chat (websocket) - actuellement chat statique + bulle IA Claude
- P1: Push notifications navigateur
- P2: Stripe Live mode (juste switch de la clé)
- P2: Webhook signature verification renforcée
- P2: Netlify deploy guide
- P2: Cloudinary pour stockage cloud des fichiers
- P3: Splitter server.py en routers/auth.py, routers/formations.py, etc. (730 lignes)

## Notes opérationnelles
- Token JWT 30j dans localStorage (`envol_token`)
- Reset token JWT 1h dans `db.password_resets` + flag `used`
- Photos profil overwriteables (par extension), avatar.{ext}
- Calendrier filtré par plan utilisateur (events.plan_required)
- Mobile responsive : sidebar 70px sur < 900px, logo affiché seul
- Stripe Live : remplacer `STRIPE_API_KEY` dans `.env` par `sk_live_xxx`

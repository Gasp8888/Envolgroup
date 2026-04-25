# Envol - PRD

## Original Problem Statement (FR)
Plateforme d'incubation Envol pour 15-25 ans. **Phase 1** (Jan 2026) : sidebar 8 items + bulle IA + onboarding 10 questions avec analyse Claude (score, points forts/vigilance/négatifs/améliorations). **Phase 2** (Jan 2026) : design premium V2, cockpit complet (post-its, calendrier, statut projet, sparkline), Mon projet enrichi (pitch/objectifs/roadmap), Profil & Documents (upload), Espace Admin sécurisé, Stripe abonnements 3 tiers avec gating de features.

## Architecture
- **Frontend** : React (CRA + craco), modular files (App / Landing / Onboarding / Dashboard / Admin / api), axios, design or/lavande/dark (Fraunces + Outfit fonts)
- **Backend** : FastAPI + MongoDB (motor) + JWT + bcrypt + emergentintegrations (Claude + Stripe)
- **AI** : Claude Sonnet 4.5 (anthropic claude-sonnet-4-5-20250929) via Emergent LLM Key
- **Payments** : Stripe TEST mode (sk_test_emergent) via emergentintegrations.payments.stripe.checkout
- **Storage** : MongoDB collections (users, onboardings, projects, postits, events, resources, documents, payment_transactions) + local filesystem `/app/backend/uploads/<user_id>/`

## User Personas
- Jeune entrepreneur 15-25 ans (de l'idée au lancement)
- Admin Envol (Léo, Gaspard) qui gère contenus, événements, post-its

## What's been implemented

### Phase 1 (initial MVP)
- [x] Auth: register/login/JWT, bcrypt, /api/auth/me
- [x] Landing avec orbes lumineuses, hero, features
- [x] Onboarding 10 questions → Claude → analyse JSON + score/100
- [x] AnalysisResult: cercle animé + 4 sections colorées (vert/orange/rouge/or)
- [x] Dashboard 8 items: Vue d'ensemble · Formations · Checklist · Mon projet · Suivi & Experts · Ressources · Chat · Mon profil
- [x] AI Bubble (Claude) flottante

### Phase 2 (extension)
- [x] **Landing V2 premium** : hero impactant, features-grid 8 cards, pricing 3 tiers, footer
- [x] **Cockpit Vue d'ensemble** : score circle + sparkline (historique scores), status stepper 4 étapes (Idée/Développement/Lancement/Croissance), grille de post-its (or admin / bleu user), liste calendrier événements à venir, progression formation, prochaine étape IA
- [x] **Post-its système** : POST/GET/DELETE /api/postits, badge "Nouveau" sur post-its admin non lus, mark-read au clic, post-its admin = doré, post-its user = bleu
- [x] **Mon projet enrichi** : pitch (textarea), statut (segmented control), objectifs (liste add/remove), roadmap (phases avec timeline), persisté via /api/project
- [x] **Profil sub-tabs** : "Profil & Projet" (info utilisateur + résumé projet) + "Documents" (upload par catégorie, prévisualisation, download, delete) — stockage local
- [x] **Formations parcours** : path linéaire avec lock par plan (Silver+ pour modules 4-5)
- [x] **Missions** (ex-Checklist) : XP/niveau, missions IA + génériques, progress bar
- [x] **Espace Admin** : seeded admin@envol.com / admin2026 (Gold + onboarded), AdminLogin séparé, AdminDashboard avec 4 tabs : Utilisateurs (table avec score/projet/statut), Événements (CRUD avec plan_required), Ressources (CRUD), Post-its (envoi à utilisateur ciblé)
- [x] **Stripe TEST mode** : 3 plans Bronze (49€) / Silver (99€) / Gold (199€), POST /api/checkout/session, GET /api/checkout/status, POST /api/webhook/stripe, payment_transactions collection, plan upgrade automatique après paiement, polling côté frontend après redirect
- [x] **Feature gating par plan** : ressources, événements, modules formations, experts filtrés selon plan utilisateur
- [x] **Plan pill sidebar** : visible en bas, ouvre UpgradeModal avec pricing comparé

### Tests
- Phase 1 : 100% backend + 100% frontend
- Phase 2 : 97% backend (33/34) + 100% frontend — fix appliqué pour 500→404 sur checkout/status

## Backlog / Future
- P1: Real videos in formations modules
- P1: Realtime chat (websocket) pour communauté
- P1: Webhook Stripe vérifié (signature) sur la prod
- P2: Reset password par email + confirmation email
- P2: Upload photo profil (Cloudinary)
- P2: Calendar view full month (à la Google Calendar)
- P2: Notifications push / email
- P2: Mindmap interactive (présent dans HTML v10)
- P3: Système de badges/achievements pour les missions
- P3: Stats personnelles temporelles (graphes mensuels)

## Notes
- Token JWT 30 jours dans localStorage (envol_token)
- Admin login : `/admin` ou `#admin` ou clic logo ENVOL
- Stripe test : aucun vrai paiement, redirige vers sandbox
- Tous les data-testid présents

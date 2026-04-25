# Envol - PRD

## Original Problem Statement (FR)
Refondre l'app Envol pour que la sidebar comporte UNIQUEMENT : Vue d'ensemble, Formations, Checklist, Mon projet, Suivi & Experts, Ressources, Chat, Mon profil. Garder la bulle IA flottante. Ajouter à la création de compte un grand questionnaire d'onboarding qui produit une analyse du projet : score sur 100, points forts (vert), vigilance (orange), points négatifs (rouge), et liste numérotée d'améliorations concrètes. Chaque réponse impacte le score différemment.

## Architecture
- Frontend: React (CRA + craco), single App.js, axios, design or/lavande/dark (Fraunces + Outfit fonts)
- Backend: FastAPI + MongoDB (motor) + JWT auth + bcrypt
- AI: Claude Sonnet 4.5 (anthropic claude-sonnet-4-5-20250929) via emergentintegrations + EMERGENT_LLM_KEY
- Collections MongoDB: users, onboardings, projects

## User Personas
- Jeune entrepreneur 15-25 ans avec une idée à valider/structurer
- Membre Envol qui suit formations + checklist + RDV experts

## Core Requirements (static)
- 8 menu items sidebar exactement : overview, formations, checklist, project, experts, resources, chat, profile
- Bulle IA flottante toujours accessible dans le dashboard
- Onboarding 10 questions (idée, problème, cible, stade, concurrence, modèle économique, équipe, budget, temps, motivation) → analyse Claude → score + 4 sections
- Persistance Mongo de toutes les données utilisateur

## What's been implemented (2026-01)
- [x] Auth: register/login/JWT (/api/auth/register, /api/auth/login, /api/auth/me)
- [x] Landing page (hero gold/dark + features grid + auth modal)
- [x] Onboarding 10 questions (textarea / text / select) avec progress bar
- [x] /api/onboarding/submit → Claude Sonnet 4.5 → JSON {score, score_reason, points_forts, points_vigilance, points_negatifs, ameliorations}
- [x] AnalysisResult: cercle de score animé + 4 sections colorées + plan d'action numéroté
- [x] Dashboard sidebar avec 8 items (data-testid: nav-overview, nav-formations, nav-checklist, nav-project, nav-experts, nav-resources, nav-chat, nav-profile)
- [x] Vue d'ensemble: score circle + progression formation + CTA projet
- [x] Formations: 5 modules avec progress bars
- [x] Checklist: combine actions IA générées + actions génériques (cliquables)
- [x] Mon projet: formulaire complet sauvegardé via /api/project
- [x] Suivi & Experts: liste avocats/comptable/banque
- [x] Ressources: 6 templates
- [x] Chat: stream messages basique
- [x] Mon profil: édition prénom/nom/ville/age/linkedin/social/bio
- [x] AI Bubble (Claude Sonnet 4.5) flottante avec panel chat
- [x] Tests E2E : 100% backend + 100% frontend

## Backlog / Future
- P1: Vraies vidéos pour les modules de formation
- P1: Vrai chat realtime (websocket) entre membres
- P1: Stripe pour upgrade Bronze→Silver→Gold
- P2: Mindmap interactive (présente dans v10 HTML)
- P2: Analyse re-rentable depuis le profil + comparaison historique
- P2: Email reset mot de passe
- P2: Upload photo profil
- P2: Section admin pour Léo & Gaspard

## Notes
- Claude analyse en ~10-15s, fallback prévu en cas d'échec API
- Token JWT 30 jours dans localStorage (envol_token)
- Tous les data-testid présents pour testabilité automatique

# WPlace Starter (10,000 × 10,000)

Monorepo prêt à l'emploi pour un mur de pixels collaboratif avec :
- **Next.js 14** (app router) + **NextAuth** (Google/Apple/Credentials) — comptes obligatoires
- **Canvas** à **chunks** (virtualisation) pour une grille **10000×10000**
- **Socket.IO** temps réel
- **PostgreSQL + Prisma** (utilisateurs, placements, crédits)
- **Redis** (cooldown, pub/sub)
- **Boutique** avec **Stripe Checkout** (test) pour acheter des **crédits** de pixels
- Mode **DEV** sans Stripe pour créditer des comptes rapidement

## Vue d'ensemble

- `apps/web` : Front Next.js (auth, canvas, boutique).
- `apps/api` : API Node/Express + Socket.IO (cooldown, placements, crédits, webhooks Stripe).
- `docker-compose.yml` : Postgres + Redis + services web/api.
- `packages/shared` : Types partagés.

## Démarrage rapide (DEV)
1. **Prérequis** : Docker + Node 18+.
2. Copier `.env.example` vers `.env` à la racine, `apps/web/.env.local`, `apps/api/.env` et compléter.
3. Lancer :

```bash
docker compose up -d postgres redis
cd apps/api && npm i && npx prisma migrate dev && npm run dev
# dans un autre terminal
cd apps/web && npm i && npm run dev
```

- Web: http://localhost:3000
- API/WS: http://localhost:3001 (WS à ws://localhost:3001)

## Auth (obligatoire)
- Google/Apple (mettre les clés dans `apps/web/.env.local`)
- En DEV, **Credentials** est activé : crée un compte sur `/auth/dev-register`.

## Boutique
- **DEV sans Stripe** : sur `/shop`, bouton **"Ajouter 1 000 crédits (DEV)"** crédite le compte via l’API (sans paiement).
- **Stripe (optionnel)** :
  - Définir `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SMALL`, `STRIPE_PRICE_LARGE` dans `apps/web/.env.local` et `apps/api/.env`.
  - Lancer Stripe CLI : `stripe listen --forward-to localhost:3001/webhooks/stripe`.
  - Les crédits sont ajoutés à la réception du webhook `checkout.session.completed`.

## Grille & perfs
- Taille **10000×10000** gérée par **chunks 256×256**.
- Rendu **lazy** selon le viewport (zoom/déplacements).
- Diffusion temps réel par pixel.
- **Cooldown** par utilisateur (configurable), anti-flood de base.

## Snapshots
- Endpoint `/admin/snapshot` (TODO prod) — écrit un PNG et/ou un buffer binaire par chunk.
- Pour DEV, on garde l’état en mémoire + Redis; Postgres stocke l’historique minimal.

## Sécurité
- Ce projet est un **starter**. Avant prod : durcir CORS, tokens signés, rate limiting IP, hCaptcha/Turnstile, modération, tests.

---


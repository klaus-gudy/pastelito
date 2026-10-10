# Pastelito

> A bookkeeping and inventory app for small perfume retailers: sales, preorders, stock, customers, profit and capital, all in one place.

[![Trivy security scan](https://github.com/klaus-gudy/pastelito/actions/workflows/trivy.yml/badge.svg)](https://github.com/klaus-gudy/pastelito/actions/workflows/trivy.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-required-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange)](LICENSE)

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start with Docker](#quick-start-with-docker)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment variables](#environment-variables)
  - [Database setup](#database-setup)
  - [Running the app](#running-the-app)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [How the ledger works](#how-the-ledger-works)
- [Security](#security)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Overview

Pastelito answers the everyday questions of a small retail business:

- How much money is in cash, unsold stock and customer debts?
- What did I sell, to whom, and for how much?
- Who is waiting on a preorder, and have they paid a deposit?
- Which products sell most, and what should I restock?
- After paying for the stock, how much did each sale earn?
- Who contributed capital, and how much is still owed?

Every account keeps its own books. Stock levels, debts, profit and cash are always derived from the underlying records rather than stored, so the figures stay consistent. Amounts are shown in Tanzanian shillings (TZS).

## Features

| Area | What it does |
| --- | --- |
| **Overview** | Cash on hand, stock value at average cost and outstanding customer debts at a glance. |
| **Business health** | Key ratios (margin, collection rate, sales trend, stock days, capital payback, overdue debt, repeat buyers, preorder wait) judged against targets you can adjust. |
| **Sales** | Record sales with per-item brand and price, discounts and partial payments (installments) by cash, bank transfer, mobile money or card. |
| **Preorders** | Take orders before stock arrives, collect deposits, deliver or cancel them, and see which products to buy to fill every open order. |
| **Customers** | Customer profiles with purchase timeline, payments and balances. Deleting a customer hides them but keeps their sales history. |
| **Products** | Products per size, selling and buying prices, stock on hand and weighted average cost. |
| **Purchases** | Supplier orders as drafts, received into stock, or cancelled, with a full stock-movement audit trail. |
| **Profit** | Gross profit per sale, using the item cost captured at the moment of sale. |
| **Capital** | Money received from owners, investors or loans, repayments, and what remains outstanding. |
| **Accounts** | Email and password sign-up with email verification, password reset, and optional Google sign-in. |
| **Interface** | Responsive layout with mobile card views, plus light and dark themes. |

## Tech stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router, Server Actions) and React 19
- **Language:** TypeScript 5
- **Database:** PostgreSQL via [Prisma 7](https://www.prisma.io) with the `pg` driver adapter
- **Authentication:** [Auth.js (NextAuth v5)](https://authjs.dev) with credentials and Google providers, database-backed sessions
- **Validation:** [Zod 4](https://zod.dev)
- **UI:** Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com), Radix UI / Base UI, Lucide icons, Recharts
- **Email:** Nodemailer over SMTP
- **Containers:** Docker and Docker Compose, with Mailpit as a local email inbox
- **CI:** GitHub Actions with [Trivy](https://trivy.dev) security scanning

## Quick start with Docker

The fastest way to run Pastelito. You only need [Docker](https://docs.docker.com/get-docker/) with Docker Compose; Node.js and PostgreSQL run inside containers.

1. Clone the repository:

   ```bash
   git clone https://github.com/klaus-gudy/pastelito.git && cd pastelito
   ```

2. Create a `.env` file with a session secret:

   ```bash
   echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
   ```

3. Build and start everything:

   ```bash
   docker compose up -d --build
   ```

4. Open [http://localhost:3090](http://localhost:3090) and create an account. Your verification email arrives in the local inbox at [http://localhost:8025](http://localhost:8025).

Compose starts four services:

| Service | Purpose |
| --- | --- |
| `db` | PostgreSQL 17. Data is kept in the `db-data` volume across restarts and rebuilds. |
| `migrate` | Applies database migrations, then exits. Runs before the app on every start. |
| `app` | The Pastelito production server on port 3090. |
| `mailpit` | Catches every email the app sends and shows it at port 8025. Nothing leaves your machine. |

Optional settings, all read from `.env`:

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_SECRET` | — (required) | Secret used to sign session cookies. |
| `APP_URL` | `http://localhost:3090` | Public URL of the app, used in email links. Changing it requires `--build`. |
| `APP_PORT` | `3090` | Host port for the app. |
| `MAILPIT_PORT` | `8025` | Host port for the email inbox. |
| `POSTGRES_PASSWORD` | `pastelito` | Database password. Change it before the first start on a shared machine. |
| `EMAIL_SERVER` / `EMAIL_FROM` | Mailpit | Set an SMTP URL to deliver emails for real. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | empty | Enables Google sign-in. |

Useful commands:

```bash
docker compose logs -f app
```

```bash
docker compose down
```

```bash
docker compose down -v
```

`docker compose down` stops the containers and keeps your data; adding `-v` also **deletes the database**.

## Getting started

This section covers running Pastelito directly on your machine, which is best for development.

### Prerequisites

- [Node.js](https://nodejs.org) 20 or later (developed on Node 24) and npm
- [PostgreSQL](https://www.postgresql.org) 14 or later, running locally or reachable over the network
- Optional: an SMTP account for sending email, and a Google OAuth client for Google sign-in

### Installation

```bash
git clone https://github.com/klaus-gudy/pastelito.git
```

```bash
cd pastelito
```

```bash
npm install
```

`npm install` also runs `prisma generate`, which writes the Prisma client to `lib/generated/prisma`.

### Environment variables

Copy the template and fill in the values:

```bash
cp .env.template .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the app, used in links sent by email. Defaults to `http://localhost:3090`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://USER:PASSWORD@localhost:5432/pastelito?schema=public`. |
| `AUTH_SECRET` | Yes | Secret used to sign session cookies. Generate one with `npx auth secret` or `openssl rand -base64 32`. |
| `AUTH_URL` | Production | The site's public URL so Auth.js trusts the host (or set `AUTH_TRUST_HOST=true` behind a trusted proxy). |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | No | Google OAuth credentials. When empty, the Google sign-in button is hidden. Redirect URI: `<APP_URL>/api/auth/callback/google`. |
| `EMAIL_SERVER` | No | SMTP URL, e.g. `smtp://USER:PASSWORD@smtp.example.com:587`. In development, emails are printed to the console when this is empty. |
| `EMAIL_FROM` | No | Sender address for verification and password reset emails. |

> `.env` is gitignored. Never commit real secrets.

### Database setup

Create the database, then apply the migrations:

```bash
createdb pastelito
```

```bash
npx prisma migrate deploy
```

During development, use `npx prisma migrate dev` after changing `prisma/schema.prisma` to create a new migration. To browse the data:

```bash
npm run db:studio
```

### Running the app

```bash
npm run dev
```

Open [http://localhost:3090](http://localhost:3090) and create an account. The port is pinned in `package.json`; to use another one for a single run:

```bash
npm run dev -- -p 4000
```

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server on port 3090. |
| `npm run build` | Create an optimized production build. |
| `npm run start` | Serve the production build on port 3090. |
| `npm run lint` | Run ESLint. |
| `npm run db:studio` | Open Prisma Studio on port 5555. |

## Project structure

```text
pastelito/
├── app/
│   ├── (app)/            # Signed-in pages: overview, sales, preorders, customers,
│   │                     # products, purchases, profit, capital, health
│   ├── (auth)/           # Sign-in, sign-up, forgot and reset password
│   ├── api/auth/         # Auth.js route handlers
│   └── verify-email/     # Email verification link handler
├── components/           # Feature components, grouped by area, plus shadcn/ui in ui/
├── hooks/                # Shared React hooks
├── lib/
│   ├── actions/          # Server Actions (mutations)
│   ├── validations/      # Zod schemas for every form
│   ├── ledger.ts         # Transactional stock, cost and status updates
│   ├── reports.ts        # Read-only figures derived from the ledger
│   ├── health.ts         # Business-health indicators and targets
│   └── ...               # Auth helpers, email, rate limiting, formatting
├── prisma/
│   ├── schema.prisma     # Data model
│   └── migrations/       # SQL migrations
├── auth.ts               # Auth.js configuration
├── Dockerfile            # Production image and migration image
├── docker-compose.yml    # App, database, migrations and Mailpit
├── proxy.ts              # Route protection and Content Security Policy
└── .github/workflows/    # CI (Trivy security scan)
```

## How the ledger works

- **Purchases** add stock when received and update each product's **weighted average cost**.
- **Sales** remove stock and record the item's average cost at the moment of sale, so profit stays correct when costs change later.
- **Preorders** reserve demand without touching stock; on delivery they become completed sales.
- **Payments** can be split into installments. A sale's balance is its total minus its payments.
- **Capital** entries are either money received or repaid; outstanding capital is received minus repaid.
- Every stock change is written to a **stock movement** audit trail.
- Writes run in serializable transactions and are retried on conflicts, so concurrent edits can't leave stock or cash inconsistent.

## Security

- Passwords are hashed with bcrypt; sign-in takes the same time whether or not an account exists.
- Sessions are recorded in the database, so signing out or resetting a password ends them immediately.
- Sign-in, sign-up and password reset are rate limited per email and per IP address, shared across server instances.
- A per-request nonce-based Content Security Policy blocks inline scripts.
- All data access is scoped to the signed-in user.
- Every push, pull request and a weekly schedule run a [Trivy](https://trivy.dev) scan for vulnerable dependencies, leaked secrets and misconfigurations.

To report a vulnerability, please contact the maintainer privately rather than opening a public issue.

## Deployment

Pastelito runs on any platform that supports Node.js and PostgreSQL (for example Vercel, Railway or a VPS), or anywhere that runs Docker containers.

**With Docker:** build the image with `docker build --build-arg NEXT_PUBLIC_APP_URL=https://your-domain -t pastelito .`, run the `migrate` target (`docker build --target migrate`) against your database before each release, and set the variables from steps 1 and 2 below on the container. Put a reverse proxy with HTTPS in front of port 3090.

**Without Docker:**

1. Provision a PostgreSQL database and set `DATABASE_URL`.
2. Set `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL` and, if used, the email and Google variables.
3. Apply migrations with `npx prisma migrate deploy`.
4. Build and start with `npm run build` and `npm run start`.

If you use Google sign-in, add your production callback URL (`https://your-domain/api/auth/callback/google`) to the OAuth client.

## Contributing

1. Create a branch from `main`.
2. Make your changes and run `npm run lint` and `npm run build`.
3. Write commit messages in [Conventional Commits](https://www.conventionalcommits.org) style, e.g. `feat: add expense tracking` or `fix: round totals to whole shillings`.
4. Open a pull request describing the change.

> This project uses a recent Next.js release with breaking changes. Check the bundled docs in `node_modules/next/dist/docs/` before relying on older conventions.

## License

Pastelito is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE).

- **Free** for personal use, study, research, hobby projects, and use by charities, schools and other noncommercial organizations.
- **Not permitted** without a separate agreement: any commercial use, including running Pastelito for a business, selling it, or offering it as a hosted service.

For a commercial license, contact the maintainer through [GitHub](https://github.com/klaus-gudy).

Copyright © 2026 Goodluck Madadi ([@klaus-gudy](https://github.com/klaus-gudy)).

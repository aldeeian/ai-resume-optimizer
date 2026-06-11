# AI Resume Optimizer

A SaaS-style web application that helps students tailor their master resume to specific
job descriptions — truthfully and in an ATS-compliant way.

Upload a master resume, paste a job description, and the system analyzes the posting,
ranks your experiences and projects by relevance, flags missing skills, generates a
keyword-optimized tailored resume (no fabricated experience), scores it against the job,
and tracks your applications.

## Monorepo Layout

```
.
├── web/          Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui, Prisma, Clerk)
├── ai-service/   FastAPI microservice (Python 3.12, Anthropic Claude API)
└── docs/         Architecture, database design, API contracts, roadmap
```

## Features

| # | Feature | Where |
|---|---------|-------|
| 1 | Authentication (sign up / in / out, protected data) | Clerk + Next.js middleware |
| 2 | Resume upload (PDF / DOCX / TXT) + automatic parsing | `web` extraction → `ai-service` structuring |
| 3 | Job description analysis (skills, keywords, responsibilities) | `ai-service` `/job/analyze` |
| 4 | Experience ranking engine (match % + reasoning) | `ai-service` `/rank` |
| 5 | Project ranking engine (matched tech + skills) | `ai-service` `/rank` |
| 6 | Missing skills analysis | deterministic TS + LLM normalization |
| 7 | ATS resume generator (truthful, human-sounding) | `ai-service` `/generate` |
| 8 | ATS score engine (0–100 with breakdown) | deterministic TS engine in `web` |
| 9 | Resume comparison (diff, added keywords, removed content) | `web` |
| 10 | Application tracker | `web` (Server Actions + React Query) |
| 11 | Analytics dashboard (charts) | `web` (Recharts) |
| 12 | Export PDF / DOCX / TXT | `web` route handlers |

## Quick Start

### Prerequisites

- Node.js ≥ 20, Python ≥ 3.12, PostgreSQL ≥ 15
- A [Clerk](https://clerk.com) application (publishable + secret key)
- An [Anthropic](https://console.anthropic.com) API key

### 1. Database

```bash
createdb resume_optimizer        # or use Railway/Neon/Supabase Postgres
```

### 2. AI service

```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # set ANTHROPIC_API_KEY and AI_SERVICE_API_KEY
uvicorn app.main:app --reload --port 8000
```

### 3. Web app

```bash
cd web
npm install
cp .env.example .env             # set DATABASE_URL, Clerk keys, AI_SERVICE_* vars
npx prisma migrate deploy        # apply migrations
npm run dev
```

Open http://localhost:3000.

## Deployment

- **web** → Vercel. Set all env vars from `web/.env.example`; build command is the default
  (`prisma generate` runs via `postinstall`).
- **ai-service** → Railway. Deploy the `ai-service/` directory (Dockerfile included). Set
  `ANTHROPIC_API_KEY` and `AI_SERVICE_API_KEY`.
- **PostgreSQL** → Railway plugin. Point `DATABASE_URL` in Vercel at it and run
  `npx prisma migrate deploy` from CI or locally.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for step-by-step instructions.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design and data flow
- [docs/DATABASE.md](docs/DATABASE.md) — schema and relationships
- [docs/API.md](docs/API.md) — service contracts (web ↔ ai-service) and route handlers
- [docs/ROADMAP.md](docs/ROADMAP.md) — development roadmap

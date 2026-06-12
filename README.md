# AI Resume Optimizer

[![CI](https://github.com/aldeeian/ai-resume-optimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/aldeeian/ai-resume-optimizer/actions/workflows/ci.yml)

A SaaS-style web application that helps students tailor their master resume to specific
job descriptions — truthfully and in an ATS-compliant way — then practice interviewing
for those exact jobs.

Upload a master resume, paste a job description, and the system analyzes the posting,
ranks your experiences and projects by relevance, flags missing skills, generates a
keyword-optimized tailored resume (no fabricated experience — **every bullet cites the
verbatim master-resume text it was built from**), scores it against the job, writes a
matching cover letter, runs a mock interview with STAR-rubric coaching, and tracks
your applications.

## Monorepo Layout

```
.
├── web/          Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui, Prisma, Clerk)
├── ai-service/   FastAPI microservice (Python 3.12, pluggable LLM: Claude default / Gemini free tier)
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
| 13 | **Evidence-linked bullets** — every generated bullet cites verbatim source-resume quotes, verified deterministically server-side | `ai-service` `/generate` + provenance UI |
| 14 | **Cover letter generator** (tone control, no invented figures) | `ai-service` `/cover-letter` + `web` |
| 15 | **AI mock interview** — JD+resume-specific questions, per-answer scoring with STAR analysis and coaching feedback | `ai-service` `/interview/*` + `web` |
| 16 | Tests + CI + LLM evals (pytest, vitest, GitHub Actions, golden-set eval harness) | repo-wide |

## Quick Start

### Prerequisites

- Node.js ≥ 20, Python ≥ 3.12, PostgreSQL ≥ 15
- A [Clerk](https://clerk.com) application (publishable + secret key)
- An LLM API key — either [Anthropic](https://console.anthropic.com) (default) or
  [Gemini](https://aistudio.google.com/apikey) (free tier: set `LLM_PROVIDER=gemini`
  and `GEMINI_API_KEY` in `ai-service/.env`)

### 1. Database

```bash
createdb resume_optimizer        # or use Railway/Neon/Supabase Postgres
```

### 2. AI service

```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # set AI_SERVICE_API_KEY + your LLM provider key
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

## Tests & Quality

```bash
# web: typecheck + unit tests (ATS engine, diff, schema contracts)
cd web && npm run typecheck && npm run test

# ai-service: lint + unit tests (truthfulness, evidence verification, endpoints with the LLM mocked)
cd ai-service && pip install -r requirements-dev.txt && ruff check app tests evals && pytest

# live LLM evals (real API calls; needs ANTHROPIC_API_KEY) — parse fidelity + evidence coverage
cd ai-service && python -m evals.run_evals
```

CI (GitHub Actions) runs lint, typecheck, both test suites, and a production build on
every push and pull request. The eval workflow is manual (Actions → "LLM evals") since
it spends real API tokens.

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

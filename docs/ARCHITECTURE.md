# System Architecture

## Overview

Two deployable units plus a managed Postgres instance:

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React 19, Tailwind CSS 4, shadcn/ui, React Query) │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│  web/  — Next.js 15 App Router (Vercel)                     │
│  • Clerk auth middleware (route protection)                 │
│  • Server Actions — all user-facing mutations               │
│  • File text extraction (pdf-parse, mammoth, plain text)    │
│  • ATS Score Engine — deterministic TypeScript              │
│  • Export route handlers — PDF (@react-pdf), DOCX (docx)    │
│  • Prisma ORM ──────────────► PostgreSQL (Railway)          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP, x-api-key shared secret
┌──────────────────────────▼──────────────────────────────────┐
│  ai-service/  — FastAPI (Railway, Docker)                   │
│  • POST /api/v1/resume/parse                                │
│  • POST /api/v1/job/analyze                                 │
│  • POST /api/v1/rank                                        │
│  • POST /api/v1/generate                                    │
│  • Anthropic Claude API (tool-use → strict JSON outputs)    │
└─────────────────────────────────────────────────────────────┘
```

## Key Decisions

1. **LLM calls isolated in FastAPI.** The web tier never talks to Anthropic directly.
   This keeps the API key in one place, lets the AI service scale independently, and
   makes the LLM layer swappable. Service-to-service auth uses a shared secret in the
   `x-api-key` header; the AI service is never exposed to browsers.

2. **File parsing stays in Next.js.** Uploaded bytes are converted to text in the web
   tier (`pdf-parse` for PDF, `mammoth` for DOCX). Only plain text crosses the service
   boundary — smaller payloads, no file-handling attack surface in the Python service.

3. **Deterministic ATS scoring.** The 0–100 score is computed by a pure TypeScript
   engine (keyword/skills/experience/project/formatting weights), not by the LLM.
   Scores are reproducible, unit-testable, and can't be hallucinated. The LLM is used
   only where language understanding is required (parsing, ranking reasoning,
   rewriting bullets).

4. **Truthfulness guardrails in generation.** The generation prompt forbids inventing
   employers, titles, dates, metrics, or technologies not present in the source resume.
   A post-generation validation pass cross-checks every company/title/date in the
   output against the source and rejects fabrications.

5. **Server Actions for mutations, React Query for interactive reads.** CRUD goes
   through validated Server Actions (Zod on every input). The application tracker uses
   React Query with optimistic updates for instant status changes.

6. **Analytics computed live.** Dashboard metrics are aggregate queries over indexed
   columns (`Application.status`, `GeneratedResume.atsScore`) rather than a
   denormalized analytics table — always consistent, no sync jobs.

## Data Flow: "Optimize Resume" (the core loop)

```
1. Upload resume file ──► extract text ──► ai /resume/parse ──► Resume +
                                            Experience[] + Project[] rows
2. Paste job posting  ──► ai /job/analyze ──► JobDescription row
3. Click Optimize:
   a. ai /rank      ──► experience scores + reasoning, project scores + matches
   b. TS engine     ──► missing / matched skills (normalized comparison)
   c. ai /generate  ──► tailored resume content (truthfulness-validated)
   d. TS ATS engine ──► score + breakdown
   e. persist GeneratedResume (content, rankings, score, diff metadata)
4. Review ──► compare view (diff) ──► export PDF / DOCX / TXT ──► track application
```

## Error Handling Strategy

- Every Server Action returns a typed `ActionResult<T>` (`{ ok: true, data } |
  { ok: false, error }`) — no thrown errors leak to the client.
- The AI client wraps fetch with timeouts, retry-once on 5xx, and Zod validation of
  every response payload.
- FastAPI returns RFC-7807-style problem JSON; Claude responses are schema-validated
  via tool-use (the model must call a tool whose input schema is the output contract).
- All user input is validated with Zod (web) and Pydantic (service) at the boundary.

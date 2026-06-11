# Development Roadmap

## Phase 0 — Foundation ✅
- Monorepo layout, docs, environment contracts
- Next.js 15 + TypeScript strict + Tailwind 4 + shadcn/ui primitives
- Prisma schema + initial migration
- Clerk auth (middleware, sign-in/up pages, user bootstrap)

## Phase 1 — Resume Ingestion ✅
- Upload UI (drag & drop, PDF/DOCX/TXT, size/type validation)
- Text extraction (pdf-parse, mammoth)
- ai-service `/resume/parse` with Claude tool-use structured output
- Resume detail view (sections, experiences, projects)

## Phase 2 — Job Analysis ✅
- JD paste form + `/job/analyze`
- Analysis display (required/preferred skills, tech, keywords, soft skills, responsibilities)

## Phase 3 — Optimization Engine ✅
- `/rank` (experience + project relevance with reasoning)
- Missing-skills analysis (normalized skill comparison)
- `/generate` with truthfulness validation
- Deterministic ATS score engine + breakdown
- Optimization wizard UI (select resume → select job → run → results)

## Phase 4 — Review & Export ✅
- Resume comparison view (diff, added keywords, removed content)
- PDF / DOCX / TXT export with ATS-safe formatting

## Phase 5 — Tracking & Analytics ✅
- Application tracker (board/table, status flow, optimistic updates)
- Analytics dashboard (response rate, interview/offer counts, avg ATS score, top skills, charts)

## Phase 6 — Hardening & Launch ✅
- Settings / profile pages
- Loading skeletons, empty states, error boundaries
- Deployment configs (Vercel, Railway, Docker)

## Post-MVP (next)
- Cover letter generation
- Chrome extension to capture postings
- Multiple resume templates
- Team/career-center accounts
- Webhook sync of Clerk user deletions

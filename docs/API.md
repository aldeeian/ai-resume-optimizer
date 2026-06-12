# API Design

## 1. ai-service (FastAPI) — internal, server-to-server only

Auth: `x-api-key: <AI_SERVICE_API_KEY>` header on every request; 401 otherwise.
All endpoints are `POST`, JSON in / JSON out, **camelCase wire format** (matching the
web app's Zod schemas; Pydantic uses a camelCase alias generator). Errors are problem
JSON (`{ "detail": string }`). Claude outputs are produced via forced tool-use — the
model must call a tool whose input schema is the output contract — so every response
is schema-guaranteed.

### POST /api/v1/resume/parse
Parse raw resume text into structured sections (verbatim extraction, no rewriting).

```jsonc
// request
{ "rawText": "JANE DOE\njane@x.com ..." }
// response 200 — "ParsedResume"
{
  "contact": { "name": "", "email": "", "phone": "", "location": "", "links": [] },
  "summary": "",
  "education": [ { "institution": "", "degree": "", "field": "", "startDate": "", "endDate": "", "gpa": "", "highlights": [] } ],
  "skills": ["Python", "React"],
  "experiences": [ { "company": "", "title": "", "location": "", "startDate": "", "endDate": "", "current": false, "bullets": [] } ],
  "projects": [ { "name": "", "description": "", "technologies": [], "url": "", "bullets": [] } ]
}
```

### POST /api/v1/job/analyze
```jsonc
// request
{ "rawText": "We are looking for a Software Engineering Intern ..." }
// response 200 — "JobAnalysis"
{
  "title": "Software Engineering Intern",
  "company": "Acme Corp",
  "seniority": "internship",
  "requiredSkills": [], "preferredSkills": [],
  "technologies": [], "keywords": [],
  "softSkills": [], "responsibilities": []
}
```

### POST /api/v1/rank
```jsonc
// request
{ "job": { /* JobAnalysis */ },
  "experiences": [ { "id": "", "company": "", "title": "", "bullets": [] } ],
  "projects":    [ { "id": "", "name": "", "description": "", "technologies": [], "bullets": [] } ] }
// response 200 — every input id is present in the output (unscored items default to 0)
{
  "experiences": [ { "id": "", "score": 87, "reasoning": "", "matchedSkills": [] } ],
  "projects":    [ { "id": "", "score": 91, "matchedTechnologies": [], "matchedSkills": [] } ]
}
```

### POST /api/v1/generate
The request resume must already be filtered to the selected experiences/projects in
ranked order — the service rewrites, it does not select.

```jsonc
// request
{ "job": { /* JobAnalysis */ }, "resume": { /* ParsedResume (selected items only) */ } }
// response 200
{
  "content": { /* ParsedResume, rewritten */ },
  "evidence": [
    // provenance for the summary and every generated bullet
    { "section": "experience", "entryIndex": 0, "bulletIndex": 1,
      "sources": ["verbatim quote from the source resume"], "verified": true }
  ]
}
```

**Truthfulness contract:** every company, title, date range, institution, project name,
skill, and numeric metric in `content` is cross-checked against the request resume
(`app/truthfulness.py`). On violation the service retries once with the violations
called out, then returns **422** if the model still fabricated anything. Added
keywords / removed content are computed deterministically in the web tier
(`web/src/lib/ats/diff.ts`), not by the model.

**Evidence contract:** the model must cite 1-3 verbatim source-resume quotes for the
summary and each bullet it writes. The service verifies each quote deterministically
(whitespace/case-insensitive substring match against the source resume) and sets
`verified` itself — the model never grades its own citations. Bullets that end up
without verified evidence trigger one corrective retry, then ship flagged
`verified: false` (truthful-but-uncited is surfaced honestly, not rejected).

### POST /api/v1/cover-letter
```jsonc
// request — tone: "professional" | "enthusiastic" | "concise"
{ "job": { /* JobAnalysis */ }, "resume": { /* ParsedResume */ }, "tone": "professional" }
// response 200
{ "content": "Dear Hiring Manager,\n\n..." }
```
Every numeric figure in the letter must already exist in the resume; one corrective
retry, then **422** if figures are still fabricated.

### POST /api/v1/interview/questions
```jsonc
// request
{ "job": { /* JobAnalysis */ }, "resume": { /* ParsedResume */ }, "numQuestions": 6 }
// response 200 — ids are assigned by the server (q1..qN), never by the model
{ "questions": [
  { "id": "q1", "type": "behavioral", "question": "...", "focusArea": "collaboration" }
] }
```
`type` mix is ~40% behavioral / ~40% technical / ~20% resume-specific probes, all
grounded in the actual posting and the actual resume.

### POST /api/v1/interview/feedback
```jsonc
// request
{ "job": { /* JobAnalysis */ },
  "question": { "id": "q1", "type": "behavioral", "question": "...", "focusArea": "" },
  "answer": "candidate's answer (min 20 chars)",
  "resume": { /* ParsedResume, optional — grounds the example answer */ } }
// response 200
{ "score": 74, "strengths": [], "improvements": [],
  "star": { "situation": true, "task": true, "action": true, "result": false, "note": "" },
  "exampleAnswer": "" }
```
`star` is returned only for behavioral questions (stripped server-side otherwise).

### GET /health
Unauthenticated liveness probe → `{ "status": "ok" }`.

## 2. web (Next.js) — Server Actions

All mutations are Server Actions in `web/src/server/actions/`, each one:
Zod-validates input → resolves the Clerk user (`requireUser()`) → scopes every query
by `userId` → returns `ActionResult<T>` (`{ ok: true, data } | { ok: false, error }`).

| Action | File | Purpose |
|---|---|---|
| `uploadResume` / `deleteResume` / `setMasterResume` | `resumes.ts` | file → text → parse → persist |
| `analyzeJob` / `deleteJob` | `jobs.ts` | JD text → analysis → persist |
| `optimizeResume` / `deleteGeneratedResume` | `optimize.ts` | rank → gap → generate → score → diff → persist |
| `createApplication` / `updateApplication` / `updateApplicationStatus` / `deleteApplication` | `applications.ts` | tracker CRUD with stage timestamps |
| `generateCoverLetter` / `deleteCoverLetter` | `cover-letters.ts` | tailored letter from a generated resume |
| `startInterview` / `submitInterviewAnswer` / `deleteInterviewSession` | `interviews.ts` | mock interview lifecycle (question set → per-answer feedback → overall score) |
| `updateProfile` / `deleteAllUserData` | `profile.ts` | profile + data wipe |

## 3. web — Route Handlers (REST)

| Route | Method | Purpose |
|---|---|---|
| `/api/applications` | GET | tracker list for React Query |
| `/api/export/[id]/pdf` | GET | generated resume → PDF stream (@react-pdf/renderer) |
| `/api/export/[id]/docx` | GET | generated resume → DOCX stream (docx) |
| `/api/export/[id]/txt` | GET | generated resume → plain text |

Export routes verify ownership (Clerk session → userId → row check) before streaming
and set `content-disposition: attachment` with a sanitized filename.

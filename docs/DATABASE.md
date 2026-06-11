# Database Design

PostgreSQL via Prisma. Source of truth: `web/prisma/schema.prisma`.

## Entity Relationship Overview

```
User 1───* Resume 1───* Experience
  │           │
  │           └───────* Project
  ├─────────* JobDescription
  ├─────────* GeneratedResume *───1 Resume
  │                           *───1 JobDescription
  └─────────* Application ?───1 JobDescription
                          ?───1 GeneratedResume
```

## Models

### User
Mirror of the Clerk user (Clerk is the auth source of truth). Created lazily on first
authenticated request via `ensureUser()`. `clerkId` is unique; all child rows cascade
on delete so account deletion is a single statement.

### Resume
One uploaded "master resume". Stores original file metadata, the full extracted
`rawText`, and parsed scalar sections (`contact` JSON, `summary`, `education` JSON,
`skills` text[]). Structured repeating sections live in `Experience` and `Project`
child tables so they can be ranked and selected individually.

### Experience / Project
Ordered children of a Resume. Bullets are `text[]`. Projects also carry
`technologies text[]` and an optional URL.

### JobDescription
A pasted job posting plus the AI analysis results (required/preferred skills,
technologies, keywords, soft skills, responsibilities — all `text[]`), denormalized
onto the row because they are immutable once analyzed and always read together.

### GeneratedResume
The output of one optimization run: the full tailored resume as structured JSON
(`content`), the ATS `atsScore` + `scoreBreakdown` JSON, ranking results
(`experienceRanking`, `projectRanking` JSON), and diff metadata (`addedKeywords`,
`removedContent`, `matchedSkills`, `missingSkills` text[]). Links back to both the
source Resume and the JobDescription.

### Application
Tracker row. `status` is the `ApplicationStatus` enum
(`SAVED → APPLIED → INTERVIEWING → OFFER | REJECTED | WITHDRAWN`) with per-stage
timestamps and free-form notes. Optional links to the JobDescription and
GeneratedResume used for that application.

### Analytics
Computed live (no table): aggregate queries over `Application.status`,
`Application.appliedAt`, and `GeneratedResume.atsScore`, all covered by indexes below.
A denormalized analytics table was deliberately avoided — see ARCHITECTURE.md §6.

## Indexes & Constraints

| Table | Index / constraint | Why |
|---|---|---|
| User | `@unique clerkId`, `@unique email` | auth lookup, identity |
| Resume | `@@index([userId, createdAt])` | dashboard list |
| Experience | `@@index([resumeId, order])` | ordered section fetch |
| Project | `@@index([resumeId, order])` | ordered section fetch |
| JobDescription | `@@index([userId, createdAt])` | history list |
| GeneratedResume | `@@index([userId, createdAt])`, `@@index([resumeId])`, `@@index([jobDescriptionId])` | lists + joins |
| Application | `@@index([userId, status])`, `@@index([userId, appliedAt])` | tracker board + analytics |
| all FKs | `onDelete: Cascade` | account/resume deletion integrity |
| all tables | `createdAt` / `updatedAt` timestamps | auditing |

## Migrations

Checked-in SQL migrations live in `web/prisma/migrations/`. Apply with
`npx prisma migrate deploy` (production) or `npx prisma migrate dev` (development).

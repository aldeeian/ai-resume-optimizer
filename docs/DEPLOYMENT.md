# Deployment Guide

Three pieces: PostgreSQL (Railway), ai-service (Railway), web (Vercel).

## 1. PostgreSQL on Railway

1. Create a Railway project → **New → Database → PostgreSQL**.
2. Copy the `DATABASE_URL` from the database's *Connect* tab (use the public URL for
   running migrations locally; the private URL for the web app if it also runs on
   Railway — for Vercel use the public URL).
3. Apply migrations from your machine:

   ```bash
   cd web
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

## 2. ai-service on Railway

1. In the same Railway project: **New → Service → GitHub repo**, select this repo.
2. Set the service **Root Directory** to `ai-service/`. Railway picks up the
   `Dockerfile` and `railway.toml` (health check on `/health`).
3. Variables:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | from console.anthropic.com |
   | `AI_SERVICE_API_KEY` | long random string, e.g. `openssl rand -hex 32` |
   | `ANTHROPIC_MODEL` | optional, defaults to `claude-sonnet-4-6` |

4. Add a public domain (Settings → Networking → Generate Domain). Note the URL —
   the web app needs it. The service rejects any request without the shared secret,
   so a public domain is acceptable; for extra hardening keep both services in one
   Railway project and use private networking.

## 3. web on Vercel

1. **Import the repo** in Vercel; set the project **Root Directory** to `web/`.
2. Framework preset: Next.js. Build command: default (`next build`;
   `prisma generate` runs automatically via the `postinstall` script).
3. Environment variables (all environments):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Railway Postgres URL |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | from dashboard.clerk.com |
   | `CLERK_SECRET_KEY` | from dashboard.clerk.com |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
   | `AI_SERVICE_URL` | the Railway ai-service URL (no trailing slash) |
   | `AI_SERVICE_API_KEY` | same secret as the ai-service |

4. In Clerk: create an application, enable Email + the providers you want, and add
   your Vercel domain under **Domains** (production instance) so auth works on the
   deployed URL.
5. Deploy. The first signed-in request creates the user row automatically.

## 4. Post-deploy checklist

- `GET https://<ai-service>/health` → `{"status":"ok"}`
- Sign up → dashboard loads (Clerk + DB wiring OK)
- Upload a PDF resume → parsed sections appear (ai-service wiring OK)
- Analyze a posting → optimize → ATS results render → export PDF/DOCX/TXT
- Track an application → analytics charts populate

## 5. Migrations going forward

Schema changes: edit `web/prisma/schema.prisma`, then

```bash
cd web
npx prisma migrate dev --name <change>   # creates SQL + applies to dev DB
git add prisma/migrations
```

Production picks them up with `npx prisma migrate deploy` (run from CI or locally
against the production `DATABASE_URL`). Never use `prisma db push` in production.

## 6. Local development

```bash
# terminal 1 — database (or use Docker: docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16)
# terminal 2 — ai-service
cd ai-service && .venv/Scripts/activate && uvicorn app.main:app --reload --port 8000
# terminal 3 — web
cd web && npm run dev
```

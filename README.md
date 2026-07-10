# CosmoSpend — Cosmic Animal Adventure 🌌🦊

AI-powered personal expense tracking for young urban India. Log expenses in natural language, get split-bill detection, and receive coaching reports from a two-agent AI crew (classifier + report designer).

## Stack

- **Frontend:** React + Vite + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express + TypeScript
- **Database:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **AI:** Groq or OpenAI-compatible API
- **Email:** Resend (HTML debrief + PDF attachment)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations — either:
   - **Fresh project:** paste [`supabase/migrations/002_complete_setup.sql`](supabase/migrations/002_complete_setup.sql) in SQL Editor, then run 006–008
   - **Existing project:** `npm run migrate` (needs `SUPABASE_DB_PASSWORD`) or paste 004–008 in SQL Editor
3. Enable **Email** auth under Authentication → Providers
4. Copy project URL, anon key, and service role key

### 2. Environment variables

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Key variables:

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Groq LLM for report pipeline |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` for Groq |
| `RESEND_API_KEY` | Email delivery |
| `EMAIL_FROM` | `CosmoSpend <onboarding@resend.dev>` until domain verified |
| `APP_URL` | Frontend URL for email CTA links |
| `CRON_SECRET` | Protects scheduled report endpoint |
| `VITE_SUPABASE_*` | Client Supabase auth |

For production client deploy, also set `VITE_API_URL` to your backend URL (e.g. `https://api.yourdomain.com`).

### 3. Install and run

```bash
npm run install:all
npm run migrate    # optional if using SQL Editor instead
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Features

- **8-step onboarding** — Profile, income sources, income range, AI crew skills
- **Natural language expense logging** — Regex parser with split-bill detection
- **Transaction history** — Searchable expense archive
- **AI reports** — Agent A (classify + coach) → Agent B (markdown + email sections)
- **Email debriefs** — HTML email + PDF attachment via Resend
- **PDF storage** — Reports persisted in Supabase Storage; download from app
- **Scheduled reports** — Daily cron dispatches reports by user frequency
- **Settings** — Edit profile, skills, auto-reports toggle, email delivery history

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/onboarding/status` | Onboarding progress |
| POST | `/api/onboarding/step` | Save onboarding step |
| POST | `/api/onboarding/complete` | Finish onboarding |
| POST | `/api/expenses/parse` | Parse expense message |
| POST | `/api/expenses/confirm` | Confirm split/high amount |
| GET | `/api/expenses` | Transaction history |
| POST | `/api/reports/generate` | Trigger report pipeline |
| POST | `/api/reports/:id/retry` | Retry failed report |
| GET | `/api/reports/:id/pdf` | Signed PDF download URL |
| GET | `/api/reports/deliveries/recent` | Recent email deliveries |
| GET/PATCH | `/api/profile` | User profile + schedule |
| POST | `/api/internal/cron/dispatch-reports` | Scheduled reports (CRON_SECRET) |

## Scheduled reports

Set `CRON_SECRET` in `.env` and trigger daily via GitHub Actions (see [`.github/workflows/dispatch-reports.yml`](.github/workflows/dispatch-reports.yml)) or any cron service:

```bash
curl -X POST https://your-api.com/api/internal/cron/dispatch-reports \
  -H "X-Cron-Secret: your-secret"
```

## Deploy

- **Client:** Vercel — root `client/`, set `VITE_SUPABASE_*` and `VITE_API_URL`
- **Server:** Railway — root `server/`, set all server env vars including `CRON_SECRET`
- **Cron:** GitHub Actions workflow hits production cron endpoint daily

## Expense examples

```
spent 800 on dinner with 3 friends
paid ₹1,200 for groceries
spent 450 on Swiggy
paid 2000 rent split among 4
```

## Notes

- Reports are delivered in-app (markdown) and optionally by email with PDF
- PDFs are stored in private Supabase Storage bucket `user-documents`
- Not financial advice — coaching and education only

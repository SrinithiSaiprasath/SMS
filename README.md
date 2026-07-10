# CosmoSpend — Cosmic Animal Adventure 🌌🦊

AI-powered personal expense tracking for young urban India. Log expenses in natural language, get split-bill detection, and receive coaching reports from a two-agent AI crew (classifier + report designer).

## Stack

- **Frontend:** React + Vite + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express + TypeScript
- **Database:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **AI:** Groq or OpenAI-compatible API
- **Email:** Resend (HTML debrief + PDF attachment)

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

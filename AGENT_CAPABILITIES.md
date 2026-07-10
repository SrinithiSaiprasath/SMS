# CosmoSpend — Agent Skills & Email Delivery

## Architecture

**Two agents, many skills, email delivery.**

| Agent | Role |
|-------|------|
| **Agent A** | Classify + coach (JSON) |
| **Agent B** | Full markdown report + per-skill `email_sections` |

Skills from onboarding/settings drive report sections and email blocks.

## User profile (agents read all of this)

| Field | Purpose |
|-------|---------|
| income_sources | Where money comes from |
| income_lower_inr / income_upper_inr | Monthly range (min ₹500) |
| agent_assistance_preferences | Enabled skills |
| living_situation, city, age | Context |

## Email delivery

When `EMAIL_MISSION_REPORTS` is enabled (default):

1. HTML email — one block per enabled skill + profile strip
2. PDF attachment — full markdown report
3. In-app report — always stored

**Env:** `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`

Without Resend key, reports still save in-app; email is skipped (dev mode log).

## Migrations

Run `004_user_agent_profile.sql` then `005_income_range_and_email.sql`, or `npm run migrate`.

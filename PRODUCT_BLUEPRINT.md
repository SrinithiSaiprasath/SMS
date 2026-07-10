# Personal Expense Intelligence Platform — Product Blueprint

---

## Table of Contents

1. [Product Summary](#1-product-summary)
2. [User Journey End-to-End](#2-user-journey-end-to-end)
3. [Phase A — Onboarding](#3-phase-a--onboarding)
4. [Phase B — Expense Ingestion](#4-phase-b--expense-ingestion)
5. [Phase C — Agentic Pipeline](#5-phase-c--agentic-pipeline)
6. [Report Delivery](#6-report-delivery)
7. [Technology Stack](#7-technology-stack)
8. [Database Schema](#8-database-schema)
9. [API Endpoints](#9-api-endpoints)
10. [UI/UX Design Direction](#10-uiux-design-direction)
11. [Functional Requirements](#11-functional-requirements)
12. [Parsing Logic](#12-parsing-logic)
13. [Agent Prompts — Skeleton](#13-agent-prompts--skeleton)
14. [MVP vs Post-MVP](#14-mvp-vs-post-mvp)
15. [Security Notes](#15-security-notes)

---

## 1. Product Summary

A personal AI-powered expense tracking web app built for young urban Indians.
The product is not a traditional budgeting spreadsheet. It is a **behavioral coaching engine** that learns from how a user spends money, assigns meaning to each transaction, and periodically delivers a personalized report that tells the user where money is leaking, what they are doing well, and exactly how much they can save next period.

The product works in a simple loop:

```
User logs expense → System parses and stores → Agent tags and coaches → Report delivered inside app
```

No phone numbers. No SMS. No Twilio. No Lambda. A simple website backed by a Node.js server and Supabase.

---

## 2. User Journey End-to-End

Rahul is 23 years old. He lives in a PG in Bengaluru and earns a junior developer salary.

He opens the website for the first time and signs up with his email. The app takes him through a five-step onboarding wizard that collects his basic demographic and lifestyle data. He selects WEEKLY as his preferred report frequency.

Once onboarding is complete, he lands on the main dashboard — a focused, single-prompt interface. There is no scrolling chat history. There is one big input at the center asking him what he spent today.

He types: `spent 800 on dinner with 3 friends`.

The app parses his message instantly. It detects a split scenario and shows him a confirmation card:

> "Split detected. Total: ₹800. Your share: ₹200. Confirm?"

Rahul clicks Confirm. The transaction is saved to Supabase with `category = NULL`. The dashboard resets and asks for the next expense.

Throughout the week, Rahul logs a dozen more expenses — groceries, an Uber ride, Swiggy orders, a movie ticket.

On Sunday night, the Supabase pg_cron job runs. It identifies that exactly 7 days have passed since Rahul's last report and his frequency is WEEKLY. The cron fires the agent pipeline.

**Agent A** reads all of Rahul's untagged transactions. It reasons about each one using his demographic context — age, city, living situation. It labels each transaction as `LEAK`, `WORTHY_ESSENTIAL`, or `INVESTMENT`. It writes a personalized behavioral summary noting that Rahul's food delivery spend consumed 25% of his weekly allowance and that cutting weekend deliveries could save him ₹1,000 next week.

**Agent B** receives Agent A's labels and summary. It calculates the category breakdown (LEAK = 35%, WORTHY_ESSENTIAL = 65%, INVESTMENT = 0%) and creates a Google Doc report card titled "Weekly Audit Report Card — Rahul" with Agent A's advice formatted in styled blockquotes.

The Google Doc URL is saved to Supabase. Rahul sees a notification badge on the Reports icon inside the website. He opens it, reads his report, and knows exactly what to cut back on next week.

---

## 3. Phase A — Onboarding

### Trigger
User opens the website for the first time and completes signup.

### Steps

| Step | Question | Field | Validation |
|------|----------|-------|------------|
| 1 | What is your name? | `name` | Required, max 100 chars |
| 2 | How old are you? | `age` | Integer, 16–100 |
| 3 | Which city are you in? | `city` | Required, max 100 chars |
| 4 | What is your living situation? | `living_situation` | One of: PG_RENTAL, RENTED_APARTMENT, OWN_HOME, FAMILY_HOME |
| 5 | How often do you want your report? | `report_frequency` | One of: WEEKLY, BIWEEKLY, MONTHLY |

### Behavior

- Each step is a full-screen card that animates in.
- User cannot go to the main dashboard until all 5 steps are complete.
- Partial onboarding state is saved in `onboarding_sessions` table so a page refresh does not lose progress.
- On completion, profile is inserted into `users` table and `onboarding_sessions` row is deleted.
- Auth is handled by Supabase Auth (email + password).

### Database Write

```sql
INSERT INTO users (id, name, age, city, living_situation, report_frequency, created_at)
VALUES (auth_user_id, 'Rahul', 23, 'Bengaluru', 'PG_RENTAL', 'WEEKLY', NOW());
```

---

## 4. Phase B — Expense Ingestion

### Flow

```
User types message
  → Frontend sends POST /api/expenses/parse
    → Backend runs regex parser
      → If split detected → return parsed payload to frontend
        → Frontend shows confirmation card
          → User clicks Confirm
            → Frontend sends POST /api/expenses/confirm
              → Backend inserts transaction into Supabase
                → Returns success
                  → Dashboard resets for next input
```

### Split-Bill Logic

If the message contains phrases like "with N friends" or "split among N":

```
with N friends  →  share = total / (N + 1)
split among N   →  share = total / N
among N people  →  share = total / N
```

The denominator is always computed deterministically. No AI is used in this phase.

### Transaction Storage

Every confirmed expense is stored with `category = NULL`. The category is intentionally left blank and will be assigned by Agent A during the report cycle.

```sql
INSERT INTO transactions (user_id, amount, description, raw_message, category, logged_at)
VALUES (user_id, 200.00, 'dinner with friends', 'spent 800 on dinner with 3 friends', NULL, NOW());
```

### Confirmation Gate

An expense that requires split confirmation is stored temporarily in `pending_confirmations`. It is only moved to `transactions` when the user explicitly confirms. Cancelled confirmations are discarded. The system never auto-writes an ambiguous parse.

---

## 5. Phase C — Agentic Pipeline

### Trigger Modes

1. **Automatic** — Supabase pg_cron job runs at midnight every day. It checks the `users` table and fires the pipeline for any user whose report is due based on their `report_frequency` and `last_report_at`.
2. **On-demand** — User can manually trigger the pipeline from their Reports page inside the website by clicking "Generate Report Now".

### Agent A — Financial Coach (AWS Bedrock)

**Input:**
- User profile: name, age, city, living situation
- All transactions from the last report period where `category = NULL`

**Actions:**

1. Loop through each untagged transaction.
2. Apply demographic reasoning context:
   - A ₹200 restaurant bill for a 23-year-old in a PG is a discretionary lifestyle cost.
   - A ₹500 grocery bill is a necessary essential.
   - A ₹1,000 mutual fund transfer is an investment.
3. Assign one of three labels to each transaction:
   - `LEAK` — discretionary spend that could be reduced
   - `WORTHY_ESSENTIAL` — necessary and justified spend
   - `INVESTMENT` — wealth-building or future-oriented spend
4. Update each transaction row in Supabase with the assigned category.
5. Compute total spend per category and percentage breakdowns.
6. Scan all inputs for behavioral patterns:
   - Frequency of food delivery orders
   - Weekend vs weekday spend patterns
   - Comparison to previous period if data exists
7. Write a personalized behavioral summary in plain natural language. Example output:

> "You are managing your PG rent well, but dining out and food delivery apps combined consumed 25% of your weekly allowance. Cutting back on weekend deliveries could save you ₹1,000 next week."

**Output handed to Agent B:**
- Category breakdown object: `{ LEAK: 35, WORTHY_ESSENTIAL: 65, INVESTMENT: 0 }`
- Behavioral summary text
- List of top 3 saving opportunities with estimated rupee amounts

---

### Agent B — Auditor and Report Designer (AWS Bedrock)

**Input:**
- Category breakdown from Agent A
- Behavioral summary text from Agent A
- User profile metadata

**Actions:**

1. Verify and validate Agent A's metrics for consistency.
2. Calculate any derived metrics:
   - week-over-week change if previous report exists
   - biggest single-category spike
   - estimated monthly projection at current weekly rate
3. Call the **Docs MCP Server**:
   - Create a new Google Doc titled: `Weekly Audit Report Card — {name} — {date}`
   - Add a header section with user name, period, and generated date
   - Add a summary section with category percentages
   - Add Agent A's behavioral summary in styled blockquotes
   - Add a "Top Saving Opportunities" section with itemized suggestions
   - Add a closing motivational line
4. Return the Google Doc URL.

**Output:**
- Google Doc URL stored in `reports` table
- Report metadata stored in `report_insights` table

---

## 6. Report Delivery

- After Agent B completes, the Google Doc URL is stored in Supabase `reports` table.
- The frontend polls or subscribes to `reports` via Supabase Realtime.
- A notification badge appears on the Reports icon in the sidebar.
- Clicking it opens the Reports page showing a list of all generated reports.
- Each report card shows: period, date generated, LEAK/ESSENTIAL/INVESTMENT percentages, and a "View Full Report" button that opens the Google Doc.
- No SMS or email notification at MVP stage. Website-only delivery.

---

## 7. Technology Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React + Vite | Fast build tooling, component-based UI |
| Styling | Tailwind CSS | Utility-first, easy to build custom dark UI |
| Backend | Node.js + Express | Simple HTTP server, easy Supabase + Bedrock integration |
| Database | Supabase (PostgreSQL) | Managed Postgres, built-in Auth, Realtime, pg_cron |
| Auth | Supabase Auth | Email/password out of the box, JWT session handling |
| Scheduler | Supabase pg_cron | Runs inside the DB, no external scheduler needed |
| AI Agents | AWS Bedrock (Claude) | Managed LLM API, no model hosting required |
| Report Generation | Google Docs via Docs MCP Server | Structured shareable documents |
| Hosting | Railway or Render | Simple Node.js deployment, free tier available |

---

## 8. Database Schema

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 16 AND 100),
  city TEXT NOT NULL,
  living_situation TEXT NOT NULL CHECK (living_situation IN (
    'PG_RENTAL', 'RENTED_APARTMENT', 'OWN_HOME', 'FAMILY_HOME'
  )),
  report_frequency TEXT NOT NULL CHECK (report_frequency IN (
    'WEEKLY', 'BIWEEKLY', 'MONTHLY'
  )),
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### onboarding_sessions
```sql
CREATE TABLE onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  step INTEGER NOT NULL DEFAULT 0,
  collected_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### transactions
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  category TEXT CHECK (category IN ('LEAK', 'WORTHY_ESSENTIAL', 'INVESTMENT')),
  is_split BOOLEAN NOT NULL DEFAULT FALSE,
  total_bill NUMERIC(10, 2),
  split_count INTEGER,
  currency TEXT NOT NULL DEFAULT 'INR',
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tagged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_logged_at ON transactions(logged_at DESC);
CREATE INDEX idx_transactions_category ON transactions(category);
```

### pending_confirmations
```sql
CREATE TABLE pending_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  total_bill NUMERIC(10, 2) NOT NULL,
  your_share NUMERIC(10, 2) NOT NULL,
  split_count INTEGER NOT NULL,
  description TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### reports
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  frequency TEXT NOT NULL,
  doc_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
  )),
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_user_id ON reports(user_id);
```

### report_insights
```sql
CREATE TABLE report_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id),
  user_id UUID NOT NULL REFERENCES users(id),
  leak_percentage NUMERIC(5, 2),
  essential_percentage NUMERIC(5, 2),
  investment_percentage NUMERIC(5, 2),
  total_spend NUMERIC(10, 2),
  behavioral_summary TEXT,
  saving_opportunities JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 9. API Endpoints

### Auth (handled by Supabase client directly)
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`

### Onboarding
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/onboarding/status` | Check if user has completed onboarding |
| POST | `/api/onboarding/step` | Save current step data and advance |
| POST | `/api/onboarding/complete` | Finalize onboarding and write to users table |

### Expenses
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/expenses/parse` | Parse raw message, return structured payload |
| POST | `/api/expenses/confirm` | Confirm parsed expense, write to transactions |
| POST | `/api/expenses/cancel` | Cancel pending confirmation |
| GET | `/api/expenses` | Fetch user's transaction history |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports` | Fetch list of all reports for user |
| GET | `/api/reports/:id` | Fetch single report detail |
| POST | `/api/reports/generate` | Manually trigger agent pipeline |

### Profile
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Fetch user profile |
| PATCH | `/api/profile` | Update city, living situation, or report frequency |

---

## 10. UI/UX Design Direction

### Design Philosophy
Not a standard fintech dashboard. A **focused, playful behavioral coaching tool** that feels like a conversation with a smart money companion.

### Visual Identity
- **Background:** Dark indigo (`#0F0E1A`)
- **Primary accent:** Neon mint (`#00F5C4`)
- **Secondary accent:** Warm amber (`#FFB547`)
- **Card background:** Glassy semi-transparent surfaces with subtle blur
- **Typography:** Large, bold headers. Lightweight body text.
- **Animations:** Smooth card transitions, spring-based confirm animations

### Screens

#### Login / Signup
- Minimal, premium
- Full-screen dark background
- Single centered card with email and password fields
- No distractions

#### Onboarding Wizard
- One question per full-screen card
- Card animates in from the right on each step
- Progress indicator at the top (Step 2 of 5)
- Options shown as large tappable chips, not dropdowns

#### Main Dashboard
- No scrolling chat history visible on this page
- Top: "Today's Budget Mood" — a large dynamic status indicator that shifts color based on today's logged spend
- Center: One active prompt card — "What did you spend today?"
- Quick-action chips below input: Food, Travel, Bills, Entertainment, Split Bill
- After each expense is logged, the prompt card resets with a satisfying animation

#### Expense Result Card (after parse)
- Animates in as a floating card overlay
- Shows: detected amount, description, split breakdown if applicable, category preview
- Large Confirm and Edit buttons
- Feels like a "move completed" screen in a game

#### History Page
- Separate page, not mixed with main dashboard
- Searchable list of transactions
- Filter by category and date range
- Each item is a compact card showing amount, description, category badge, and date
- Tap to expand for full details

#### Reports Page
- List of past reports ordered by most recent
- Each report card shows: period label, date generated, LEAK/ESSENTIAL/INVESTMENT percentages as colored segments
- Tapping a report opens the Google Doc in a new tab
- "Generate Report Now" button at top for on-demand trigger
- Empty state shows next scheduled report date

#### Settings Page
- Update city, living situation, report frequency
- Danger zone at bottom: delete account

---

## 11. Functional Requirements

### Authentication
- User can sign up with email and password
- User session persists across browser refreshes and tab closures
- All app routes are protected; unauthenticated users are redirected to login
- Logout clears session and redirects to login

### Onboarding
- Chat interface is locked until onboarding is fully completed
- Each step validates before allowing next
- Partial completion persists across refreshes via `onboarding_sessions` table
- Completion deletes the session row and unlocks the main dashboard

### Expense Input
- User types in natural language
- Enter key or Send button submits
- Quick-action chips pre-fill context tags
- Parser returns result within 1 second
- Ambiguous or unrecognized inputs return a helpful re-prompt
- Split confirmation always required before write — never auto-confirmed
- Duplicate submit protection (debounce on confirm button)

### History
- Full transaction history paginated by date
- Searchable by description text
- Filterable by category and month
- Each entry shows raw message and parsed result

### Reports
- Automatically generated based on user's frequency setting
- Manually triggerable from the Reports page
- Report URL stored and always accessible from within the app
- Previous reports never deleted

### Profile
- User can update living situation, city, and frequency at any time
- Name and age are fixed after onboarding (require support to change)
- All updates stored with `updated_at` timestamp

---

## 12. Parsing Logic

All parsing is deterministic regex. No AI is used in the ingestion phase.

### Amount Extraction
```
Pattern: (\d+[\.,]?\d*)\s*(rupees?|rs\.?|₹|inr)?
Example: "spent 800 rupees" → 800
Example: "paid ₹1,200" → 1200
Default currency: INR
```

### Description Extraction
```
Remove amount, currency words, and split phrases from the message.
Remaining text is treated as the description.
Example: "spent 800 on dinner with 3 friends" → "dinner with friends"
```

### Split Detection
```
Pattern 1: (\d+)\s*friends?         → share = total / (N + 1)
Pattern 2: split\s+among\s+(\d+)    → share = total / N
Pattern 3: among\s+(\d+)\s+people   → share = total / N
Pattern 4: divided\s+by\s+(\d+)     → share = total / N
```

### Edge Cases
- If split denominator resolves to zero or one: treat as no split
- If amount is not found: return parsing failure, ask user to rephrase
- If amount exceeds ₹1,00,000: flag for confirmation regardless of split
- All amounts stored as decimal with 2 decimal places

---

## 13. Agent Prompts — Skeleton

### Agent A System Prompt
```
You are a personal financial coach analyzing expense data for a young Indian professional.

User context:
- Name: {name}
- Age: {age}
- City: {city}
- Living situation: {living_situation}

You will receive a list of expense transactions. For each transaction:
1. Assign exactly one category: LEAK, WORTHY_ESSENTIAL, or INVESTMENT
2. Use the user's context to reason appropriately:
   - A PG rental in Bengaluru means fixed housing cost is already low
   - Food delivery multiple times a week for a 23-year-old is a LEAK
   - Groceries are WORTHY_ESSENTIAL
   - Any mutual fund, SIP, or savings transfer is INVESTMENT

After categorizing all transactions:
1. Compute total per category
2. Compute percentage of total spend per category
3. Identify top 3 behavioral patterns
4. Write a personalized 3-sentence coaching summary that:
   - Names one thing the user is doing well
   - Names the biggest leak with specific rupee amount
   - Gives one concrete saving suggestion with estimated savings

Return your response as structured JSON.
```

### Agent B System Prompt
```
You are a financial report designer and auditor.

You will receive:
- Category breakdown: { LEAK: N%, WORTHY_ESSENTIAL: N%, INVESTMENT: N% }
- Behavioral summary text from Agent A
- User profile metadata
- Top saving opportunities list

Your tasks:
1. Verify the percentages sum to 100%. If not, flag the discrepancy.
2. Compute week-over-week change if previous period data is provided.
3. Draft a complete report document with the following sections:
   - Header: user name, period, generated date
   - Category Summary: percentages with plain English labels
   - Behavioral Coaching: Agent A's summary in blockquote format
   - Top Saving Opportunities: numbered list with rupee estimates
   - Closing: one motivational sentence

Pass this structured draft to the Docs MCP Server to create the Google Doc.
Return the final Google Doc URL.
```

---

## 14. MVP vs Post-MVP

### MVP — Build This First

- [ ] Supabase project setup with all tables
- [ ] Supabase Auth (email + password)
- [ ] Express backend with all API endpoints
- [ ] Onboarding wizard (5 steps)
- [ ] Main dashboard with single-prompt chat input
- [ ] Regex parser (amount, description, split)
- [ ] Split confirmation card
- [ ] Transaction storage in Supabase
- [ ] History page
- [ ] Agent A integration (Bedrock)
- [ ] Agent B integration (Bedrock)
- [ ] Docs MCP Server integration (Google Doc generation)
- [ ] Reports page with Google Doc link
- [ ] pg_cron weekly trigger
- [ ] On-demand report trigger from UI
- [ ] Profile settings page
- [ ] Basic dark UI with Tailwind

### Post-MVP — After Launch

- [ ] Spend trend charts and graphs
- [ ] Budget goal setting per category
- [ ] Week-over-week comparison in reports
- [ ] Email report delivery
- [ ] Push notifications (browser)
- [ ] Better NLP parser (replace regex with lightweight model)
- [ ] Voice input (browser microphone, no telecom API)
- [ ] Multi-currency support
- [ ] Shared expense groups (households)
- [ ] Export transactions as CSV
- [ ] Dark mode / light mode toggle

---

## 15. Security Notes

### Authentication
- All API routes validate JWT token from Supabase Auth on every request
- JWTs are short-lived; Supabase handles refresh automatically
- Never store auth tokens in localStorage; use Supabase client's built-in session management

### Database
- Enable Row Level Security (RLS) on all Supabase tables
- Each table policy ensures users can only read and write their own rows:
```sql
CREATE POLICY "Users can only access their own data"
ON transactions FOR ALL
USING (auth.uid() = user_id);
```
- Service role key is never exposed to the frontend
- Only anon key is used in the frontend Supabase client

### Input Validation
- All user input is validated on the backend before any DB write
- Amount field must be a positive number
- Text fields have max length limits enforced at DB and API level
- SQL injection is prevented by using Supabase's parameterized query client

### Credentials
- All secrets (Supabase service role key, Bedrock API key, Google credentials) stored in environment variables only
- `.env` file is in `.gitignore` and never committed to version control
- Rotate credentials immediately if accidentally exposed

### Agent Security
- Agent prompts are constructed server-side only
- User-supplied text is never injected directly into system prompts without sanitization
- Agent responses are validated for expected JSON structure before any DB write

---

*Blueprint version 1.0 — Last updated July 2026*
```

# ThoughtStack

An AI-powered personal operating system — tasks, journaling, habits, scheduling, and an intelligent assistant in one installable PWA with cross-device sync.

## Features

- **Tasks** — Today/Upcoming views, priorities, subtasks, tags, recurrence, smart natural-language input
- **Journal** — Markdown entries with templates, mood tracking, voice-to-text, photos, folders, tags
- **Habits** — daily habit tracker with streaks
- **Calendar** — monthly/agenda views, event scheduling, task sync
- **Thoughts AI** — natural-language assistant that creates tasks/events from plain text (Claude → Gemini → rule-based fallback)
- **PWA** — installable, offline-first (service worker + IndexedDB), background sync, push notification reminders, morning briefing
- **Accounts** — email/password auth with admin approval, self-service password change and account deletion

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Auth**: NextAuth v5 (credentials + JWT), bcrypt password hashing
- **Database**: Supabase (Postgres) — users, sync tables, tombstones, reminders, push subscriptions
- **State**: Zustand persisted to IndexedDB (`idb-keyval`)
- **Styling**: Tailwind CSS
- **UI**: Radix UI primitives (custom components), Lucide icons
- **AI**: Anthropic Claude API → Google Gemini fallback → built-in rule engine
- **Voice**: Web Speech API, OpenAI Whisper fallback for transcription
- **Push**: web-push (VAPID), Vercel/GitHub Actions cron for reminders

## Getting Started

### 1. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Configure environment

Create `.env.local`:

```env
# Supabase (required — auth + sync)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# NextAuth (required)
NEXTAUTH_SECRET=...

# Admin account seeded on first login
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
ADMIN_NAME=...

# AI providers (optional — falls back to rule engine)
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
OPENAI_API_KEY=...        # Whisper transcription fallback

# Push notifications (optional)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
CRON_SECRET=...           # protects /api/cron/* endpoints
```

Run the SQL files in `supabase/` (Supabase dashboard → SQL Editor) to create the tables.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── page.tsx          # Home / Dashboard
│   ├── tasks/            # Task management
│   ├── journal/          # Journaling
│   ├── habits/           # Habit tracker
│   ├── calendar/         # Calendar & scheduling
│   ├── account/          # Password change / delete account
│   ├── admin/            # User approval dashboard
│   ├── auth/             # Sign in / sign up
│   ├── settings/         # App settings
│   └── api/              # Auth, sync, thoughts AI, push, cron, admin
├── components/
│   ├── layout/           # AppShell, Sidebar, ThoughtsPanel, etc.
│   └── ui/               # Reusable UI components
├── hooks/                # Sync, notifications, shortcuts, focus timer...
├── store/useAppStore.ts  # Zustand global store (IndexedDB-persisted)
├── lib/                  # db (Supabase), thoughts-ai, email, utils
└── types/                # TypeScript types
```

## Data & Sync

Data lives in IndexedDB on-device and syncs to Supabase when signed in:

- Pull once per session, push every 5 minutes (chunked, throttled)
- Deletions propagate across devices via tombstones
- Duplicate cleanup runs automatically and is available manually in Settings

## Notifications

Task reminders and a morning briefing are delivered via web push. Cron endpoints (`/api/cron/*`, protected by `CRON_SECRET`) are triggered by GitHub Actions workflows in `.github/workflows/`. See `PUSH_NOTIFICATIONS_SETUP.md` for details.

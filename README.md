# ThoughtStack

An AI-powered personal operating system — productivity, learning, journaling, scheduling, and intelligent guidance in one adaptive workspace.

## Features

- **Tasks** — Today/Upcoming views, priority levels, reminders, AI-assisted scheduling
- **Journal** — Mood tracking, voice notes, folders, tags, AI insights
- **Skills** — Track any skill, AI-generated missions & learning modules, XP system
- **Calendar** — Monthly/agenda views, event scheduling, task sync
- **Analytics** — Productivity, learning, and wellness dashboards with charts
- **Thoughts AI** — Natural language assistant that creates tasks/events from plain text

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS + glassmorphism design system
- **UI**: Radix UI primitives (custom components)
- **State**: Zustand with localStorage persistence
- **Charts**: Recharts
- **AI**: Anthropic Claude API + rule-based fallback
- **Icons**: Lucide React

## Getting Started

### 1. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Add your Claude API key (optional — fallback AI works without it)

Create or edit `.env.local`:

```env
ANTHROPIC_API_KEY=your_key_here
```

Get a key at https://console.anthropic.com

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
│   ├── tasks/            # Task Management
│   ├── journal/          # Journaling System
│   ├── skills/           # Learning & Skills
│   ├── calendar/         # Calendar & Scheduling
│   ├── analytics/        # Analytics Dashboard
│   ├── profile/          # User Profile
│   ├── settings/         # App Settings
│   ├── export/           # Data Export
│   └── api/thoughts/     # Thoughts AI API route
├── components/
│   ├── layout/           # Sidebar, ThoughtsPanel, ThemeProvider
│   └── ui/               # Reusable UI components
├── store/
│   └── useAppStore.ts    # Zustand global store
├── lib/
│   ├── utils.ts          # Utilities
│   └── thoughts-ai.ts    # AI engine (Claude + fallback)
└── types/
    └── index.ts          # TypeScript types
```

## AI — "Thoughts"

Thoughts is the built-in AI assistant. It:
- Parses natural language to detect tasks, dates, priorities
- Creates tasks and calendar events from plain text
- Analyzes journal entries for mood patterns
- Gives productivity recommendations

It uses the **Claude API** when `ANTHROPIC_API_KEY` is set, and falls back to a **built-in rule-based engine** automatically when the API is unavailable.

## Data

All data is stored locally in your browser via `localStorage`. Nothing is sent to external servers (except your messages to the Thoughts AI endpoint if you configure a Claude API key).

Use the **Export** page to download your data as JSON.

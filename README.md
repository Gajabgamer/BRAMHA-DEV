# AgenticPulse

AgenticPulse is a product-intelligence workspace for teams that want to feel user pain early, trace it to real signals, and move from noise to action without losing momentum.

It brings together feedback, issue intelligence, automations, code analysis, GitHub workflows, and an operator-style dashboard that feels active the moment it opens.

## Why It Exists

Most teams do not lose because they lack data.  
They lose because the signal arrives too late, in the wrong place, with no urgency attached to it.

AgenticPulse is built to close that gap.

- Detect friction before it turns into churn
- Surface the issue that actually matters right now
- Turn product pain into visible action
- Connect insight, code, and execution in one loop

## What It Does

### Product Intelligence

- Tracks high-priority issues across dashboard, website, SDK, and feedback surfaces
- Highlights spikes, confidence, severity, trend, and source context
- Shows structured issue activity, reminders, tickets, and operator views

### GitHub Workspace

- Supports GitHub login and repository connection
- Lets users choose a primary repository
- Reads real files, analyzes code, prepares fixes, and opens pull requests
- Includes a code analysis workspace for inspecting code and generating patches

### Automations

- Runs repository-focused automations around issue detection and safe fixes
- Supports patch generation, commit preparation, and PR creation flows
- Presents a guided automation timeline that makes complex work easy to follow

### Agent Experience

- Keeps the interface feeling alive with issue context, activity, and guided actions
- Surfaces what deserves attention now, not a sea of raw logs
- Connects product signals to code and operational follow-through

## Core Experience

The feeling of AgenticPulse is simple:

1. A signal lands
2. The issue becomes visible
3. The system gives it shape
4. The team moves

That is the product.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Supabase
- Node/Express backend
- GitHub API integrations
- Vercel deployment

## Project Structure

```text
product-pulse/
├─ src/                 # Frontend app, dashboard, GitHub workspace, providers
├─ backend/             # API, controllers, services, automations, integrations
├─ packages/            # Shared SDK/package assets
├─ public/              # Static assets
├─ docs/                # Supporting product and workflow docs
└─ supabase_schema.sql  # Database schema snapshot
```

## Local Development

Install dependencies:

```bash
npm install
cd backend
npm install
```

Run the frontend:

```bash
npm run dev
```

Run the backend:

```bash
cd backend
npm run dev
```

Frontend default:

```text
http://localhost:3000
```

## Environment

Set the app up with the environment values needed for:

- Supabase
- GitHub OAuth
- GitHub token access
- Backend API base URL
- Any deployment-specific secrets

Use:

- [`.env.example`](/C:/Users/Dell/Desktop/you%20try/product-pulse/.env.example)
- backend environment configuration under [backend](/C:/Users/Dell/Desktop/you%20try/product-pulse/backend)

## Deployment

This project is designed to ship cleanly to Vercel for the frontend and a separate backend deployment for API/integration work.

Recommended flow:

1. Push changes to GitHub
2. Deploy frontend
3. Deploy backend
4. Verify dashboard, issue data, GitHub connection flow, and automation surfaces

## Product Tone

AgenticPulse should never feel like a sterile dashboard.

It should feel like:

- something important is happening
- the system understands why it matters
- the team has a path forward

That emotional clarity is part of the product, not decoration.

## Status

Active build focused on:

- issue intelligence
- dashboard orchestration
- GitHub automation workflows
- code analysis and patch generation
- connected product operations

---

Built to make product signals impossible to ignore.

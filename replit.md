# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenRouter (via Replit AI Integrations) — `google/gemini-3.1-flash-lite-preview`

## Artifacts

- **bug-predictor** (`/`) — BugPredictor: AI-powered code analysis tool. React + Vite frontend.
- **api-server** (`/api`) — Express 5 backend. Handles `/api/analyze` endpoint for AI code review.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/api-client-react/` — generated React Query hooks (from codegen)
- `lib/api-zod/` — generated Zod schemas (from codegen)
- `lib/integrations-openrouter-ai/` — OpenRouter AI client wrapper
- `artifacts/api-server/src/routes/analyze.ts` — AI analysis route (POST /api/analyze)
- `artifacts/bug-predictor/src/pages/Home.tsx` — main frontend page

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

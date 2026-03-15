# Plan 01 — Scaffold Next.js + Tailwind v4 + shadcn/ui

## Goal
Create a runnable Next.js (App Router) project with Tailwind v4 and shadcn/ui initialized, ready for EchoTalk MVP.

## Decisions
- Package manager: npm (pnpm not installed on host)
- Next.js: App Router
- TypeScript: enabled
- Tailwind: enabled (v4 as installed by create-next-app)
- UI: shadcn/ui (Radix + preset: nova)

## Steps
1. Scaffold Next.js app in repo root.
2. Initialize shadcn/ui with template `next`, base `radix`, preset `nova`.
3. Add baseline components:
   - `button`
   - `card`
4. Ensure aliases and helpers are present:
   - `components.json`
   - `lib/utils.ts` with `cn()` helper
5. Restore/keep documentation file `PRD.md` at repo root.

## Verification
- `npm run dev` starts successfully and renders the default page.
- shadcn components import works (e.g., `@/components/ui/button`).

# Research — Environment & Existing State

Recorded: 2026-07-30

Exploration performed before starting implementation of the app described
in `SPEC.md`. No code was written or changed as part of this research.

## 1. Project directory

- Path: `/Users/j.nrup/Documents/claude-projects/racket_score/`
- Contents before this research: only `SPEC.md` (just created). No source
  code, no `package.json`, no config files, no lockfiles.
- **Not a git repository.** No `.git` in this directory or any parent
  directory.

## 2. Prior memory

- No memory files exist yet for this project (memory directory is empty).
  This is a fresh start with no carried-over context from earlier sessions.

## 3. Supabase account state

- Organizations: 1 — `narupong-jm's Org` (id: `lbemomsztazmicxwjcbn`).
- Projects: 1 existing project, **unrelated to this app**:
  - Name: `narupong-jm's Project`
  - id/ref: `wmocbzpcquwjadhlkqxo`
  - Region: `ap-southeast-2`
  - Postgres version: `17.6.1.113` (engine 17, GA release channel)
  - Status: **INACTIVE** (paused)
  - Created: 2026-05-07
- No project exists yet for the badminton app — per `SPEC.md` a new
  Supabase project needs to be created.

## 4. Local dev tooling

| Tool         | Status                             |
| ------------ | ---------------------------------- |
| Node.js      | v20.13.1 — available               |
| npm          | 10.5.2 — available                 |
| git          | 2.39.5 (Apple Git-154) — available |
| Vercel CLI   | **not installed**                  |
| Supabase CLI | **not installed**                  |

- No Vercel MCP tool is available in this environment (only a Supabase MCP
  server is connected). There is no programmatic way to drive Vercel
  directly from here.

## 5. Constraints / open items for implementation

1. **Supabase free-tier project limits.** The account already has one
   project (inactive). Free-tier orgs are typically capped around 2
   projects. Likely fine to create a second project as planned, but this
   should be checked/handled gracefully at creation time in case the
   limit is hit.
2. **Vercel deployment path.** With no Vercel CLI or MCP tool present,
   deployment will require either (a) installing the Vercel CLI locally
   and deploying from the terminal, or (b) pushing to a GitHub remote and
   connecting it through the Vercel dashboard — which needs the user to
   authenticate with their own accounts, since neither is something this
   session can drive directly.
3. **No git repo yet.** `git init` (and a GitHub remote, if going the
   dashboard-integration route for Vercel) is needed before deployment.
4. **Greenfield build.** There is no existing scaffold to extend — the
   React project (tooling choice, e.g. Vite) and the full Supabase schema
   both need to be created from scratch based on `SPEC.md`.

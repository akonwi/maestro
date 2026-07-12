# AGENTS.md — Maestro Web

Guidance for work in `web/`. Read alongside `../AGENTS.md` and
`../docs/prediction-game-plan.md`.

## Stack

- React 19
- TanStack Router + TanStack Query
- Tailwind CSS v4
- shadcn/ui conventions
- Bun, Vite, Biome, Wrangler

## Design language

Match Ranger's visual system in `../../ranger/web-app`:

- Use the same semantic color tokens.
- Geist for UI text; JetBrains Mono for times, scores, and numeric data.
- Square edges, 1px borders, no decorative shadows.
- Black/white primary actions; blue active states; orange urgency; green
  success; red errors.
- Preserve both light and dark theme tokens.

## API

During development, Vite proxies `/api/*` to the Ard server at
`http://localhost:8080`. Keep server data access in `src/lib/` and use TanStack
Query for remote state.

## Required review after frontend work

After each completed body of frontend work, before reporting completion:

1. Activate and apply the `web-design-guidelines` skill to the changed UI.
2. Activate and apply the `vercel-react-best-practices` skill to the changed
   React/data-fetching code.
3. Address applicable findings. If a finding is intentionally deferred, state
   it explicitly in the completion summary.
4. Run:

```sh
bun run check
bun run typecheck
bun run build
```

Do not describe frontend work as complete until both reviews and all three
checks have passed.

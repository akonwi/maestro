# Maestro Web

Public fixture UI for Maestro, using the same design language as Ranger.

## Development

Run the Ard server on port 8080, then:

```sh
bun install
bun run dev
```

Vite proxies `/api/*` to `http://localhost:8080/*`.

## Checks

```sh
bun run typecheck
bun run check
bun run build
```

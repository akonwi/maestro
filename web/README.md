# Maestro Web

Public fixture UI for Maestro, using the same design language as Ranger.

## Development

Run the Ard server on port 8080, then:

```sh
bun install
bun run dev
```

Vite proxies `/api/*` to `http://localhost:8080/*`.

## Cloudflare deployment

The production Worker proxies same-origin `/api/*` requests to the Ard server.
Set this Worker environment variable in Cloudflare before deploying:

```text
API_ORIGIN=https://your-maestro-server.example.com
```

Use only the origin (and an optional fixed base path), without `/api` at the
end. `API_ORIGIN` is not exposed to browser JavaScript. All non-API requests
are delegated to the static asset binding with SPA fallback.

The Ard server must separately set `APP_BASE_URL` to the deployed web origin so
magic-link verification returns users to the correct application.

## Checks

```sh
bun run typecheck
bun run check
bun run build
```

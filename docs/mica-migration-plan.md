# Mica Migration Plan

> **Status: COMPLETE.** All three phases shipped on the ux.mica branch.
> Tailwind, shadcn, base-ui, tailwind-merge, the token bridge, and the
> .dark script are gone; the app renders from vendored mica (v0.2.1 line)
> + a fonts-only theme + app.css. Dark mode is pure light-dark()/OS.

Migrate the web app (`web/`) fully off Tailwind v4 + shadcn/base-ui onto
[mica](https://github.com/akonwi/mica) — the in-house custom-elements
design system. Hard migration: Tailwind, `@base-ui/react`,
`tailwind-merge`, and the shadcn token convention all go away by the end.

## Decisions (locked)

- **Full migration** off Tailwind — not coexistence. Two styling systems
  is a permanent tax.
- **Vendored** `mica.css` (+ any Tier-2 modules used) committed into
  `web/`. Vendoring is mica's first-class distribution channel. Refresh
  by re-copying from `../mica`; the diff is the upgrade review.
- **Token direction: maestro adopts mica's role names**
  (`--color-text`, `--color-surface`, `--color-primary`,
  `--color-on-primary`, …). The shadcn names
  (`--background`/`--foreground`/`--muted`…) are retired.
- **Dark mode moves to mica's model**: `color-scheme: light dark` +
  `light-dark()`. The `.dark` class and the inline `index.html` toggle
  script are removed at the end of Phase 2.
- **Gaps**: segmented control and badge get **built in mica** (its
  process: mockups skill → feedback loop → snapshot baselines).
  Comparison/data tables stay **maestro-local** custom elements/styles
  for now (they're product-specific; may graduate to mica later).

## Current inventory (what has to move)

- Tokens: shadcn-convention set in `src/index.css` (`@theme` +
  `:root`/`.dark` blocks) — used by every Tailwind utility.
- Components on `@base-ui/react`: Select (matchday navigator, group
  picker), Toggle/ToggleGroup (leaderboard period).
- Hand-rolled: `ui-button` classes, ARIA tablists (fixture outlook,
  match detail), comparison tables (numbers panel, goals matrix,
  standings), app header/footer, skip link, skeletons, toasts (none),
  forms (login, prediction score inputs), formation pitch.
- Fonts: Geist / JetBrains Mono via fontsource — kept, wired through
  mica's `--font-body` / `--font-mono`.

## Phases

### Phase 1 — plumbing + theme bridge

- Vendor `mica.css` into `web/src/vendor/` and import it first.
- Theme file (`src/theme.css`): set mica knobs to maestro's palette
  (`--hue` for the blue accent, fonts, status hues). Verify square
  corners and control heights match current look.
- JSX typings for `m-*` custom elements (React 19 handles the runtime).
- Temporary compatibility bridge: map the old shadcn token names to
  mica roles so existing Tailwind utilities keep working during the
  migration (`--color-background: var(--color-surface)` etc. —
  resolves the name-collision problem by making maestro's names derive
  from mica's, not fight them).
- Switch dark mode to `color-scheme`; keep the `.dark` class script
  only while Tailwind `dark:` variants remain.

### Phase 2 — component migration (route by route)

Order chosen so shared pieces land first:

1. App shell: header, nav, footer, skip link → mica elements + layout
   primitives (`m-hstack`, `m-vstack`).
2. Buttons: `ui-button`/`ui-button-primary` → mica button classes.
3. Forms: login email + prediction score inputs → mica inputs +
   `field.js` validation.
4. Tabs: hand-rolled tablists → mica tabs (markup/CSS; decide per case
   whether `tabs.js` or React state drives them — Tier-2 enhancers must
   not fight React-owned attributes).
5. Select: matchday navigator + group picker → mica select; then drop
   `@base-ui/react`.
6. Maestro-local elements: comparison table styles (numbers panel,
   goals matrix, standings table), formation pitch, fixture rows —
   rewritten as app CSS on mica tokens (no Tailwind utilities).
7. Segmented control + badge: **blocked on mica** building them; use
   interim app CSS if reached before mica ships them.

Each step: convert, run checks/build, visual pass in both schemes.

### Phase 3 — teardown

- Remove Tailwind (`tailwindcss`, `@tailwindcss/vite`), `tailwind-merge`,
  `shadcn`, `@base-ui/react`; delete `src/components/ui/`.
- Delete the shadcn token bridge and the `.dark` script; `index.css`
  becomes: vendored mica import + theme + maestro-local element styles.
- Biome: drop class-sorting config if Tailwind-specific.

## Mica-side work (separate sessions, mica's process)

- Segmented control (Tier 1/2 TBD by mica's tier discipline)
- Badge/chip (likely Tier 0/1, pure CSS)
- Candidates surfaced by this migration worth considering later:
  skeleton loaders, sr-only utility, data-table styles.

## Risks / watchpoints

- Tier-2 enhancers vs React attribute ownership (tabs, select) — decide
  per component; markup+CSS adoption with React state is the safe path.
- Mica select's customizable-picker styling is Chromium-only (native
  picker elsewhere) — acceptable, but verify the group picker UX on
  Safari/iOS.
- Mica is v0.1.x — vendoring pins us; upgrades are deliberate diffs.
- Visual drift during Phase 2: every conversion needs a side-by-side
  look in light + dark.

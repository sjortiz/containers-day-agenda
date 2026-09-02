# CLAUDE.md

This file gives Claude Code the project context needed to contribute safely and
productively. Read it before making changes.

## Project overview

Talk Track is a Spanish-language, multi-event PWA for building a personal
conference agenda and receiving reminders 10 minutes before selected talks. It
is a Next.js 15 / React 19 / TypeScript application exported as a fully static
site and deployed to GitHub Pages.

There is no backend, account system, database, or server push. Event metadata,
cached schedules, selections, and notification state live in the browser's
`localStorage`, scoped by event.

## Start here

```bash
make install
make dev
```

Before handing off a change, run:

```bash
make check
```

Run `make help` to see the remaining local commands. `npm` equivalents are
available in `package.json`.

## Architecture map

- `src/app/page.tsx`: event-library entry point.
- `src/app/event/page.tsx`: event detail route at `/event/?id=<event-id>`.
- `src/components/EventLibrary.tsx`: saved-event library orchestration.
- `src/components/AgendaApp.tsx`: agenda UI and event-specific behavior.
- `src/components/AddEventPanel.tsx`: Sessionize URL and QR import flow.
- `src/components/QrScanner.tsx`: live camera scanning and image fallback.
- `src/hooks/useAgendaRefresh.ts`: refresh lifecycle and polling.
- `src/hooks/useNotificationScheduler.ts`: local reminder scheduling.
- `src/lib/sessionize.ts`: Sessionize URL validation and response adapter.
- `src/lib/storage.ts`: event-scoped persistence and legacy migration.
- `src/lib/agenda-refresh.ts`: request deduplication, timeout, stale-response
  protection, and refresh status.
- `src/lib/agenda.ts`: filtering, grouping, selection, and notification
  reconciliation.
- `src/types.ts`: core `EventMeta`, `Agenda`, and `Session` contracts.
- `public/sw.js`: Service Worker and notification display behavior.
- `next.config.mjs`: static export and GitHub Pages base-path configuration.

Tests are colocated as `src/**/*.test.ts` and run with Node's native test runner
through `scripts/test-register.mjs`.

Project-local skills are checked into `.claude/skills/` and are discovered
automatically. Use the relevant skill when its description matches the task;
do not require contributors to install a global copy.

## Product constraints

Preserve these decisions unless the task explicitly changes them:

1. Event imports support public Sessionize API v2 URLs only. Do not add arbitrary
   page scraping, ICS, Pretalx, or custom JSON import implicitly.
2. Fetch live schedules directly from Sessionize in the browser. Do not restore
   a build-time agenda-fetching pipeline.
3. Do not introduce a proxy or backend without an explicit architectural
   decision from the maintainer.
4. Keep the application compatible with static export and GitHub Pages. Do not
   add server actions, API routes, middleware that requires a server, or runtime
   image optimization.
5. Do not add a WebAssembly SWC workaround. Use the normal native Next.js build
   toolchain; a local code-signature issue in the ChatGPT environment is not an
   application dependency.
6. The product UI is currently Spanish even though repository documentation is
   English. Match nearby UI copy unless a localization task says otherwise.
7. Containers Day is the built-in event and cannot be deleted. Imported events
   may be deleted with their scoped local state.
8. QR sharing contains only the public Sessionize URL and event name. Never
   include favorites, notification state, or other device-local data.

## Data and time invariants

- Validate event IDs with `isValidEventId` before using them in routes or storage
  keys.
- Keep persisted state scoped as `talk-track:<event-id>:...`; the event index is
  the intentional exception.
- Never overwrite existing scoped data during legacy Containers Day migration.
- Validate remote and cached agenda data before use.
- Treat Sessionize timestamps without an offset as local to the event time zone.
- Notification occurrences are keyed by both session ID and start time. When an
  organizer moves a session, reconcile the old occurrence so the reminder can be
  scheduled at the new time without duplicate or late notifications.
- Keep the last valid agenda available when refreshes fail or the device is
  offline.

## Refresh and notification behavior

- Refresh on initial load, focus, restored connectivity, restored visibility,
  and every minute while visible.
- Preserve concurrent-request deduplication, timeouts, stale-response protection,
  and bounded retry backoff.
- Browser notifications require HTTPS or localhost and only work while the PWA
  remains open, including in the background. A fully closed static PWA cannot
  receive server push.
- Camera support differs across browsers and installed PWAs. Maintain the native
  `BarcodeDetector` path, the `jsQR` fallback, manual URL entry, and photo/file
  fallback.

## Coding guidelines

- Prefer small, focused TypeScript functions and existing project patterns.
- Keep browser-only APIs behind client components or runtime guards.
- Preserve accessibility: semantic controls, keyboard operation, visible focus,
  skip navigation, and reduced-motion behavior.
- Avoid new dependencies when the platform or a small local utility is enough.
- Add or update focused tests for behavior changes, especially storage, time,
  refresh, Sessionize parsing, and notification reconciliation.
- Do not edit generated output in `.next/` or `out/`.
- Do not commit secrets, local environment files, or machine-specific paths.
- Preserve unrelated working-tree changes.

## Completion checklist

1. Confirm the change still works with a static export and repository base path.
2. Run `make check`.
3. Run `make build` when the change affects routing, configuration, PWA assets,
   or production behavior.
4. Review `git diff --check` and the final diff.
5. Update the README or specs when user-visible behavior or constraints change.
6. Do not commit, push, deploy, or delete branches unless the user asks.

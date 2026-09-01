# Multi-event Home and Event Pages

Status: Draft implementation specification

## Product model

The application has two interfaces:

1. `/` is the user's local event library. Users add events here and see one title card per event.
2. `/event/?id=<event-id>` renders the existing Talk Track agenda experience for the chosen event.

The event page reuses the current selection, filtering, refresh, freshness, and notification behavior. All persistent data is scoped to the event ID.

The query-string route is intentional. The application is exported statically to GitHub Pages, so one static `/event/` page can render any event stored locally without requiring runtime-generated server routes or a custom 404 router.

## Initial migration

- Containers Day is registered automatically as the first event.
- Existing flat local-storage state is copied once into Containers Day's event-scoped keys.
- Existing state is not deleted until the scoped copy succeeds.
- A migration marker prevents repeated migration.
- Existing notification occurrence keys remain valid after migration.

## Event identity

```ts
interface EventMeta {
  id: string;
  name: string;
  sourceUrl: string;
  timezone: string;
  provider: 'containers-day' | 'sessionize' | 'pretalx' | 'ics' | 'json';
  refreshMode: 'live' | 'manual';
  addedAt: string;
}
```

`Agenda` contains `event: EventMeta` plus its normalized sessions, rooms, labels, and `fetchedAt` timestamp.

Event IDs are stable, URL-safe identifiers derived from normalized source identity rather than user-visible event names. Session and event text is always rendered through normal JSX text interpolation.

## Event-scoped persistence

Persistent keys use the event ID:

```text
talk-track:events:v1
talk-track:<event-id>:agenda:v1
talk-track:<event-id>:selected:v1
talk-track:<event-id>:notified:v1
talk-track:<event-id>:sole-seeded:v1
talk-track:<event-id>:notifications-enabled:v1
```

The events index stores only event metadata and ordering. Full agendas live in their event-scoped keys.

Notification tags also include the event ID to avoid collisions between providers that reuse session IDs.

## Home interface

The home page provides:

- Application title and short explanation.
- An “Add event” form/dialog.
- Event title cards showing name, dates, source/provider, freshness mode, and optional next selected session.
- Clicking a card navigates to `/event/?id=<event-id>`.
- A remove action with confirmation; removal deletes only that event's local data.
- Empty, invalid-import, offline, and unsupported-source states.

## Event page

- Loads `id` from the query string on the client.
- Loads the matching normalized agenda from local storage or the bundled Containers Day fallback.
- Renders the existing `AgendaApp` behavior unchanged in presentation.
- Includes a clear way back to `/` and displays the event name instead of hardcoded Containers Day copy.
- Missing or removed event IDs show a recovery state linking back home.

## Adding events without a backend

The initial importer supports direct Sessionize API v2 endpoints only. Sessionize
documents these read-only endpoints as usable from client-side applications, so
the static PWA can import and refresh them without a backend. Arbitrary event
pages, JSON uploads, ICS, and other providers are out of scope for this phase.

## Delivery phases

### Phase 1: Event model, storage, and migration

- Add event metadata and event-aware agenda validation.
- Add the event index and scoped storage APIs.
- Migrate current Containers Day state once.
- Scope selected sessions, seeded defaults, notification history, notification enablement, and notification tags.

Acceptance criteria:

- Two event IDs cannot read or overwrite each other's state.
- Existing Containers Day selections and notification history survive migration.
- Invalid event IDs cannot escape the expected key or URL namespace.

### Phase 2: Home and reusable event route

- Change `/` into the event library.
- Add the static `/event/` route.
- Make `AgendaApp` event-aware while preserving its existing agenda interaction.
- Add navigation, missing-event, removal, and empty states.

Acceptance criteria:

- Containers Day appears automatically as a card.
- Clicking its card opens the existing agenda interface.
- Adding two normalized test events creates two independent cards and event pages.
- Refresh, selections, notifications, and filters operate on the active event only.
- Reloading a deep `/event/?id=` URL works on GitHub Pages.

### Phase 3: Initial importer

- Add provider adapter interfaces.
- Support direct Sessionize API v2 `GridSmart`/endpoint URLs first.
- Normalize Sessionize rooms, sessions, speakers, labels, and service sessions.
- Refresh every imported event from its own Sessionize endpoint.

Acceptance criteria:

- A valid supported import creates a card and navigable event page.
- Duplicate imports update or focus the existing event rather than cloning it silently.
- Invalid, unreachable, or incompatible API endpoints fail clearly.
- Imported strings cannot inject markup.

## Later importer options

ICS, Pretalx, normalized JSON, and arbitrary event-page extraction remain future
options. They are not implied by the first Sessionize-only release.

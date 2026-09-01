# Resilient Agenda Refresh and Notification Rescheduling

Status: Draft for refinement  
Source: Claude CLI repository review, followed by direct code verification  
Scope: Runtime agenda freshness, schedule-change handling, notifications, resilience, and related cleanup

## Context

Talk Track is a static Next.js PWA. The agenda is generated at build time and can be replaced at runtime by a newer `/agenda.json` payload.

The current runtime refresh is tied to the notification scheduler: when a selected or automatically announced session enters its locally known ten-minute notification window, the app emits the notification and schedules an agenda refresh with one second to two minutes of jitter.

This is unreliable when organizers change the timeline rapidly. The refresh decision depends on the same local start time that may already be stale.

Confirmed failure modes include:

- Users without notifications enabled receive no runtime network refresh.
- A delayed talk can produce a notification for its old time before the refresh discovers the delay.
- A talk moved earlier can miss its real notification window because the old local time never triggers a timely refresh.
- Opening the app does not immediately validate the cached or build-time agenda against the published feed.
- Returning to the app or regaining connectivity does not independently refresh the feed.
- Refresh failures are silent, leaving users unable to judge whether the displayed schedule is current.

## Goals

- Keep the displayed agenda current independently of notification permission or selection state.
- Detect schedule changes within a predictable time bound while the event is active.
- Prevent duplicate requests and stale responses from regressing state.
- Re-evaluate notification eligibility immediately after schedule changes.
- Communicate data freshness and offline/failure states without alarming or distracting users.
- Preserve offline use through the cached agenda.

## Non-goals

- Server push or a new real-time backend.
- Guaranteed background notifications while the PWA is fully closed.
- Editing or publishing the organizer's source agenda.
- Replacing the existing service worker or deployment model unless later testing proves it necessary.

## Current architecture

- `src/app/page.tsx` loads the build-time agenda and passes it to `AgendaApp`.
- `src/components/AgendaApp.tsx` owns the active agenda state and adopts a newer local-storage copy on mount.
- `src/lib/agenda-remote.ts` fetches `/agenda.json`, loosely validates it, and compares `fetchedAt` timestamps.
- `src/hooks/useNotificationScheduler.ts` checks eligible sessions every 30 seconds and when the document becomes visible.
- The notification scheduler is currently the only caller that triggers a runtime agenda refresh.
- `src/lib/agenda.ts` reconciles stored notification IDs after agenda changes.
- `public/sw.js` handles `/agenda.json` network-first with a cached fallback, but it does not initiate requests itself.

## Proposed design

### 1. Independent agenda synchronization

Create `src/hooks/useAgendaRefresh.ts` and mount it unconditionally from `AgendaApp`.

The hook should:

- Fetch once when the app mounts.
- Poll only while the document is visible.
- Refresh when the document becomes visible.
- Refresh on window focus.
- Refresh when the browser emits `online`.
- Apply and cache a response only when it is newer than the active agenda.
- Expose refresh and freshness state to the UI.

Initial cadence proposal, subject to refinement:

- During the event or within 60 minutes of an upcoming selected session: every 3–5 min.
- Outside the active window: every 15–25 minutes.
- Pause interval polling while hidden.
- Use at most a small 0–120 second jitter for synchronized mount, focus, or visibility events.


### 2. Central request coordination

All refresh sources should call one `requestRefresh()` function.

It should provide:

- A shared in-flight promise so concurrent triggers reuse one request.
- Cleanup through `AbortController` when the component unmounts.
- A request timeout.
- A monotonically increasing request generation or equivalent guard.
- The existing `fetchedAt` comparison as a second defense against state regression.

Routine overlapping triggers should be deduplicated rather than repeatedly aborting and restarting the same useful request. Abort should primarily support unmount, timeout, or an explicitly superseding request.

### 3. Retry and backoff

Track consecutive failures and apply bounded exponential backoff to background polling. Proposed sequence:

- 30 seconds
- 2 minute
- 4 minutes
- 10 minutes maximum

Successful refreshes reset the failure counter and normal cadence. Explicit freshness moments such as focus or `online` should be allowed to retry immediately rather than wait for background backoff.

The refresh layer should distinguish at least:

- Success with a newer agenda
- Success with an unchanged agenda
- Offline/network failure
- HTTP failure
- Timeout
- Invalid payload

### 4. Freshness UI

Expose the following state from the refresh hook:

```ts
interface AgendaRefreshState {
  refreshing: boolean;
  lastAttemptAt: number | null;
  lastSuccessfulSyncAt: number | null;
  consecutiveFailures: number;
  status: 'idle' | 'refreshing' | 'fresh' | 'offline' | 'error';
}
```

Add `src/components/FreshnessIndicator.tsx` with compact Spanish messages such as:

- `Actualizado hace 25 s`
- `Actualizando…`
- `Sin conexión — mostrando horario guardado`
- `No se pudo comprobar el horario desde hace 8 min`

Reuse the existing accessible status pattern (`role="status"` and `aria-live="polite"`) without repeatedly announcing ordinary polling activity.

### 5. Schedule-aware notification history

Notification history is currently keyed only by session ID. Change its logical identity to include the scheduled start occurrence:

```text
session-id@scheduled-start
```

Expected behavior:

- Same ID and same start: never duplicate the reminder.
- Same ID with a later start: allow a reminder for the new occurrence.
- Same ID moved earlier but still upcoming: evaluate against the new time immediately.
- Session moved into the past or already underway: do not emit a misleading ten-minute reminder.
- Removed session: prune stored notification occurrences.

Migration must safely read and clean up the existing ID-only local-storage format.

### 6. Immediate reevaluation after an update

Installing a newer agenda should immediately re-run notification eligibility rather than waiting for the next 30-second interval.

When a selected session changes:

- If its new start is inside the notification window, notify using the updated time.
- If it moved outside the notification window, do not notify.
- If an old-time notification was already shown, consider replacing it with the same notification tag and a correction such as `Horario actualizado`.

Correction notifications are optional for the first implementation and should be limited to meaningful selected-session changes, such as time or room, to avoid notification noise.

### 7. Agenda validation

Extract the duplicated `looksLikeAgenda` logic from `src/lib/agenda-remote.ts` and `src/lib/storage.ts` into `src/lib/agenda-validation.ts`.

Validate at least:

- Non-empty, unique session IDs
- Valid `fetchedAt`
- Valid session start and end timestamps
- End later than start
- Required title and room strings
- Speakers as an array of strings
- Expected timezone shape

Invalid remote data must not replace the last valid agenda or break rendering and notification checks.

## Delivery plan

### Phase 1: Decouple refresh from notifications

Files:

- Add `src/hooks/useAgendaRefresh.ts`
- Update `src/components/AgendaApp.tsx`
- Update `src/hooks/useNotificationScheduler.ts`

Acceptance criteria:

- Opening the app performs a network freshness check.
- Refresh works when notifications are disabled or denied.
- A newer agenda updates the UI and local cache.
- An unchanged agenda does not cause unnecessary state churn.
- The notification scheduler no longer owns agenda fetching.

### Phase 2: Lifecycle triggers and request coordination

Files:

- Extend `src/hooks/useAgendaRefresh.ts`
- Update `src/lib/agenda-remote.ts` to accept an abort signal and expose useful failure information.

Acceptance criteria:

- Visible polling follows the configured cadence.
- Hidden tabs do not continue interval polling.
- Visibility, focus, and online events trigger a freshness check.
- Concurrent triggers share one in-flight request.
- Late or superseded responses cannot regress the active agenda.
- Timers, listeners, and requests are cleaned up on unmount.

### Phase 3: Retry and freshness UX

Files:

- Extend `src/hooks/useAgendaRefresh.ts`
- Add `src/components/FreshnessIndicator.tsx`
- Update `src/components/AgendaApp.tsx`
- Optionally add a relative-time helper to `src/lib/time.ts`

Acceptance criteria:

- Repeated background failures use bounded exponential backoff.
- Focus and online events may retry immediately.
- A successful request resets backoff and clears the stale warning.
- Users can tell when the agenda was last successfully checked.
- Offline fallback remains usable.

### Phase 4: Notification rescheduling

Files:

- Update `src/lib/agenda.ts`
- Update `src/lib/storage.ts`
- Update `src/hooks/useNotificationScheduler.ts`
- Optionally update `src/lib/notifications.ts` for correction notifications.

Acceptance criteria:

- Delaying a previously notified session permits a reminder at its new time.
- Pulling a session earlier is detected by independent refresh, not the stale local notification window.
- Refreshes that do not change the start time do not duplicate reminders.
- Sessions moved into the past do not produce late ten-minute reminders.
- Eligibility is recalculated immediately after a newer agenda is installed.

### Phase 5: Validation and cleanup

Files:

- Add `src/lib/agenda-validation.ts`
- Update `src/lib/agenda-remote.ts`
- Update `src/lib/storage.ts`

Acceptance criteria:

- Malformed agendas are rejected without replacing the last valid copy.
- Remote and cached agendas use the same validator.
- Validation errors are observable through refresh state without breaking the UI.

## Test plan

Add or extend tests for:

- Initial fetch with notifications disabled.
- Visible and hidden polling behavior.
- Focus, visibility, and online refresh triggers.
- Concurrent-trigger request deduplication.
- Timeout, failure backoff, and success reset.
- Out-of-order response protection.
- Newer, equal, older, and invalid `fetchedAt` values.
- Talk moved earlier.
- Talk moved later.
- Talk moved into the past.
- Room-only change.
- Session removed or renamed.
- Notification occurrence identity using ID plus start time.
- Migration from the current ID-only notified set.
- Invalid remote and cached payload rejection.
- Fresh, refreshing, offline, and failed freshness indicator states.

Hook tests should use fake timers and controllable fetch promises. Pure schedule transitions should remain in deterministic library-level tests where possible.

## Additional improvements

Lower-priority items identified during review:

- Detect notification permission changes made outside the app while it remains open.
- Review cross-tab synchronization for the `SOLE_SEEDED_KEY` state.
- Ensure the freshness indicator does not create repetitive screen-reader announcements.
- Preserve the existing `isNewerAgenda` guard so polling does not repeatedly recreate scheduler intervals for unchanged data.
- Review focus placement after clearing selections.
- Consider whether the service worker should expose that `/agenda.json` came from cache; the page-level freshness state may already provide sufficient UX.

## Open decisions

- Exact active-event and idle polling cadences.
- Whether selected sessions should influence cadence or whether all event-time polling should be uniform.
- Freshness threshold before showing a warning.
- Whether correction notifications ship in the first notification-rescheduling phase.
- Whether a room-only change warrants a correction notification.
- How long notification occurrence history should be retained.
- Whether `fetchedAt` is sufficient as the authoritative version or the feed should add an explicit revision/hash.

## Verification note

The repository review was performed with the Claude CLI and then checked against the relevant source files and recent commit history. Tests could not be executed in that environment because `npm` was not available on `PATH`; implementation work should begin by running the existing suite in a configured Node.js environment.

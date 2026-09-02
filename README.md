# Talk Track

A PWA that brings event schedules together—including Containers Day and public
Sessionize APIs—lets you **build your personal agenda** (stored on your device,
with no account or backend), and **notifies you 10 minutes before** each selected
talk with its **room, title, and speaker**.

Built with **Next.js** as a static export for deployment to **GitHub Pages**.

## Features

### Event library

- A home screen containing all events saved on the device.
- Containers Day is included by default and loads its schedule directly from its
  public Sessionize endpoint.
- Import multiple events by pasting a public Sessionize API v2 URL.
- Each card shows the event name, dates, session count, and refresh status; opening
  it takes you to that event's independent schedule.
- Imported events can be deleted with confirmation, along with their local data.
  Containers Day always remains available.

### QR importing and sharing

- Add an event using a Sessionize URL or by scanning a QR code.
- Generate a QR code to share a saved event. It contains the public URL and event
  name, never the user's favorites.
- Live scanning with `BarcodeDetector`, with a `jsQR`-based fallback.
- A **Take a photo of the QR code** option for iOS, PWAs, or browsers where live
  camera video is unavailable.
- Manual URL entry is always available.

### Personal agenda

- Select talks with ★, stored independently for each event.
- Search by title, room, speaker, and tag.
- Filter by room and tag, plus a **My talks only** view.
- Chronological grouping by time and an option to clear the selection.
- Sessions that are the only option in their time slot are selected once by
  default, but users can deselect them afterward.
- Automatic identification of service blocks.
- A countdown banner for the next selected session.

### Live updates and schedule-change resilience

- Fetches Sessionize directly when an event opens, the window regains focus, the
  device comes back online, or the tab becomes visible again.
- Polls every minute while the schedule is visible to pick up changes made by
  organizers during the event.
- Deduplicated requests with timeouts, stale-response protection, and progressive
  retry delays.
- Caches the latest valid schedule for offline access or temporary Sessionize
  failures.
- Freshness indicator showing when the app is refreshing, when it last updated,
  when it is using an offline copy, or when an error occurred.
- If a talk's start time changes, pending notifications are rescheduled using the
  latest information.
- Sessionize times without an explicit offset are interpreted in the event's time
  zone.

### Notifications and PWA

- Native notifications 10 minutes before each selected talk, including its title,
  room, and speaker.
- Controls to enable, disable, and test notifications.
- Notifications are scoped by event to prevent collisions between schedules.
- Installable as a PWA on Android and iOS, with platform-specific guidance.
- Service Worker, offline app shell, and a responsive mobile and desktop interface.
- Skip-to-content link, semantic controls, visible focus states, and support for
  reduced-motion preferences.

### Privacy and storage

- No account or backend required: the event library, cached schedules, and
  selections are stored in `localStorage` on the device.
- Existing data is migrated to the multi-event format without losing selections.
- Sharing an event does not share favorites or any other personal data.

## Current limitations

- Imports support public **Sessionize API v2** endpoints. Arbitrary event pages,
  ICS files, and other providers are not supported yet.
- GitHub Pages is fully static, so there is no server-side push. Notifications work
  while the PWA remains open, including in the background, but cannot arrive when
  the app is completely closed.

## Development

```bash
make install           # install dependencies
make dev               # http://localhost:3000 (no basePath in development)
make test              # run the test suite
make check             # run tests and TypeScript checks
make icons             # regenerate PWA icons (optional)
```

The equivalent `npm` commands can also be run directly.

### Claude Code quick start

The repository includes project instructions in [`CLAUDE.md`](./CLAUDE.md) and
safe shared permissions in [`.claude/settings.json`](./.claude/settings.json).
After installing and authenticating Claude Code, start it from the repository
root:

```bash
claude
```

Claude will automatically load the project's architecture, constraints,
validation commands, and shared configuration. Personal overrides belong in
`.claude/settings.local.json` and should not be committed.

## Claude Code skills

The repository includes the following project-local skills from
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) when
working on this project with Claude Code:

- `vercel-react-best-practices`
- `vercel-composition-patterns`
- `vercel-react-view-transitions`
- `web-design-guidelines`
- `writing-guidelines`

Claude Code discovers them automatically under `.claude/skills/`; users do not
need to install them globally. Their source versions and hashes are recorded in
`skills-lock.json`.

We do not include Vercel deployment, CLI, or optimization skills because
this project is deployed as a static export on GitHub Pages. The React Native
skill is also excluded because this application is a web PWA.

To refresh the checked-in copies deliberately, run:

```bash
npx skills add vercel-labs/agent-skills --agent claude-code \
  --skill vercel-composition-patterns vercel-react-best-practices \
  vercel-react-view-transitions web-design-guidelines writing-guidelines \
  --yes --copy
```

## Local build

```bash
npm run build          # generate the static site in ./out
npx serve out          # preview the export
```

> Notifications and the Service Worker require **HTTPS** or **localhost**.

## Deploying to GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages → Build and deployment → Source**, select
   **GitHub Actions**.
3. Every push to `main` triggers `.github/workflows/deploy.yml`, which:
   - calculates `basePath` automatically from the repository name
     (`/<repo>` for project pages, or empty for `username.github.io`),
   - generates the static export and publishes `./out`.

The site will be available at `https://<username>.github.io/<repo>/`.

### Repository name and base path

The workflow derives `basePath` automatically. For a **local build**, the default
is `/containers-day-agenda`. If your repository has a different name, provide it
explicitly:

```bash
NEXT_PUBLIC_BASE_PATH=/your-repo npm run build
```

### Custom domain (optional)

Add a `public/CNAME` file containing your domain and set
`NEXT_PUBLIC_BASE_PATH=""`.

## Schedule refresh

The PWA queries each event's Sessionize endpoint directly when the event opens,
when focus or connectivity returns, and during visible polling. The latest valid
response is stored locally and used while the device is offline.

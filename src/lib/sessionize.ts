import type { Agenda, EventMeta, Session } from '@/types';
import type { AgendaFetchResult } from './agenda-remote';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null ? value as JsonObject : null;
}

function endpointId(url: string): string | null {
  return new URL(url).pathname.match(/\/api\/v2\/([a-z0-9]+)(?:\/|$)/i)?.[1] ?? null;
}

/** Converts Sessionize's offset-less local timestamps into real instants. */
export function sessionizeInstant(value: string, timezone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  const desired = Date.parse(`${value}Z`);
  let instant = desired;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = Object.fromEntries(
        formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
      );
      const rendered = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour), Number(parts.minute), Number(parts.second),
      );
      instant += desired - rendered;
    }
    return new Date(instant).toISOString();
  } catch {
    return null;
  }
}

export function isSessionizeUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === 'sessionize.com' || host.endsWith('.sessionize.com');
  } catch {
    return false;
  }
}

export function normalizeSessionizeGrid(
  data: unknown,
  input: { endpointUrl: string; name: string; timezone: string; existing?: EventMeta },
): Agenda | null {
  if (!Array.isArray(data)) return null;
  const sessions: Session[] = [];
  for (const dayValue of data) {
    const day = object(dayValue);
    if (!day || !Array.isArray(day.rooms)) return null;
    for (const roomValue of day.rooms) {
      const room = object(roomValue);
      if (!room || typeof room.name !== 'string' || !Array.isArray(room.sessions)) return null;
      for (const sessionValue of room.sessions) {
        const item = object(sessionValue);
        if (!item || typeof item.id !== 'string' || typeof item.title !== 'string' ||
          typeof item.startsAt !== 'string' || typeof item.isServiceSession !== 'boolean') return null;
        const speakers = Array.isArray(item.speakers)
          ? item.speakers.flatMap((value) => {
              const speaker = object(value);
              return speaker && typeof speaker.name === 'string' ? [speaker.name] : [];
            }) : [];
        const labels = Array.isArray(item.categories)
          ? item.categories.flatMap((value) => {
              const category = object(value);
              return category && Array.isArray(category.categoryItems)
                ? category.categoryItems.flatMap((entry) => {
                    const label = object(entry);
                    return label && typeof label.name === 'string' ? [label.name] : [];
                  }) : [];
            }) : [];
        const start = sessionizeInstant(item.startsAt, input.timezone);
        const end = typeof item.endsAt === 'string'
          ? sessionizeInstant(item.endsAt, input.timezone)
          : null;
        if (!start || (typeof item.endsAt === 'string' && !end)) return null;
        sessions.push({
          id: item.id, title: item.title, room: room.name, speakers, labels,
          isService: item.isServiceSession, start, end,
        });
      }
    }
  }
  sessions.sort((a, b) => a.start.localeCompare(b.start) || a.room.localeCompare(b.room));
  const id = endpointId(input.endpointUrl);
  if (!id || sessions.length === 0) return null;
  const now = new Date().toISOString();
  return {
    event: input.existing ?? {
      id: `sessionize-${id.toLowerCase()}`, name: input.name,
      sourceUrl: input.endpointUrl, timezone: input.timezone,
      provider: 'sessionize', refreshMode: 'live', addedAt: now,
    },
    utcOffset: '+00:00', fetchedAt: now,
    rooms: [...new Set(sessions.map((session) => session.room))],
    labels: [...new Set(sessions.flatMap((session) => session.labels))].sort(),
    sessions,
  };
}

export async function fetchSessionizeAgenda(
  sourceUrl: string,
  signal?: AbortSignal,
  existing?: EventMeta,
): Promise<AgendaFetchResult> {
  try {
    const id = isSessionizeUrl(sourceUrl) ? endpointId(sourceUrl) : null;
    if (!id) return { ok: false, reason: 'invalid' };
    const endpointUrl = `https://sessionize.com/api/v2/${id}/view/GridSmart`;
    const first = await fetch(endpointUrl, { cache: 'no-store', signal });
    if (!first.ok) return { ok: false, reason: 'http', status: first.status };
    let data: unknown;
    try { data = await first.json(); } catch { return { ok: false, reason: 'invalid' }; }
    const agenda = normalizeSessionizeGrid(data, {
      endpointUrl, name: existing?.name ?? `Evento Sessionize ${id}`,
      timezone: existing?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      existing,
    });
    return agenda ? { ok: true, agenda } : { ok: false, reason: 'invalid' };
  } catch (error) {
    return signal?.aborted
      ? { ok: false, reason: 'aborted' }
      : { ok: false, reason: 'network', error };
  }
}

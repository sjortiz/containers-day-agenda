import type { Agenda, EventMeta, Session } from '@/types';
import type { AgendaFetchResult } from './agenda-remote';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null ? value as JsonObject : null;
}

function endpointId(url: string): string | null {
  return new URL(url).pathname.match(/\/api\/v2\/([a-z0-9]+)(?:\/|$)/i)?.[1] ?? null;
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
        sessions.push({
          id: item.id, title: item.title, room: room.name, speakers, labels,
          isService: item.isServiceSession, start: item.startsAt,
          end: typeof item.endsAt === 'string' ? item.endsAt : null,
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

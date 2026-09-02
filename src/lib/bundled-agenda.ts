import type { Agenda } from '@/types';

/**
 * Keeps an existing cached schedule while adopting source metadata shipped by
 * a newer app version (for example, the Containers Day HTML→Sessionize move).
 */
export function reconcileBundledAgenda(cached: Agenda | null, bundled: Agenda): Agenda {
  if (!cached) return bundled;
  if (cached.event.id !== bundled.event.id) return bundled;
  return { ...cached, event: bundled.event };
}

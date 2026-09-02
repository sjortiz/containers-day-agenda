import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Agenda } from '@/types';
import { reconcileBundledAgenda } from './bundled-agenda';

const bundled = {
  event: {
    id: 'containers-day', name: 'Containers Day',
    sourceUrl: 'https://sessionize.com/api/v2/hnm5gsws/view/GridSmart',
    timezone: 'America/Santo_Domingo', provider: 'sessionize',
    refreshMode: 'live', addedAt: '2026-08-22T00:00:00Z',
  },
  utcOffset: '-04:00', fetchedAt: '2026-08-22T00:00:00Z',
  rooms: [], labels: [], sessions: [],
} satisfies Agenda;

describe('reconcileBundledAgenda', () => {
  it('upgrades source metadata without discarding cached sessions', () => {
    const cached: Agenda = {
      ...bundled,
      event: { ...bundled.event, sourceUrl: 'https://containers.day/agenda/', provider: 'containers-day' },
      sessions: [{ id: '1', title: 'Cached', room: 'Main', speakers: [], labels: [],
        isService: false, start: '2026-08-22T09:00:00-04:00', end: null }],
    };
    const result = reconcileBundledAgenda(cached, bundled);
    assert.equal(result.event.provider, 'sessionize');
    assert.equal(result.sessions[0].title, 'Cached');
  });
});

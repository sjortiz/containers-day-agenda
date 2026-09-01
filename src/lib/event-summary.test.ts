import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Agenda } from '@/types';
import {
  eventDateSummary,
  eventSessionSummary,
  providerLabel,
} from './event-summary';

function makeAgenda(starts: string[]): Agenda {
  return {
    event: {
      id: 'demo-event',
      name: 'Demo Event',
      sourceUrl: 'https://example.com/agenda',
      timezone: 'America/Santo_Domingo',
      provider: 'json',
      refreshMode: 'manual',
      addedAt: '2026-08-01T00:00:00Z',
    },
    utcOffset: '-04:00',
    fetchedAt: '2026-08-01T00:00:00Z',
    rooms: ['A'],
    labels: [],
    sessions: starts.map((start, index) => ({
      id: String(index),
      title: `Session ${index}`,
      room: 'A',
      speakers: [],
      labels: [],
      isService: false,
      start,
      end: null,
    })),
  };
}

describe('event summaries', () => {
  it('formats a single event day with Intl', () => {
    const agenda = makeAgenda(['2026-08-22T09:00:00-04:00']);
    assert.match(eventDateSummary(agenda), /22/);
    assert.match(eventDateSummary(agenda), /2026/);
  });

  it('formats a date range and ignores session input order', () => {
    const agenda = makeAgenda([
      '2026-08-23T09:00:00-04:00',
      '2026-08-22T09:00:00-04:00',
    ]);
    assert.match(eventDateSummary(agenda), /22.*–.*23/);
  });

  it('handles empty and singular session counts', () => {
    assert.equal(eventDateSummary(makeAgenda([])), 'Sin sesiones');
    assert.equal(eventSessionSummary(makeAgenda([])), '0 sesiones');
    assert.equal(
      eventSessionSummary(makeAgenda(['2026-08-22T09:00:00-04:00'])),
      '1 sesión',
    );
  });

  it('provides readable provider labels', () => {
    assert.equal(providerLabel('ics'), 'Calendario ICS');
    assert.equal(providerLabel('json'), 'Agenda JSON');
  });
});

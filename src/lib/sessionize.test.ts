import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSessionizeUrl, normalizeSessionizeGrid, sessionizeInstant } from './sessionize';

const grid = [{
  date: '2026-09-01T00:00:00Z',
  rooms: [{ id: 1, name: 'Main', sessions: [{
    id: 'talk-1', title: 'A talk', startsAt: '2026-09-01T14:00:00Z',
    endsAt: '2026-09-01T15:00:00Z', isServiceSession: false,
    speakers: [{ id: 'speaker-1', name: 'Ada' }],
    categories: [{ categoryItems: [{ id: 1, name: 'Web' }] }],
  }] }],
}];

describe('Sessionize adapter', () => {
  it('interprets offset-less Sessionize times in the event timezone', () => {
    assert.equal(
      sessionizeInstant('2026-08-22T09:00:00', 'America/Santo_Domingo'),
      '2026-08-22T13:00:00.000Z',
    );
  });
  it('accepts Sessionize URLs and rejects other hosts', () => {
    assert.equal(isSessionizeUrl('https://sessionize.com/api/v2/abc123/view/GridSmart'), true);
    assert.equal(isSessionizeUrl('https://example.com/api/v2/abc123/view/GridSmart'), false);
  });

  it('normalizes GridSmart data into a live scoped agenda', () => {
    const agenda = normalizeSessionizeGrid(grid, {
      endpointUrl: 'https://sessionize.com/api/v2/abc123/view/GridSmart',
      name: 'Demo Conf', timezone: 'UTC',
    });
    assert.ok(agenda);
    assert.equal(agenda.event.id, 'sessionize-abc123');
    assert.equal(agenda.event.refreshMode, 'live');
    assert.deepEqual(agenda.sessions[0].speakers, ['Ada']);
    assert.deepEqual(agenda.labels, ['Web']);
  });

  it('rejects malformed and empty grids', () => {
    assert.equal(normalizeSessionizeGrid({}, {
      endpointUrl: 'https://sessionize.com/api/v2/abc123/view/GridSmart', name: 'Demo', timezone: 'UTC',
    }), null);
    assert.equal(normalizeSessionizeGrid([], {
      endpointUrl: 'https://sessionize.com/api/v2/abc123/view/GridSmart', name: 'Demo', timezone: 'UTC',
    }), null);
  });
});

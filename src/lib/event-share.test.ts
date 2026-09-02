import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eventShareUrl, parseEventShareUrl } from './event-share';

describe('event QR payload', () => {
  it('round-trips the event name without changing the endpoint', () => {
    const sourceUrl = 'https://sessionize.com/api/v2/abc123/view/GridSmart';
    const shared = eventShareUrl(sourceUrl, 'Mi Conferencia & Amigos');
    assert.deepEqual(parseEventShareUrl(shared), {
      sourceUrl,
      name: 'Mi Conferencia & Amigos',
    });
  });
});

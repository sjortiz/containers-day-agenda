import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Agenda } from '@/types';
import { isNewerAgenda } from './agenda-remote';

function makeAgenda(fetchedAt: string): Agenda {
  return {
    event: {
      id: 'containers-day',
      name: 'Containers Day',
      sourceUrl: 'https://containers.day/agenda',
      timezone: 'America/Santo_Domingo',
      provider: 'containers-day',
      refreshMode: 'live',
      addedAt: fetchedAt,
    },
    utcOffset: '-04:00',
    fetchedAt,
    rooms: [],
    labels: [],
    sessions: [],
  };
}

describe('isNewerAgenda', () => {
  it('true cuando next tiene fetchedAt posterior', () => {
    assert.equal(
      isNewerAgenda(
        makeAgenda('2026-08-22T10:00:00-04:00'),
        makeAgenda('2026-08-22T09:00:00-04:00'),
      ),
      true,
    );
  });

  it('false cuando next es igual o anterior', () => {
    assert.equal(
      isNewerAgenda(
        makeAgenda('2026-08-22T09:00:00-04:00'),
        makeAgenda('2026-08-22T10:00:00-04:00'),
      ),
      false,
    );
    assert.equal(
      isNewerAgenda(
        makeAgenda('2026-08-22T09:00:00-04:00'),
        makeAgenda('2026-08-22T09:00:00-04:00'),
      ),
      false,
    );
  });

  it('false si next.fetchedAt no es una fecha válida', () => {
    assert.equal(
      isNewerAgenda(
        makeAgenda('no-es-fecha'),
        makeAgenda('2026-08-22T09:00:00-04:00'),
      ),
      false,
    );
  });

  it('true si current.fetchedAt es inválida pero next es válida', () => {
    assert.equal(
      isNewerAgenda(
        makeAgenda('2026-08-22T09:00:00-04:00'),
        makeAgenda('basura'),
      ),
      true,
    );
  });
});

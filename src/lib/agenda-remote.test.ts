import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Agenda } from '@/types';
import {
  isNewerAgenda,
  scheduleJitterMs,
  fetchPublishedAgenda,
} from './agenda-remote';

function makeAgenda(fetchedAt: string): Agenda {
  return {
    source: 'https://containers.day/agenda',
    timezone: 'America/Santo_Domingo',
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
      isNewerAgenda(makeAgenda('2026-08-22T10:00:00-04:00'), makeAgenda('2026-08-22T09:00:00-04:00')),
      true,
    );
  });

  it('false cuando next es igual o anterior', () => {
    assert.equal(
      isNewerAgenda(makeAgenda('2026-08-22T09:00:00-04:00'), makeAgenda('2026-08-22T10:00:00-04:00')),
      false,
    );
    assert.equal(
      isNewerAgenda(makeAgenda('2026-08-22T09:00:00-04:00'), makeAgenda('2026-08-22T09:00:00-04:00')),
      false,
    );
  });

  it('false si next.fetchedAt no es una fecha válida', () => {
    assert.equal(isNewerAgenda(makeAgenda('no-es-fecha'), makeAgenda('2026-08-22T09:00:00-04:00')), false);
  });

  it('true si current.fetchedAt es inválida pero next es válida', () => {
    assert.equal(isNewerAgenda(makeAgenda('2026-08-22T09:00:00-04:00'), makeAgenda('basura')), true);
  });
});

describe('scheduleJitterMs', () => {
  it('siempre cae dentro de la ventana 1s–2min', () => {
    for (let i = 0; i < 200; i++) {
      const ms = scheduleJitterMs();
      assert.ok(ms >= 1_000, `jitter ${ms} < 1000`);
      assert.ok(ms <= 120_000, `jitter ${ms} > 120000`);
    }
  });
});

describe('fetchPublishedAgenda', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('devuelve la agenda cuando la respuesta es válida', async () => {
    const agenda = makeAgenda('2026-08-22T09:00:00-04:00');
    globalThis.fetch = (async () => ({ ok: true, json: async () => agenda })) as unknown as typeof fetch;
    assert.deepEqual(await fetchPublishedAgenda(), agenda);
  });

  it('devuelve null si la respuesta no es ok', async () => {
    globalThis.fetch = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    assert.equal(await fetchPublishedAgenda(), null);
  });

  it('devuelve null si el JSON no parece una agenda', async () => {
    globalThis.fetch = (async () => ({ ok: true, json: async () => ({ foo: 'bar' }) })) as unknown as typeof fetch;
    assert.equal(await fetchPublishedAgenda(), null);
  });

  it('devuelve null si fetch lanza (offline)', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    assert.equal(await fetchPublishedAgenda(), null);
  });
});

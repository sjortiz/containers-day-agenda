import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Agenda } from '@/types';
import { isNewerAgenda, fetchPublishedAgenda } from './agenda-remote';

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

describe('fetchPublishedAgenda', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('devuelve { ok: true, agenda } cuando la respuesta es válida', async () => {
    const agenda = makeAgenda('2026-08-22T09:00:00-04:00');
    globalThis.fetch = (async () => ({ ok: true, json: async () => agenda })) as unknown as typeof fetch;
    assert.deepEqual(await fetchPublishedAgenda(), { ok: true, agenda });
  });

  it('devuelve reason "http" (con status) si la respuesta no es ok', async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch;
    assert.deepEqual(await fetchPublishedAgenda(), { ok: false, reason: 'http', status: 404 });
  });

  it('devuelve reason "invalid" si el JSON no parece una agenda', async () => {
    globalThis.fetch = (async () => ({ ok: true, json: async () => ({ foo: 'bar' }) })) as unknown as typeof fetch;
    const result = await fetchPublishedAgenda();
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, 'invalid');
  });

  it('devuelve reason "invalid" si una sesión tiene el ID duplicado', async () => {
    const agenda = makeAgenda('2026-08-22T09:00:00-04:00');
    const session = {
      id: 'dup',
      title: 'Charla',
      room: 'Octagonal 1',
      speakers: [],
      labels: [],
      isService: false,
      start: '2026-08-22T09:00:00-04:00',
      end: '2026-08-22T09:30:00-04:00',
    };
    const withDupIds = { ...agenda, sessions: [session, { ...session }] };
    globalThis.fetch = (async () => ({ ok: true, json: async () => withDupIds })) as unknown as typeof fetch;
    const result = await fetchPublishedAgenda();
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, 'invalid');
  });

  it('devuelve reason "invalid" si una sesión termina antes (o al mismo tiempo) de empezar', async () => {
    const agenda = makeAgenda('2026-08-22T09:00:00-04:00');
    const session = {
      id: '1',
      title: 'Charla',
      room: 'Octagonal 1',
      speakers: [],
      labels: [],
      isService: false,
      start: '2026-08-22T09:30:00-04:00',
      end: '2026-08-22T09:00:00-04:00',
    };
    const withBadEnd = { ...agenda, sessions: [session] };
    globalThis.fetch = (async () => ({ ok: true, json: async () => withBadEnd })) as unknown as typeof fetch;
    const result = await fetchPublishedAgenda();
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, 'invalid');
  });

  it('devuelve reason "network" si fetch lanza (offline)', async () => {
    const boom = new Error('network down');
    globalThis.fetch = (async () => {
      throw boom;
    }) as unknown as typeof fetch;
    const result = await fetchPublishedAgenda();
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, 'network');
    assert.equal(!result.ok && result.error, boom);
  });

  it('devuelve reason "aborted" si fetch lanza con la señal ya abortada', async () => {
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = (async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }) as unknown as typeof fetch;
    const result = await fetchPublishedAgenda(controller.signal);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, 'aborted');
  });
});

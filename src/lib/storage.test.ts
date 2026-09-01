import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Agenda } from '@/types';
import { loadAgendaCache, saveAgendaCache } from './storage';

/** localStorage mínimo en memoria para probar storage.ts fuera de un browser. */
class FakeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

function makeAgenda(overrides: Partial<Agenda> = {}): Agenda {
  return {
    source: 'https://containers.day/agenda/',
    timezone: 'America/Santo_Domingo',
    utcOffset: '-04:00',
    fetchedAt: '2026-08-22T14:09:20.370Z',
    rooms: ['Octagonal 1'],
    labels: ['IA'],
    sessions: [
      {
        id: '1303446',
        title: 'El ingeniero AI native',
        room: 'Salón Principal',
        speakers: ['Fabrizio Sgura'],
        labels: ['IA'],
        isService: false,
        start: '2026-08-22T09:35:00-04:00',
        end: '2026-08-22T10:20:00-04:00',
      },
    ],
    ...overrides,
  };
}

describe('agenda cache: usa el mismo validador que agenda-remote', () => {
  const realWindow = globalThis.window;
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    (globalThis as unknown as { window: unknown }).window = { localStorage };
  });

  afterEach(() => {
    if (realWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = realWindow;
    }
  });

  it('guarda y recupera una agenda válida', () => {
    const agenda = makeAgenda();
    saveAgendaCache(agenda);
    assert.deepEqual(loadAgendaCache(), agenda);
  });

  it('devuelve null si no hay nada guardado', () => {
    assert.equal(loadAgendaCache(), null);
  });

  it('devuelve null ante JSON corrupto', () => {
    localStorage.setItem('cd-agenda:data:v1', '{not-json');
    assert.equal(loadAgendaCache(), null);
  });

  it('rechaza un objeto que no parece una Agenda (sin lanzar)', () => {
    localStorage.setItem('cd-agenda:data:v1', JSON.stringify({ foo: 'bar' }));
    assert.equal(loadAgendaCache(), null);
  });

  it('rechaza una agenda cacheada con sesiones malformadas (id vacío)', () => {
    const agenda = makeAgenda({
      sessions: [{ ...makeAgenda().sessions[0], id: '' }],
    });
    localStorage.setItem('cd-agenda:data:v1', JSON.stringify(agenda));
    assert.equal(loadAgendaCache(), null);
  });

  it('rechaza una agenda cacheada con end anterior a start', () => {
    const bad = makeAgenda();
    bad.sessions[0].end = '2026-08-22T09:00:00-04:00'; // antes que start
    localStorage.setItem('cd-agenda:data:v1', JSON.stringify(bad));
    assert.equal(loadAgendaCache(), null);
  });

  it('rechaza IDs de sesión duplicados', () => {
    const session = makeAgenda().sessions[0];
    const dup = makeAgenda({ sessions: [session, { ...session }] });
    localStorage.setItem('cd-agenda:data:v1', JSON.stringify(dup));
    assert.equal(loadAgendaCache(), null);
  });

  it('no lanza si localStorage.getItem lanza (almacenamiento bloqueado)', () => {
    (localStorage as unknown as { getItem: () => never }).getItem = () => {
      throw new Error('bloqueado');
    };
    assert.equal(loadAgendaCache(), null);
  });
});

describe('agenda cache: sin window (SSR)', () => {
  it('loadAgendaCache/saveAgendaCache son no-ops seguros', () => {
    assert.equal('window' in globalThis, false);
    assert.equal(loadAgendaCache(), null);
    assert.doesNotThrow(() => saveAgendaCache(makeAgenda()));
  });
});

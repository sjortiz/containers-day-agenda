import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Agenda } from '@/types';
import { reconcileNotified } from './agenda';
import {
  getEvent,
  listEvents,
  loadAgendaCache,
  loadNotificationsEnabled,
  loadNotified,
  loadSelected,
  loadSoleSeeded,
  removeEvent,
  saveAgendaCache,
  saveNotificationsEnabled,
  saveNotified,
  saveSelected,
  saveSoleSeeded,
  upsertEvent,
} from './storage';

/** localStorage mínimo en memoria para probar storage.ts fuera de un browser.
 * `keys()` no existe en la API real; se agrega solo para poder inspeccionar
 * el store completo desde los tests (aislamiento, no-fugas de claves, etc). */
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
  keys(): string[] {
    return [...this.store.keys()];
  }
  get size(): number {
    return this.store.size;
  }
}

function makeAgenda(eventId: string, overrides: Partial<Agenda> = {}): Agenda {
  return {
    event: {
      id: eventId,
      name: 'Containers Day',
      sourceUrl: 'https://containers.day/agenda/',
      timezone: 'America/Santo_Domingo',
      provider: 'containers-day',
      refreshMode: 'live',
      addedAt: '2026-08-22T14:09:20.370Z',
    },
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

describe('storage.ts', () => {
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

  describe('agenda cache: por-evento, mismo validador que agenda-remote', () => {
    it('guarda y recupera una agenda válida', () => {
      const agenda = makeAgenda('containers-day');
      saveAgendaCache('containers-day', agenda);
      assert.deepEqual(loadAgendaCache('containers-day'), agenda);
    });

    it('devuelve null si no hay nada guardado', () => {
      assert.equal(loadAgendaCache('containers-day'), null);
    });

    it('devuelve null ante JSON corrupto', () => {
      localStorage.setItem('talk-track:containers-day:agenda:v1', '{not-json');
      assert.equal(loadAgendaCache('containers-day'), null);
    });

    it('rechaza un objeto que no parece una Agenda (sin lanzar)', () => {
      localStorage.setItem('talk-track:containers-day:agenda:v1', JSON.stringify({ foo: 'bar' }));
      assert.equal(loadAgendaCache('containers-day'), null);
    });

    it('rechaza una agenda cacheada con sesiones malformadas (id vacío)', () => {
      const agenda = makeAgenda('containers-day', {
        sessions: [{ ...makeAgenda('containers-day').sessions[0], id: '' }],
      });
      localStorage.setItem('talk-track:containers-day:agenda:v1', JSON.stringify(agenda));
      assert.equal(loadAgendaCache('containers-day'), null);
    });

    it('rechaza IDs de sesión duplicados', () => {
      const session = makeAgenda('containers-day').sessions[0];
      const dup = makeAgenda('containers-day', { sessions: [session, { ...session }] });
      localStorage.setItem('talk-track:containers-day:agenda:v1', JSON.stringify(dup));
      assert.equal(loadAgendaCache('containers-day'), null);
    });

    it('no lanza si localStorage.getItem lanza (almacenamiento bloqueado)', () => {
      (localStorage as unknown as { getItem: () => never }).getItem = () => {
        throw new Error('bloqueado');
      };
      assert.equal(loadAgendaCache('containers-day'), null);
    });

    it('rechaza una agenda válida pero de OTRO evento leída bajo este scope', () => {
      // No debería pasar en flujo normal (cada save escribe bajo su propia
      // clave), pero si la clave con scope de "event-a" terminara con una
      // agenda cuyo `event.id` es "event-b" (corrupción manual, bug, etc.),
      // no debe aceptarse como válida para "event-a".
      const mismatched = makeAgenda('event-b');
      localStorage.setItem('talk-track:event-a:agenda:v1', JSON.stringify(mismatched));
      assert.equal(loadAgendaCache('event-a'), null);
    });
  });

  describe('agenda cache: sin window (SSR)', () => {
    it('loadAgendaCache/saveAgendaCache son no-ops seguros', () => {
      delete (globalThis as { window?: unknown }).window;
      assert.equal('window' in globalThis, false);
      assert.equal(loadAgendaCache('containers-day'), null);
      assert.doesNotThrow(() => saveAgendaCache('containers-day', makeAgenda('containers-day')));
    });
  });

  describe('aislamiento entre eventos', () => {
    it('selected: dos eventos no leen ni pisan el estado del otro', () => {
      saveSelected('event-a', new Set(['s1', 's2']));
      saveSelected('event-b', new Set(['s3']));
      assert.deepEqual(loadSelected('event-a'), new Set(['s1', 's2']));
      assert.deepEqual(loadSelected('event-b'), new Set(['s3']));
    });

    it('notified: dos eventos no leen ni pisan el estado del otro', () => {
      saveNotified('event-a', new Set(['s1@2026-08-22T09:00:00-04:00']));
      saveNotified('event-b', new Set());
      assert.deepEqual(loadNotified('event-a'), new Set(['s1@2026-08-22T09:00:00-04:00']));
      assert.deepEqual(loadNotified('event-b'), new Set());
    });

    it('sole-seeded: dos eventos no leen ni pisan el estado del otro', () => {
      saveSoleSeeded('event-a', new Set(['solo-a']));
      saveSoleSeeded('event-b', new Set(['solo-b']));
      assert.deepEqual(loadSoleSeeded('event-a'), new Set(['solo-a']));
      assert.deepEqual(loadSoleSeeded('event-b'), new Set(['solo-b']));
    });

    it('agenda cache: dos eventos no leen ni pisan el estado del otro', () => {
      saveAgendaCache('event-a', makeAgenda('event-a'));
      saveAgendaCache('event-b', makeAgenda('event-b'));
      assert.equal(loadAgendaCache('event-a')?.event.id, 'event-a');
      assert.equal(loadAgendaCache('event-b')?.event.id, 'event-b');
    });

    it('notifications-enabled: dos eventos no leen ni pisan el estado del otro', () => {
      saveNotificationsEnabled('event-a', true);
      saveNotificationsEnabled('event-b', false);
      assert.equal(loadNotificationsEnabled('event-a'), true);
      assert.equal(loadNotificationsEnabled('event-b'), false);
    });
  });

  describe('event ID inválido: no escapa el namespace de claves', () => {
    it('load* devuelve valores por defecto sin leer ninguna clave real', () => {
      assert.deepEqual(loadSelected('../evil'), new Set());
      assert.deepEqual(loadNotified('Evil Id'), new Set());
      assert.deepEqual(loadSoleSeeded('a:b'), new Set());
      assert.equal(loadAgendaCache('a/b'), null);
      assert.equal(loadNotificationsEnabled(''), false);
    });

    it('save* es un no-op: no crea ninguna clave en localStorage', () => {
      saveSelected('../evil', new Set(['x']));
      saveNotified('a:b', new Set(['x']));
      saveSoleSeeded('a/b', new Set(['x']));
      saveAgendaCache('Evil Id', makeAgenda('Evil Id'));
      saveNotificationsEnabled('', true);
      assert.equal(localStorage.size, 0);
    });

    it('upsertEvent con un id inválido no modifica el índice', () => {
      upsertEvent({
        id: 'Not Valid',
        name: 'x',
        sourceUrl: 'https://x',
        timezone: 'UTC',
        provider: 'json',
        refreshMode: 'manual',
        addedAt: new Date().toISOString(),
      });
      assert.deepEqual(listEvents(), []);
    });
  });

  describe('índice de eventos (talk-track:events:v1)', () => {
    it('listEvents() empieza vacío', () => {
      assert.deepEqual(listEvents(), []);
    });

    it('upsertEvent agrega un evento nuevo', () => {
      const meta = {
        id: 'containers-day',
        name: 'Containers Day',
        sourceUrl: 'https://containers.day/agenda/',
        timezone: 'America/Santo_Domingo',
        provider: 'containers-day' as const,
        refreshMode: 'live' as const,
        addedAt: '2026-08-22T14:09:20.370Z',
      };
      upsertEvent(meta);
      assert.deepEqual(listEvents(), [meta]);
      assert.deepEqual(getEvent('containers-day'), meta);
    });

    it('upsertEvent actualiza en el lugar (mismo id) preservando el orden', () => {
      upsertEvent({
        id: 'a',
        name: 'A',
        sourceUrl: 'https://a',
        timezone: 'UTC',
        provider: 'json',
        refreshMode: 'manual',
        addedAt: '2026-01-01T00:00:00.000Z',
      });
      upsertEvent({
        id: 'b',
        name: 'B',
        sourceUrl: 'https://b',
        timezone: 'UTC',
        provider: 'json',
        refreshMode: 'manual',
        addedAt: '2026-01-02T00:00:00.000Z',
      });
      upsertEvent({
        id: 'a',
        name: 'A actualizado',
        sourceUrl: 'https://a2',
        timezone: 'UTC',
        provider: 'json',
        refreshMode: 'live',
        addedAt: '2026-01-01T00:00:00.000Z',
      });
      const events = listEvents();
      assert.deepEqual(events.map((e) => e.id), ['a', 'b']); // orden preservado
      assert.equal(events[0].name, 'A actualizado');
    });

    it('getEvent devuelve null si no está registrado', () => {
      assert.equal(getEvent('no-existe'), null);
    });

    it('removeEvent elimina el índice y todo el estado con scope', () => {
      const agenda = makeAgenda('demo-event');
      upsertEvent(agenda.event);
      saveAgendaCache('demo-event', agenda);
      saveSelected('demo-event', new Set(['talk-1']));
      saveNotified('demo-event', new Set(['talk-1@start']));
      saveSoleSeeded('demo-event', new Set(['talk-2']));
      saveNotificationsEnabled('demo-event', true);

      removeEvent('demo-event');

      assert.equal(getEvent('demo-event'), null);
      assert.equal(loadAgendaCache('demo-event'), null);
      assert.deepEqual(loadSelected('demo-event'), new Set());
      assert.deepEqual(loadNotified('demo-event'), new Set());
      assert.deepEqual(loadSoleSeeded('demo-event'), new Set());
      assert.equal(loadNotificationsEnabled('demo-event'), false);
    });

    it('listEvents descarta un índice corrupto sin lanzar', () => {
      localStorage.setItem('talk-track:events:v1', '{not-json');
      assert.deepEqual(listEvents(), []);
      localStorage.setItem('talk-track:events:v1', JSON.stringify([{ foo: 'bar' }]));
      assert.deepEqual(listEvents(), []);
    });
  });

  describe('migración legado (containers-day, desde cd-agenda:*)', () => {
    const LEGACY_SELECTED = 'cd-agenda:selected:v1';
    const LEGACY_NOTIFIED = 'cd-agenda:notified:v1';
    const LEGACY_SOLE_SEEDED = 'cd-agenda:sole-seeded:v1';
    const LEGACY_AGENDA = 'cd-agenda:data:v1';
    const LEGACY_NOTIF_ENABLED = 'cd-agenda:notif-enabled:v1';
    const MARKER = 'talk-track:legacy-migrated:v1';

    it('copia selected/notified/sole-seeded/notifications-enabled a las claves con scope', () => {
      localStorage.setItem(LEGACY_SELECTED, JSON.stringify(['s1', 's2']));
      localStorage.setItem(LEGACY_NOTIFIED, JSON.stringify(['s1@2026-08-22T09:00:00-04:00']));
      localStorage.setItem(LEGACY_SOLE_SEEDED, JSON.stringify(['solo1']));
      localStorage.setItem(LEGACY_NOTIF_ENABLED, 'true');

      assert.deepEqual(loadSelected('containers-day'), new Set(['s1', 's2']));
      assert.deepEqual(loadNotified('containers-day'), new Set(['s1@2026-08-22T09:00:00-04:00']));
      assert.deepEqual(loadSoleSeeded('containers-day'), new Set(['solo1']));
      assert.equal(loadNotificationsEnabled('containers-day'), true);
    });

    it('conserva las claves legado tras migrar (no las borra)', () => {
      localStorage.setItem(LEGACY_SELECTED, JSON.stringify(['s1']));
      loadSelected('containers-day');
      assert.equal(localStorage.getItem(LEGACY_SELECTED), JSON.stringify(['s1']));
    });

    it('escribe la marca de migración tras correr', () => {
      loadSelected('containers-day');
      assert.equal(localStorage.getItem(MARKER), 'done');
    });

    it('no pisa un destino con scope que ya tiene datos propios', () => {
      localStorage.setItem('talk-track:containers-day:selected:v1', JSON.stringify(['ya-migrado']));
      localStorage.setItem(LEGACY_SELECTED, JSON.stringify(['legado-viejo']));
      assert.deepEqual(loadSelected('containers-day'), new Set(['ya-migrado']));
    });

    it('idempotente: llamar dos veces no cambia el resultado ni duplica trabajo', () => {
      localStorage.setItem(LEGACY_SELECTED, JSON.stringify(['s1']));
      const first = loadSelected('containers-day');
      const second = loadSelected('containers-day');
      assert.deepEqual(first, second);
      assert.deepEqual(second, new Set(['s1']));
    });

    it('idempotente ante llamadas "simultáneas" (React Strict Mode): ambas ven el mismo resultado migrado', () => {
      localStorage.setItem(LEGACY_SELECTED, JSON.stringify(['s1']));
      localStorage.setItem(LEGACY_SOLE_SEEDED, JSON.stringify(['solo1']));
      // Simula el montaje replay de Strict Mode: dos lecturas de distintas
      // claves antes de que ninguna haya "visto" la marca todavía.
      const selected = loadSelected('containers-day');
      const soleSeeded = loadSoleSeeded('containers-day');
      assert.deepEqual(selected, new Set(['s1']));
      assert.deepEqual(soleSeeded, new Set(['solo1']));
    });

    it('no corre para otros event IDs', () => {
      localStorage.setItem(LEGACY_SELECTED, JSON.stringify(['s1']));
      assert.deepEqual(loadSelected('other-event'), new Set());
      assert.equal(localStorage.getItem('talk-track:other-event:selected:v1'), null);
    });

    it('sin nada legado guardado: no crea claves nuevas y no lanza', () => {
      assert.doesNotThrow(() => loadSelected('containers-day'));
      assert.equal(localStorage.getItem('talk-track:containers-day:selected:v1'), null);
    });

    it('migra un notified legado de solo-ID sin cambiar su tamaño, y reconcileNotified lo traduce', () => {
      // "Same-size" migration: la clave legado puede tener entradas de
      // solo-ID (formato previo a `occurrenceKey`); migrarla no debe alterar
      // cuántas entradas tiene el set copiado.
      localStorage.setItem(LEGACY_NOTIFIED, JSON.stringify(['1303446']));
      const migrated = loadNotified('containers-day');
      assert.equal(migrated.size, 1);
      assert.deepEqual(migrated, new Set(['1303446']));

      const agenda = makeAgenda('containers-day');
      const start = new Date(agenda.sessions[0].start).getTime();
      const lead = 10 * 60000;
      const reconciled = reconcileNotified(migrated, agenda, start, lead); // ventana abierta
      assert.equal(reconciled.size, 1); // mismo tamaño: se tradujo, no se perdió
      assert.deepEqual(reconciled, new Set([`1303446@${agenda.sessions[0].start}`]));
    });

    it('agenda legado con forma vieja (sin `event`) se copia pero no valida bajo el nuevo esquema', () => {
      // Documenta el comportamiento esperado: la migración copia el string
      // crudo sin transformarlo, y `looksLikeAgenda` (nuevo esquema) rechaza
      // la forma vieja -no hay agenda cacheada usable hasta el próximo save,
      // pero tampoco hay corrupción ni excepción; cae al fallback horneado.
      const legacyShape = {
        source: 'https://containers.day/agenda/',
        timezone: 'America/Santo_Domingo',
        utcOffset: '-04:00',
        fetchedAt: '2026-08-22T14:09:20.370Z',
        rooms: [],
        labels: [],
        sessions: [],
      };
      localStorage.setItem(LEGACY_AGENDA, JSON.stringify(legacyShape));
      assert.equal(loadAgendaCache('containers-day'), null);
      // pero la clave legado sigue intacta y la migración sí copió el string:
      assert.equal(
        localStorage.getItem('talk-track:containers-day:agenda:v1'),
        JSON.stringify(legacyShape),
      );
    });
  });
});

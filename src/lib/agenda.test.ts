import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Agenda, Session } from '@/types';
import {
  groupByStart,
  filterSessions,
  autoAnnouncedIds,
  soleOptionIds,
  occurrenceKey,
  reconcileNotified,
  nextUpcomingSelected,
  type Filters,
} from './agenda';

// Helper para armar sesiones de prueba sin repetir todos los campos.
function makeSession(over: Partial<Session> & { id: string }): Session {
  return {
    title: `Charla ${over.id}`,
    room: 'Sala A',
    speakers: [],
    labels: [],
    isService: false,
    start: '2026-08-22T09:00:00-04:00',
    end: '2026-08-22T09:30:00-04:00',
    ...over,
  };
}

function makeAgenda(sessions: Session[]): Agenda {
  return {
    event: {
      id: 'containers-day',
      name: 'Containers Day',
      sourceUrl: 'https://containers.day/agenda',
      timezone: 'America/Santo_Domingo',
      provider: 'containers-day',
      refreshMode: 'live',
      addedAt: '2026-08-22T08:00:00-04:00',
    },
    utcOffset: '-04:00',
    fetchedAt: '2026-08-22T08:00:00-04:00',
    rooms: [...new Set(sessions.map((s) => s.room))],
    labels: [...new Set(sessions.flatMap((s) => s.labels))],
    sessions,
  };
}

const EMPTY_FILTERS: Filters = {
  rooms: new Set(),
  labels: new Set(),
  query: '',
  onlyMine: false,
};

describe('groupByStart', () => {
  it('agrupa sesiones por hora de inicio', () => {
    const a = makeSession({ id: 'a', start: '2026-08-22T09:00:00-04:00' });
    const b = makeSession({ id: 'b', start: '2026-08-22T09:00:00-04:00', room: 'Sala B' });
    const c = makeSession({ id: 'c', start: '2026-08-22T10:00:00-04:00' });
    const slots = groupByStart([a, b, c]);
    assert.equal(slots.length, 2);
    assert.equal(slots[0].start, '2026-08-22T09:00:00-04:00');
    assert.deepEqual(slots[0].sessions.map((s) => s.id), ['a', 'b']);
    assert.deepEqual(slots[1].sessions.map((s) => s.id), ['c']);
  });

  it('ordena los slots cronológicamente aunque entren desordenados', () => {
    const late = makeSession({ id: 'late', start: '2026-08-22T15:00:00-04:00' });
    const early = makeSession({ id: 'early', start: '2026-08-22T08:00:00-04:00' });
    const slots = groupByStart([late, early]);
    assert.deepEqual(slots.map((s) => s.start), [
      '2026-08-22T08:00:00-04:00',
      '2026-08-22T15:00:00-04:00',
    ]);
  });

  it('dentro de un slot ordena por sala (localeCompare)', () => {
    const start = '2026-08-22T09:00:00-04:00';
    const z = makeSession({ id: 'z', start, room: 'Zeta' });
    const a = makeSession({ id: 'a', start, room: 'Alfa' });
    const m = makeSession({ id: 'm', start, room: 'Mu' });
    const [slot] = groupByStart([z, a, m]);
    assert.deepEqual(slot.sessions.map((s) => s.room), ['Alfa', 'Mu', 'Zeta']);
  });

  it('devuelve lista vacía sin sesiones', () => {
    assert.deepEqual(groupByStart([]), []);
  });
});

describe('filterSessions', () => {
  const mine = makeSession({ id: 'mine', room: 'Sala A', labels: ['DevOps'], title: 'Kubernetes en producción', speakers: ['Ada'] });
  const other = makeSession({ id: 'other', room: 'Sala B', labels: ['Security'], title: 'Zero trust', speakers: ['Linus'] });
  const agenda = makeAgenda([mine, other]);

  it('sin filtros devuelve todo', () => {
    assert.deepEqual(filterSessions(agenda, EMPTY_FILTERS, new Set()).map((s) => s.id), [
      'mine',
      'other',
    ]);
  });

  it('onlyMine deja solo las seleccionadas', () => {
    const res = filterSessions(agenda, { ...EMPTY_FILTERS, onlyMine: true }, new Set(['mine']));
    assert.deepEqual(res.map((s) => s.id), ['mine']);
  });

  it('filtra por sala', () => {
    const res = filterSessions(agenda, { ...EMPTY_FILTERS, rooms: new Set(['Sala B']) }, new Set());
    assert.deepEqual(res.map((s) => s.id), ['other']);
  });

  it('filtra por label (coincidencia de alguna)', () => {
    const res = filterSessions(agenda, { ...EMPTY_FILTERS, labels: new Set(['DevOps']) }, new Set());
    assert.deepEqual(res.map((s) => s.id), ['mine']);
  });

  it('busca en título, sala, speakers y labels sin distinguir mayúsculas', () => {
    assert.deepEqual(filterSessions(agenda, { ...EMPTY_FILTERS, query: 'kubernetes' }, new Set()).map((s) => s.id), ['mine']);
    assert.deepEqual(filterSessions(agenda, { ...EMPTY_FILTERS, query: 'LINUS' }, new Set()).map((s) => s.id), ['other']);
    assert.deepEqual(filterSessions(agenda, { ...EMPTY_FILTERS, query: 'security' }, new Set()).map((s) => s.id), ['other']);
  });

  it('query en blanco no filtra', () => {
    assert.equal(filterSessions(agenda, { ...EMPTY_FILTERS, query: '   ' }, new Set()).length, 2);
  });

  it('combina filtros (AND entre dimensiones)', () => {
    const res = filterSessions(
      agenda,
      { ...EMPTY_FILTERS, rooms: new Set(['Sala A']), query: 'zero' },
      new Set(),
    );
    assert.equal(res.length, 0);
  });
});

describe('autoAnnouncedIds', () => {
  it('devuelve solo los IDs de servicios', () => {
    const talk = makeSession({ id: 'talk', isService: false });
    const brk = makeSession({ id: 'break', isService: true });
    const reg = makeSession({ id: 'registro', isService: true });
    const ids = autoAnnouncedIds(makeAgenda([talk, brk, reg]));
    assert.deepEqual([...ids].sort(), ['break', 'registro']);
    assert.equal(ids.has('talk'), false);
  });
});

describe('soleOptionIds', () => {
  it('marca la charla que es única opción no-servicio de su franja', () => {
    const solo = makeSession({ id: 'solo', start: '2026-08-22T09:00:00-04:00' });
    const dup1 = makeSession({ id: 'dup1', start: '2026-08-22T10:00:00-04:00', room: 'A' });
    const dup2 = makeSession({ id: 'dup2', start: '2026-08-22T10:00:00-04:00', room: 'B' });
    const ids = soleOptionIds(makeAgenda([solo, dup1, dup2]));
    assert.deepEqual([...ids], ['solo']);
  });

  it('ignora servicios aunque sean únicos en su franja', () => {
    const brk = makeSession({ id: 'break', isService: true, start: '2026-08-22T11:00:00-04:00' });
    const ids = soleOptionIds(makeAgenda([brk]));
    assert.equal(ids.size, 0);
  });
});

describe('occurrenceKey', () => {
  it('combina ID y start con un separador estable', () => {
    assert.equal(
      occurrenceKey('s', '2026-08-22T09:00:00-04:00'),
      's@2026-08-22T09:00:00-04:00',
    );
  });
});

describe('reconcileNotified', () => {
  const lead = 10 * 60000; // 10 min
  const START = '2026-08-22T09:00:00-04:00';
  const s = makeSession({ id: 's', start: START });
  const agenda = makeAgenda([s]);
  const start = new Date(START).getTime();
  const key = occurrenceKey('s', START);

  it('mantiene la ocurrencia si su ventana (start - lead) ya abrió', () => {
    const now = start - lead + 1000; // ventana ya abierta
    assert.deepEqual([...reconcileNotified(new Set([key]), agenda, now, lead)], [key]);
  });

  it('descarta la ocurrencia si la ventana aún es futura (para re-disparar)', () => {
    const now = start - lead - 60000; // 1 min antes de que abra la ventana
    assert.equal(reconcileNotified(new Set([key]), agenda, now, lead).size, 0);
  });

  it('descarta claves de sesiones que ya no existen', () => {
    const now = start; // ventana abierta
    const res = reconcileNotified(
      new Set([key, occurrenceKey('fantasma', START)]),
      agenda,
      now,
      lead,
    );
    assert.deepEqual([...res], [key]);
  });

  it('migra una entrada legado de solo-ID a la clave con start si su ventana ya abrió', () => {
    const now = start; // ventana abierta
    const res = reconcileNotified(new Set(['s']), agenda, now, lead);
    assert.deepEqual([...res], [key]);
  });

  it('descarta una entrada legado de solo-ID si su ventana todavía es futura', () => {
    const now = start - lead - 60000;
    assert.equal(reconcileNotified(new Set(['s']), agenda, now, lead).size, 0);
  });

  it('charla movida más tarde: descarta la ocurrencia vieja para que la nueva quede pendiente', () => {
    const laterStart = '2026-08-22T11:00:00-04:00';
    const movedAgenda = makeAgenda([makeSession({ id: 's', start: laterStart })]);
    const now = start; // "ahora" según la ventana vieja, ya pasada la nueva franja de aviso
    const res = reconcileNotified(new Set([key]), movedAgenda, now, lead);
    assert.equal(res.size, 0); // no queda marcada: el hook la re-evaluará contra el nuevo horario
  });

  it('charla movida más temprano pero aún futura: descarta la ocurrencia vieja para re-evaluar ya', () => {
    const earlierStart = '2026-08-22T08:00:00-04:00';
    const movedAgenda = makeAgenda([makeSession({ id: 's', start: earlierStart })]);
    const now = new Date(earlierStart).getTime() - lead + 1000; // dentro de la nueva ventana
    const res = reconcileNotified(new Set([key]), movedAgenda, now, lead);
    assert.equal(res.size, 0);
  });

  it('charla movida al pasado: no conserva la ocurrencia vieja (sin aviso tardío)', () => {
    const pastStart = '2026-08-22T07:00:00-04:00';
    const movedAgenda = makeAgenda([makeSession({ id: 's', start: pastStart })]);
    const now = start; // muy después de la nueva hora, ya en curso/pasada
    const res = reconcileNotified(new Set([key]), movedAgenda, now, lead);
    assert.equal(res.size, 0);
  });

  it('start sin cambios: la clave se conserva idéntica (sin duplicar)', () => {
    const now = start;
    const res = reconcileNotified(new Set([key]), agenda, now, lead);
    assert.deepEqual([...res], [key]);
  });

  it('cambio de sala únicamente (mismo start): no es una ocurrencia nueva', () => {
    const roomChanged = makeAgenda([
      makeSession({ id: 's', start: START, room: 'Sala Z' }),
    ]);
    const now = start;
    const res = reconcileNotified(new Set([key]), roomChanged, now, lead);
    assert.deepEqual([...res], [key]);
  });
});

describe('nextUpcomingSelected', () => {
  const s9 = makeSession({ id: 's9', start: '2026-08-22T09:00:00-04:00' });
  const s11 = makeSession({ id: 's11', start: '2026-08-22T11:00:00-04:00' });
  const agenda = makeAgenda([s9, s11]);

  it('devuelve la próxima seleccionada que aún no empieza', () => {
    const now = new Date('2026-08-22T08:00:00-04:00').getTime();
    assert.equal(nextUpcomingSelected(agenda, new Set(['s9', 's11']), now)?.id, 's9');
  });

  it('salta las que ya empezaron', () => {
    const now = new Date('2026-08-22T09:30:00-04:00').getTime();
    assert.equal(nextUpcomingSelected(agenda, new Set(['s9', 's11']), now)?.id, 's11');
  });

  it('devuelve null si no queda ninguna futura seleccionada', () => {
    const now = new Date('2026-08-22T12:00:00-04:00').getTime();
    assert.equal(nextUpcomingSelected(agenda, new Set(['s9', 's11']), now), null);
  });

  it('ignora las no seleccionadas', () => {
    const now = new Date('2026-08-22T08:00:00-04:00').getTime();
    assert.equal(nextUpcomingSelected(agenda, new Set(['s11']), now)?.id, 's11');
  });
});

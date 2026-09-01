import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Agenda, EventMeta, Session } from '@/types';
import { looksLikeAgenda, looksLikeEventMeta } from './agenda-validation';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: '1303446',
    title: 'El ingeniero AI native',
    room: 'Salón Principal',
    speakers: ['Fabrizio Sgura'],
    labels: ['IA', 'Carrera'],
    isService: false,
    start: '2026-08-22T09:35:00-04:00',
    end: '2026-08-22T10:20:00-04:00',
    ...overrides,
  };
}

function makeEventMeta(overrides: Partial<EventMeta> = {}): EventMeta {
  return {
    id: 'containers-day',
    name: 'Containers Day',
    sourceUrl: 'https://containers.day/agenda/',
    timezone: 'America/Santo_Domingo',
    provider: 'containers-day',
    refreshMode: 'live',
    addedAt: '2026-08-22T14:09:20.370Z',
    ...overrides,
  };
}

function makeAgenda(overrides: Partial<Agenda> = {}): Agenda {
  return {
    event: makeEventMeta(),
    utcOffset: '-04:00',
    fetchedAt: '2026-08-22T14:09:20.370Z',
    rooms: ['Octagonal 1', 'Salón Principal'],
    labels: ['IA', 'Carrera'],
    sessions: [
      makeSession({
        id: '2bcf0ce1-2837-4476-85e7-eb9c87ba9a8c',
        title: 'Registration',
        room: 'Octagonal 1',
        speakers: [],
        labels: [],
        isService: true,
        start: '2026-08-22T08:00:00-04:00',
        end: '2026-08-22T09:00:00-04:00',
      }),
      makeSession(),
    ],
    ...overrides,
  };
}

describe('looksLikeAgenda: datos válidos', () => {
  it('acepta una agenda con la forma real de src/data/agenda.json', () => {
    assert.equal(looksLikeAgenda(makeAgenda()), true);
  });

  it('acepta rooms/labels/speakers/labels de sesión vacíos', () => {
    const agenda = makeAgenda({
      rooms: [],
      labels: [],
      sessions: [makeSession({ speakers: [], labels: [] })],
    });
    assert.equal(looksLikeAgenda(agenda), true);
  });

  it('acepta end: null (sin fin declarado)', () => {
    const agenda = makeAgenda({ sessions: [makeSession({ end: null })] });
    assert.equal(looksLikeAgenda(agenda), true);
  });

  it('acepta una sola sesión (agenda mínima)', () => {
    const agenda = makeAgenda({ sessions: [makeSession()] });
    assert.equal(looksLikeAgenda(agenda), true);
  });

  it('acepta la agenda real publicada en src/data/agenda.json', () => {
    const fixturePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../data/agenda.json',
    );
    const data: unknown = JSON.parse(readFileSync(fixturePath, 'utf8'));
    assert.equal(looksLikeAgenda(data), true);
  });
});

describe('looksLikeAgenda: forma general inválida', () => {
  it('rechaza null, arrays y primitivos', () => {
    assert.equal(looksLikeAgenda(null), false);
    assert.equal(looksLikeAgenda(undefined), false);
    assert.equal(looksLikeAgenda('agenda'), false);
    assert.equal(looksLikeAgenda(42), false);
    assert.equal(looksLikeAgenda([]), false);
  });

  it('rechaza un objeto vacío', () => {
    assert.equal(looksLikeAgenda({}), false);
  });

  it('rechaza payloads no relacionados', () => {
    assert.equal(looksLikeAgenda({ foo: 'bar' }), false);
  });
});

describe('looksLikeAgenda: campos de nivel Agenda', () => {
  it('rechaza event ausente o que no parece EventMeta', () => {
    const agenda = makeAgenda() as unknown as Record<string, unknown>;
    delete agenda.event;
    assert.equal(looksLikeAgenda(agenda), false);
    assert.equal(looksLikeAgenda(makeAgenda({ event: { foo: 'bar' } as unknown as EventMeta })), false);
  });

  for (const field of ['utcOffset', 'fetchedAt'] as const) {
    it(`rechaza ${field} ausente`, () => {
      const agenda = makeAgenda() as unknown as Record<string, unknown>;
      delete agenda[field];
      assert.equal(looksLikeAgenda(agenda), false);
    });

    it(`rechaza ${field} vacío`, () => {
      assert.equal(looksLikeAgenda(makeAgenda({ [field]: '' })), false);
    });

    it(`rechaza ${field} no-string`, () => {
      assert.equal(looksLikeAgenda(makeAgenda({ [field]: 123 as unknown as string })), false);
    });
  }

  it('rechaza fetchedAt no parseable como fecha', () => {
    assert.equal(looksLikeAgenda(makeAgenda({ fetchedAt: 'no-es-fecha' })), false);
  });

  for (const field of ['rooms', 'labels'] as const) {
    it(`rechaza ${field} que no es array`, () => {
      assert.equal(looksLikeAgenda(makeAgenda({ [field]: 'Octagonal 1' as unknown as string[] })), false);
    });

    it(`rechaza ${field} con elementos no-string`, () => {
      assert.equal(looksLikeAgenda(makeAgenda({ [field]: [1, 2] as unknown as string[] })), false);
    });
  }

  it('rechaza sessions que no es array', () => {
    assert.equal(looksLikeAgenda(makeAgenda({ sessions: {} as unknown as Session[] })), false);
  });

  it('rechaza IDs de sesión duplicados', () => {
    const agenda = makeAgenda({
      sessions: [makeSession({ id: 'dup' }), makeSession({ id: 'dup' })],
    });
    assert.equal(looksLikeAgenda(agenda), false);
  });
});

describe('looksLikeAgenda: campos de Session', () => {
  it('rechaza id vacío', () => {
    assert.equal(looksLikeAgenda(makeAgenda({ sessions: [makeSession({ id: '' })] })), false);
  });

  it('rechaza id ausente', () => {
    const session = makeSession() as unknown as Record<string, unknown>;
    delete session.id;
    assert.equal(looksLikeAgenda(makeAgenda({ sessions: [session as unknown as Session] })), false);
  });

  it('rechaza title vacío o ausente', () => {
    assert.equal(looksLikeAgenda(makeAgenda({ sessions: [makeSession({ title: '' })] })), false);
    const session = makeSession() as unknown as Record<string, unknown>;
    delete session.title;
    assert.equal(looksLikeAgenda(makeAgenda({ sessions: [session as unknown as Session] })), false);
  });

  it('rechaza room vacío', () => {
    assert.equal(looksLikeAgenda(makeAgenda({ sessions: [makeSession({ room: '' })] })), false);
  });

  it('rechaza speakers que no es array de strings', () => {
    assert.equal(
      looksLikeAgenda(makeAgenda({ sessions: [makeSession({ speakers: 'Fabrizio' as unknown as string[] })] })),
      false,
    );
    assert.equal(
      looksLikeAgenda(makeAgenda({ sessions: [makeSession({ speakers: [1] as unknown as string[] })] })),
      false,
    );
  });

  it('rechaza labels de sesión que no es array de strings', () => {
    assert.equal(
      looksLikeAgenda(makeAgenda({ sessions: [makeSession({ labels: { a: 1 } as unknown as string[] })] })),
      false,
    );
  });

  it('rechaza isService no-booleano', () => {
    assert.equal(
      looksLikeAgenda(makeAgenda({ sessions: [makeSession({ isService: 'true' as unknown as boolean })] })),
      false,
    );
  });

  it('rechaza start ausente, vacío o no parseable', () => {
    assert.equal(looksLikeAgenda(makeAgenda({ sessions: [makeSession({ start: '' })] })), false);
    assert.equal(looksLikeAgenda(makeAgenda({ sessions: [makeSession({ start: 'no-es-fecha' })] })), false);
    const session = makeSession() as unknown as Record<string, unknown>;
    delete session.start;
    assert.equal(looksLikeAgenda(makeAgenda({ sessions: [session as unknown as Session] })), false);
  });

  it('rechaza end no parseable (y no null)', () => {
    assert.equal(
      looksLikeAgenda(makeAgenda({ sessions: [makeSession({ end: 'no-es-fecha' })] })),
      false,
    );
  });

  it('rechaza end igual a start', () => {
    const start = '2026-08-22T09:35:00-04:00';
    assert.equal(
      looksLikeAgenda(makeAgenda({ sessions: [makeSession({ start, end: start })] })),
      false,
    );
  });

  it('rechaza end anterior a start', () => {
    assert.equal(
      looksLikeAgenda(
        makeAgenda({
          sessions: [
            makeSession({
              start: '2026-08-22T10:20:00-04:00',
              end: '2026-08-22T09:35:00-04:00',
            }),
          ],
        }),
      ),
      false,
    );
  });

  it('rechaza una sesión que no es un objeto', () => {
    assert.equal(looksLikeAgenda(makeAgenda({ sessions: ['nope' as unknown as Session] })), false);
  });
});

describe('looksLikeEventMeta', () => {
  it('acepta un EventMeta válido', () => {
    assert.equal(looksLikeEventMeta(makeEventMeta()), true);
  });

  it('rechaza null, arrays y primitivos', () => {
    assert.equal(looksLikeEventMeta(null), false);
    assert.equal(looksLikeEventMeta(undefined), false);
    assert.equal(looksLikeEventMeta('evt'), false);
    assert.equal(looksLikeEventMeta([]), false);
  });

  it('rechaza id inválido como event ID (mayúsculas, espacios, `:`, `/`)', () => {
    for (const id of ['Containers-Day', 'containers day', 'a:b', 'a/b', '', '-leading', 'trailing-']) {
      assert.equal(looksLikeEventMeta(makeEventMeta({ id })), false, `id=${JSON.stringify(id)}`);
    }
  });

  for (const field of ['name', 'sourceUrl', 'timezone', 'addedAt'] as const) {
    it(`rechaza ${field} ausente o vacío`, () => {
      const meta = makeEventMeta() as unknown as Record<string, unknown>;
      delete meta[field];
      assert.equal(looksLikeEventMeta(meta), false);
      assert.equal(looksLikeEventMeta(makeEventMeta({ [field]: '' })), false);
    });
  }

  it('rechaza addedAt no parseable como fecha', () => {
    assert.equal(looksLikeEventMeta(makeEventMeta({ addedAt: 'no-es-fecha' })), false);
  });

  it('rechaza provider fuera del enum soportado', () => {
    assert.equal(
      looksLikeEventMeta(makeEventMeta({ provider: 'eventbrite' as unknown as EventMeta['provider'] })),
      false,
    );
  });

  it('acepta cada provider soportado', () => {
    for (const provider of ['containers-day', 'sessionize', 'pretalx', 'ics', 'json'] as const) {
      assert.equal(looksLikeEventMeta(makeEventMeta({ provider })), true);
    }
  });

  it('rechaza refreshMode fuera del enum soportado', () => {
    assert.equal(
      looksLikeEventMeta(makeEventMeta({ refreshMode: 'auto' as unknown as EventMeta['refreshMode'] })),
      false,
    );
  });

  it('acepta cada refreshMode soportado', () => {
    for (const refreshMode of ['live', 'manual'] as const) {
      assert.equal(looksLikeEventMeta(makeEventMeta({ refreshMode })), true);
    }
  });
});

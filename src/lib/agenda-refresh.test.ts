import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Agenda } from '@/types';
import type { AgendaFetchResult } from './agenda-remote';
import { createAgendaRefreshController } from './agenda-refresh';

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

/** Promesa controlable manualmente desde el test. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('createAgendaRefreshController', () => {
  it('aplica una respuesta más nueva y notifica onUpdate', async () => {
    let current = makeAgenda('2026-08-22T08:00:00-04:00');
    const fresh = makeAgenda('2026-08-22T09:00:00-04:00');
    let updated: Agenda | null = null;

    const controller = createAgendaRefreshController({
      getCurrentAgenda: () => current,
      onUpdate: (agenda) => {
        updated = agenda;
        current = agenda;
      },
      fetchAgenda: async () => ({ ok: true, agenda: fresh }),
    });

    const outcome = await controller.requestRefresh();
    assert.deepEqual(outcome, { kind: 'updated', agenda: fresh });
    assert.deepEqual(updated, fresh);
  });

  it('no llama a onUpdate cuando la respuesta no es más nueva', async () => {
    const current = makeAgenda('2026-08-22T09:00:00-04:00');
    const same = makeAgenda('2026-08-22T09:00:00-04:00');
    let updateCalls = 0;

    const controller = createAgendaRefreshController({
      getCurrentAgenda: () => current,
      onUpdate: () => {
        updateCalls++;
      },
      fetchAgenda: async () => ({ ok: true, agenda: same }),
    });

    const outcome = await controller.requestRefresh();
    assert.deepEqual(outcome, { kind: 'unchanged' });
    assert.equal(updateCalls, 0);
  });

  it('propaga el motivo de falla de fetchAgenda (http, network, invalid)', async () => {
    const current = makeAgenda('2026-08-22T09:00:00-04:00');

    const failures: AgendaFetchResult[] = [
      { ok: false, reason: 'http', status: 500 },
      { ok: false, reason: 'network' },
      { ok: false, reason: 'invalid' },
    ];
    for (const failure of failures) {
      const controller = createAgendaRefreshController({
        getCurrentAgenda: () => current,
        onUpdate: () => assert.fail('no debería aplicar una falla'),
        fetchAgenda: async () => failure,
      });
      const outcome = await controller.requestRefresh();
      assert.deepEqual(outcome, { kind: 'failed', reason: failure.reason });
    }
  });

  it('deduplica triggers concurrentes: una sola llamada a fetchAgenda', async () => {
    let current = makeAgenda('2026-08-22T08:00:00-04:00');
    const fresh = makeAgenda('2026-08-22T09:00:00-04:00');
    let calls = 0;
    const pending = deferred<AgendaFetchResult>();

    const controller = createAgendaRefreshController({
      getCurrentAgenda: () => current,
      onUpdate: (agenda) => {
        current = agenda;
      },
      fetchAgenda: async () => {
        calls++;
        return pending.promise;
      },
    });

    const first = controller.requestRefresh();
    const second = controller.requestRefresh();
    assert.equal(calls, 1, 'la segunda llamada debe reutilizar la primera');

    pending.resolve({ ok: true, agenda: fresh });
    const [a, b] = await Promise.all([first, second]);
    assert.deepEqual(a, b);
    assert.deepEqual(a, { kind: 'updated', agenda: fresh });

    // Una vez resuelta, una nueva llamada sí dispara otra petición.
    let calls2 = 0;
    const controller2 = createAgendaRefreshController({
      getCurrentAgenda: () => current,
      onUpdate: () => {},
      fetchAgenda: async () => {
        calls2++;
        return { ok: true, agenda: fresh };
      },
    });
    await controller2.requestRefresh();
    await controller2.requestRefresh();
    assert.equal(calls2, 2);
  });

  it('tras completar un refresco, el MISMO controller dispara uno nuevo (no queda deduplicado para siempre)', async () => {
    // Regresión: `inFlight` se asignaba a `promise.finally(...)`, pero el
    // callback comparaba `inFlight === promise` -la promesa original, no la
    // envuelta que en verdad se guardaba-, así que esa comparación nunca era
    // cierta e `inFlight` jamás volvía a `null`. El síntoma es justo este
    // caso: pedir varios refrescos *secuenciales* (uno espera a que el
    // anterior termine) sobre el mismo controller.
    let current = makeAgenda('2026-08-22T08:00:00-04:00');
    let calls = 0;

    const controller = createAgendaRefreshController({
      getCurrentAgenda: () => current,
      onUpdate: (agenda) => {
        current = agenda;
      },
      fetchAgenda: async () => {
        calls++;
        const hour = String(8 + calls).padStart(2, '0');
        return {
          ok: true,
          agenda: makeAgenda(`2026-08-22T${hour}:00:00-04:00`),
        };
      },
    });

    const first = await controller.requestRefresh();
    assert.equal(calls, 1);
    assert.equal(first.kind, 'updated');

    const second = await controller.requestRefresh();
    assert.equal(calls, 2, 'un refresco tras completar el anterior debe volver a pedir, no reutilizar el viejo inFlight');
    assert.equal(second.kind, 'updated');

    const third = await controller.requestRefresh();
    assert.equal(calls, 3, 'debe seguir funcionando en refrescos sucesivos, no solo el segundo');
    assert.equal(third.kind, 'updated');
  });

  it('protege contra respuestas obsoletas: no regresa el estado', async () => {
    // Simula que, mientras la petición está en curso, otra fuente ya instaló
    // una agenda más nueva que la que traerá esta respuesta.
    let current = makeAgenda('2026-08-22T08:00:00-04:00');
    let updateCalls = 0;

    const controller = createAgendaRefreshController({
      getCurrentAgenda: () => current,
      onUpdate: () => {
        updateCalls++;
      },
      fetchAgenda: async () => {
        // "Llega tarde" con una versión más vieja que la ya instalada.
        current = makeAgenda('2026-08-22T10:00:00-04:00');
        return { ok: true, agenda: makeAgenda('2026-08-22T09:00:00-04:00') };
      },
    });

    const outcome = await controller.requestRefresh();
    assert.deepEqual(outcome, { kind: 'unchanged' });
    assert.equal(updateCalls, 0);
  });

  it('timeout: aborta la señal y reporta reason "timeout"', async () => {
    const current = makeAgenda('2026-08-22T09:00:00-04:00');
    const controller = createAgendaRefreshController({
      getCurrentAgenda: () => current,
      onUpdate: () => assert.fail('no debería aplicar tras timeout'),
      timeoutMs: 5,
      fetchAgenda: (signal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () =>
            resolve({ ok: false, reason: 'aborted' }),
          );
        }),
    });

    const outcome = await controller.requestRefresh();
    assert.deepEqual(outcome, { kind: 'failed', reason: 'timeout' });
  });

  it('dispose: aborta lo pendiente e ignora resultados futuros', async () => {
    const current = makeAgenda('2026-08-22T09:00:00-04:00');
    const pending = deferred<AgendaFetchResult>();
    let aborted = false;
    let updateCalls = 0;

    const controller = createAgendaRefreshController({
      getCurrentAgenda: () => current,
      onUpdate: () => {
        updateCalls++;
      },
      fetchAgenda: (signal) => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        return pending.promise;
      },
    });

    const inFlight = controller.requestRefresh();
    controller.dispose();
    assert.equal(aborted, true, 'dispose debe abortar la petición en curso');

    pending.resolve({ ok: true, agenda: makeAgenda('2026-08-22T10:00:00-04:00') });
    const outcome = await inFlight;
    assert.deepEqual(outcome, { kind: 'failed', reason: 'aborted' });
    assert.equal(updateCalls, 0);

    // Tras dispose, nuevas peticiones se resuelven de inmediato como abortadas.
    const afterDispose = await controller.requestRefresh();
    assert.deepEqual(afterDispose, { kind: 'failed', reason: 'aborted' });
  });

  it('lifecycle: un controller nuevo tras disponer del anterior funciona con normalidad', async () => {
    // Modela lo que hace `useAgendaRefresh` en cada montaje de efecto (y, en
    // particular, en el replay de React Strict Mode: monta → limpia → vuelve
    // a montar): el controller viejo se dispone y se crea uno nuevo. Ese
    // nuevo controller no debe heredar el estado `disposed` del anterior.
    const current = makeAgenda('2026-08-22T08:00:00-04:00');
    const fresh = makeAgenda('2026-08-22T09:00:00-04:00');

    const oldController = createAgendaRefreshController({
      getCurrentAgenda: () => current,
      onUpdate: () => assert.fail('el controller viejo no debería aplicar nada'),
      fetchAgenda: (signal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () =>
            resolve({ ok: false, reason: 'aborted' }),
          );
        }),
    });
    const pendingOnOld = oldController.requestRefresh();
    oldController.dispose();
    assert.deepEqual(await pendingOnOld, { kind: 'failed', reason: 'aborted' });

    let updateCalls = 0;
    const newController = createAgendaRefreshController({
      getCurrentAgenda: () => current,
      onUpdate: () => {
        updateCalls++;
      },
      fetchAgenda: async () => ({ ok: true, agenda: fresh }),
    });
    const outcome = await newController.requestRefresh();
    assert.deepEqual(outcome, { kind: 'updated', agenda: fresh });
    assert.equal(updateCalls, 1);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toMs,
  formatTime,
  formatTimeRange,
  formatDayHeading,
  describeCountdown,
  formatElapsed,
} from './time';

const TZ = 'America/Santo_Domingo'; // UTC-4, coincide con los offsets del evento

describe('toMs', () => {
  it('convierte ISO con offset al instante absoluto', () => {
    assert.equal(toMs('2026-08-22T09:00:00-04:00'), Date.UTC(2026, 7, 22, 13, 0, 0));
  });
});

describe('formatTime', () => {
  it('muestra la hora en 24h en la timezone del evento', () => {
    assert.equal(formatTime('2026-08-22T09:00:00-04:00', TZ), '09:00');
    assert.equal(formatTime('2026-08-22T13:30:00-04:00', TZ), '13:30');
  });

  it('respeta la timezone pedida (mismo instante, otra zona)', () => {
    // 09:00 en UTC-4 es 13:00 en UTC.
    assert.equal(formatTime('2026-08-22T09:00:00-04:00', 'UTC'), '13:00');
  });
});

describe('formatTimeRange', () => {
  it('muestra inicio – fin cuando hay fin', () => {
    assert.equal(
      formatTimeRange('2026-08-22T09:00:00-04:00', '2026-08-22T09:30:00-04:00', TZ),
      '09:00 – 09:30',
    );
  });

  it('muestra solo el inicio cuando no hay fin', () => {
    assert.equal(formatTimeRange('2026-08-22T09:00:00-04:00', null, TZ), '09:00');
  });
});

describe('formatDayHeading', () => {
  it('incluye día de semana, número y mes en español', () => {
    const out = formatDayHeading('2026-08-22T09:00:00-04:00', TZ).toLowerCase();
    // 2026-08-22 es sábado; evitamos aserción exacta de puntuación entre versiones de ICU.
    assert.ok(out.includes('sábado'), `esperaba "sábado" en: ${out}`);
    assert.ok(out.includes('22'), `esperaba "22" en: ${out}`);
    assert.ok(out.includes('agosto'), `esperaba "agosto" en: ${out}`);
  });
});

describe('describeCountdown', () => {
  it('0 o negativo: empezando ahora', () => {
    assert.equal(describeCountdown(0), 'empezando ahora');
    assert.equal(describeCountdown(-5000), 'empezando ahora');
  });

  it('menos de 1 min', () => {
    assert.equal(describeCountdown(30 * 1000), 'en menos de 1 min');
  });

  it('minutos', () => {
    assert.equal(describeCountdown(10 * 60000), 'en 10 min');
  });

  it('horas exactas', () => {
    assert.equal(describeCountdown(2 * 60 * 60000), 'en 2 h');
  });

  it('horas y minutos', () => {
    assert.equal(describeCountdown((60 + 25) * 60000), 'en 1 h 25 min');
  });
});

describe('formatElapsed', () => {
  it('segundos', () => {
    assert.equal(formatElapsed(0), '0 s');
    assert.equal(formatElapsed(25 * 1000), '25 s');
    assert.equal(formatElapsed(59 * 1000), '59 s');
  });

  it('minutos', () => {
    assert.equal(formatElapsed(60 * 1000), '1 min');
    assert.equal(formatElapsed(8 * 60 * 1000), '8 min');
    assert.equal(formatElapsed(59 * 60 * 1000), '59 min');
  });

  it('horas', () => {
    assert.equal(formatElapsed(60 * 60 * 1000), '1 h');
    assert.equal(formatElapsed(3 * 60 * 60 * 1000 + 10_000), '3 h');
  });

  it('trata negativos (reloj/timestamps desalineados) como 0', () => {
    assert.equal(formatElapsed(-5000), '0 s');
  });
});

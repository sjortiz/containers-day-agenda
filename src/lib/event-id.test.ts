import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONTAINERS_DAY_EVENT_ID, isValidEventId } from './event-id';

describe('isValidEventId', () => {
  it('acepta IDs minúsculos con guiones simples', () => {
    for (const id of ['containers-day', 'a', 'a1', 'my-event-2026', 'a-b-c']) {
      assert.equal(isValidEventId(id), true, id);
    }
  });

  it('acepta el ID fijo de Containers Day', () => {
    assert.equal(isValidEventId(CONTAINERS_DAY_EVENT_ID), true);
  });

  it('rechaza vacío', () => {
    assert.equal(isValidEventId(''), false);
  });

  it('rechaza mayúsculas', () => {
    assert.equal(isValidEventId('Containers-Day'), false);
  });

  it('rechaza espacios', () => {
    assert.equal(isValidEventId('containers day'), false);
  });

  it('rechaza `:` (rompería el parseo de la clave con scope)', () => {
    assert.equal(isValidEventId('containers:day'), false);
  });

  it('rechaza `/` (path traversal en la URL /event/?id=)', () => {
    assert.equal(isValidEventId('containers/day'), false);
    assert.equal(isValidEventId('../events'), false);
    assert.equal(isValidEventId('a/../b'), false);
  });

  it('rechaza guion al inicio o al final', () => {
    assert.equal(isValidEventId('-containers-day'), false);
    assert.equal(isValidEventId('containers-day-'), false);
  });

  it('rechaza guiones consecutivos y otros separadores', () => {
    assert.equal(isValidEventId('containers--day'), false);
    assert.equal(isValidEventId('containers_day'), false);
    assert.equal(isValidEventId('containers.day'), false);
  });

  it('rechaza IDs desmedidamente largos', () => {
    assert.equal(isValidEventId('a'.repeat(100)), true);
    assert.equal(isValidEventId('a'.repeat(101)), false);
  });

  it('rechaza el ID reservado "events" (colisiona con el índice)', () => {
    assert.equal(isValidEventId('events'), false);
  });

  it('rechaza valores que no son string', () => {
    assert.equal(isValidEventId(42), false);
    assert.equal(isValidEventId(null), false);
    assert.equal(isValidEventId(undefined), false);
    assert.equal(isValidEventId(['containers-day']), false);
  });
});

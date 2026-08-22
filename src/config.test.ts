import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withBase, BASE_PATH } from './config';

describe('withBase', () => {
  it('agrega la barra inicial si falta', () => {
    assert.equal(withBase('agenda.json'), `${BASE_PATH}/agenda.json`);
  });

  it('no duplica la barra inicial si ya la trae', () => {
    assert.equal(withBase('/agenda.json'), `${BASE_PATH}/agenda.json`);
  });

  it('en test (sin NEXT_PUBLIC_BASE_PATH) el prefijo es vacío', () => {
    // NODE_ENV=test => no es producción => BASE_PATH === ''
    assert.equal(BASE_PATH, '');
    assert.equal(withBase('/sw.js'), '/sw.js');
  });
});

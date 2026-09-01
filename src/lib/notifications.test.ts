import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eventNotificationTag, sessionNotificationTag } from './notifications';

describe('eventNotificationTag', () => {
  it('prefija el sufijo con el event ID', () => {
    assert.equal(eventNotificationTag('containers-day', 'welcome'), 'containers-day:welcome');
  });

  it('distingue el mismo sufijo entre dos eventos distintos', () => {
    assert.notEqual(
      eventNotificationTag('containers-day', 'welcome'),
      eventNotificationTag('other-event', 'welcome'),
    );
  });
});

describe('sessionNotificationTag', () => {
  it('incluye el event ID y el ID de sesión', () => {
    assert.equal(sessionNotificationTag('containers-day', '1303446'), 'containers-day:session-1303446');
  });

  it('dos eventos que reusan el mismo ID de sesión no colisionan', () => {
    // Motivación (ver docs/specs/multi-event-home.md): distintos proveedores
    // pueden reusar IDs de sesión; el tag debe distinguirlos igual.
    assert.notEqual(
      sessionNotificationTag('containers-day', '1'),
      sessionNotificationTag('other-event', '1'),
    );
  });
});

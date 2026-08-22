'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Agenda } from '@/types';
import type { Filters } from '@/lib/agenda';
import {
  filterSessions,
  groupByStart,
  nextUpcomingSelected,
} from '@/lib/agenda';
import { formatDayHeading, formatTime } from '@/lib/time';
import {
  getPermission,
  requestPermission,
  showNotification,
  type NotifPermission,
} from '@/lib/notifications';
import { useSelectedSessions } from '@/hooks/useSelectedSessions';
import { useNow } from '@/hooks/useNow';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import SessionCard from './SessionCard';
import FiltersBar from './Filters';
import UpcomingBanner from './UpcomingBanner';
import NotificationToggle from './NotificationToggle';

const NOTIF_ENABLED_KEY = 'cd-agenda:notif-enabled:v1';

const EMPTY_FILTERS: Filters = {
  rooms: new Set(),
  labels: new Set(),
  query: '',
  onlyMine: false,
};

export default function AgendaApp({ agenda }: { agenda: Agenda }) {
  const { selectedIds, hydrated, isSelected, toggle, clear } =
    useSelectedSessions();
  const now = useNow();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [permission, setPermission] = useState<NotifPermission>('default');
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const topbarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setPermission(getPermission());
    setNotifEnabled(
      window.localStorage.getItem(NOTIF_ENABLED_KEY) === 'true' &&
        getPermission() === 'granted',
    );
    // ¿Corremos como PWA instalada (home screen)? En iOS/WebKit el
    // almacenamiento de la app instalada está separado del navegador, así que
    // la selección hecha en Safari no aparece aquí: hay que elegir de nuevo.
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    setIsStandalone(!!standalone);
  }, []);

  useEffect(() => {
    const updateTopbarHeight = () => {
      if (topbarRef.current) {
        const height = topbarRef.current.offsetHeight;
        document.documentElement.style.setProperty('--topbar-h', `${height}px`);
      }
    };

    updateTopbarHeight();

    const observer = new ResizeObserver(updateTopbarHeight);
    if (topbarRef.current) {
      observer.observe(topbarRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useNotificationScheduler({
    agenda,
    selectedIds,
    enabled: notifEnabled && permission === 'granted',
  });

  const handleToggleNotif = async () => {
    if (notifEnabled) {
      setNotifEnabled(false);
      window.localStorage.setItem(NOTIF_ENABLED_KEY, 'false');
      return;
    }
    let perm = getPermission();
    if (perm === 'default') perm = await requestPermission();
    setPermission(perm);
    const on = perm === 'granted';
    setNotifEnabled(on);
    window.localStorage.setItem(NOTIF_ENABLED_KEY, on ? 'true' : 'false');
    if (on) {
      void showNotification('¡Avisos activados! 🔔', {
        body: 'Te avisaremos 10 min antes de cada charla de tu agenda.',
        tag: 'welcome',
      });
    }
  };

  const handleTest = () => {
    void showNotification('Notificación de prueba 🔔', {
      body: 'Así se verá el aviso antes de tu charla.',
      tag: 'test',
    });
  };

  const results = useMemo(
    () => filterSessions(agenda, filters, selectedIds),
    [agenda, filters, selectedIds],
  );
  const slots = useMemo(() => groupByStart(results), [results]);
  const upcoming = nextUpcomingSelected(agenda, selectedIds, now || undefined);

  const dayHeading = agenda.sessions.length
    ? formatDayHeading(agenda.sessions[0].start, agenda.timezone)
    : '';

  return (
    <>
      <header ref={topbarRef} className="topbar">
        <div className="topbar__inner">
          <div className="topbar__text">
            <h1 className="topbar__title">
              Mi Agenda <span className="topbar__event">· Containers Day</span>
            </h1>
            <span className="topbar__day">{dayHeading}</span>
          </div>
          {hydrated && selectedIds.size > 0 && (
            <button type="button" className="topbar__clear" onClick={clear}>
              Vaciar ({selectedIds.size})
            </button>
          )}
        </div>
      </header>

      <main className="container">
        {hydrated && isStandalone && selectedIds.size === 0 && (
          <div className="callout" role="note">
            <strong>📲 Estás en la app instalada.</strong> Tu selección del
            navegador no se transfiere aquí: en iPhone la app del inicio y
            Safari guardan los datos por separado. Marca ★ en tus charlas dentro
            de la app y se quedarán guardadas aquí.
          </div>
        )}

        <NotificationToggle
          permission={permission}
          enabled={notifEnabled}
          onToggle={handleToggleNotif}
          onTest={handleTest}
        />

        <UpcomingBanner session={upcoming} tz={agenda.timezone} now={now} />

        <FiltersBar
          agenda={agenda}
          filters={filters}
          onChange={setFilters}
          selectedCount={selectedIds.size}
          resultCount={results.length}
        />

        {slots.length === 0 ? (
          <p className="empty">
            {filters.onlyMine
              ? 'Aún no has agregado charlas a tu agenda. Marca ★ en las que te interesen.'
              : 'Ninguna sesión coincide con esos filtros.'}
          </p>
        ) : (
          <div className="schedule">
            {slots.map((slot) => (
              <section key={slot.start} className="slot">
                <h2 className="slot__time">
                  {formatTime(slot.start, agenda.timezone)}
                </h2>
                <div className="slot__cards">
                  {slot.sessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      tz={agenda.timezone}
                      selected={isSelected(s.id)}
                      onToggle={toggle}
                      now={now}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="footer">
          <p>
            Datos de{' '}
            <a href={agenda.source} target="_blank" rel="noreferrer">
              containers.day/agenda
            </a>
            . Tu selección se guarda solo en este dispositivo. En iPhone, la app
            instalada y el navegador la guardan por separado.
          </p>
        </footer>
      </main>
    </>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Agenda } from '@/types';
import type { Filters } from '@/lib/agenda';
import {
  autoAnnouncedIds,
  filterSessions,
  groupByStart,
  nextUpcomingSelected,
  soleOptionIds,
} from '@/lib/agenda';
import { formatDayHeading, formatTime } from '@/lib/time';
import {
  eventNotificationTag,
  getPermission,
  isIOS,
  requestPermission,
  showNotification,
  type NotifPermission,
} from '@/lib/notifications';
import { loadNotificationsEnabled, saveNotificationsEnabled, upsertEvent } from '@/lib/storage';
import { useSelectedSessions } from '@/hooks/useSelectedSessions';
import { useNow } from '@/hooks/useNow';
import { useAgendaRefresh } from '@/hooks/useAgendaRefresh';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import SessionCard from './SessionCard';
import FiltersBar from './Filters';
import UpcomingBanner from './UpcomingBanner';
import NotificationToggle from './NotificationToggle';
import InstallPrompt from './InstallPrompt';
import DelayBanner from './DelayBanner';
import FreshnessIndicator from './FreshnessIndicator';

const EMPTY_FILTERS: Filters = {
  rooms: new Set(),
  labels: new Set(),
  query: '',
  onlyMine: false,
};

export default function AgendaApp({
  eventId,
  agenda: initialAgenda,
}: {
  eventId: string;
  agenda: Agenda;
}) {
  // La agenda vive en `useAgendaRefresh`: arranca con la horneada en build,
  // pero se mantiene sincronizada con `/agenda.json` en runtime de forma
  // independiente del estado de las notificaciones (ver ese hook).
  const { agenda, status, lastSuccessfulSyncAt, lastAttemptAt } =
    useAgendaRefresh(eventId, initialAgenda, {
      enabled: initialAgenda.event.refreshMode === 'live',
    });
  const { selectedIds, hydrated, isSelected, toggle, clear, seedDefaults } =
    useSelectedSessions(eventId);
  const now = useNow();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [permission, setPermission] = useState<NotifPermission>('default');
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  // Bloques sin opción (breaks, ceremonias, charlas únicas en su franja) se
  // avisan solos, sin que el usuario los marque; unimos con su selección.
  const autoIds = useMemo(() => autoAnnouncedIds(agenda), [agenda]);
  const announceIds = useMemo(
    () => new Set<string>([...selectedIds, ...autoIds]),
    [selectedIds, autoIds],
  );

  // Charlas que son única opción de su franja: las sembramos marcadas por defecto
  // (una sola vez cada una) cuando ya hidratamos y conocemos la agenda vigente.
  // Así entran en la selección normal: cuentan como propias, salen en "Solo las
  // mías" y avisan — pero la persona puede desmarcarlas y el aviso se cancela.
  const soleIds = useMemo(() => soleOptionIds(agenda), [agenda]);
  useEffect(() => {
    if (hydrated) seedDefaults(soleIds);
  }, [hydrated, soleIds, seedDefaults]);

  const topbarRef = useRef<HTMLElement>(null);

  // Registra (o actualiza) este evento en el índice, para que Fase 2 (home)
  // lo encuentre sin depender de que la persona visite `/` primero.
  useEffect(() => {
    upsertEvent(agenda.event);
  }, [agenda.event]);

  useEffect(() => {
    setPermission(getPermission());
    setNotifEnabled(
      loadNotificationsEnabled(eventId) && getPermission() === 'granted',
    );
    // ¿Corremos como PWA instalada (home screen)? En iOS/WebKit el
    // almacenamiento de la app instalada está separado del navegador, así que
    // la selección hecha en Safari no aparece aquí: hay que elegir de nuevo.
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    setIsStandalone(!!standalone);
  }, [eventId]);

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
    eventId,
    agenda,
    selectedIds: announceIds,
    enabled: notifEnabled && permission === 'granted',
  });

  const handleToggleNotif = async () => {
    if (notifEnabled) {
      setNotifEnabled(false);
      saveNotificationsEnabled(eventId, false);
      return;
    }
    let perm = getPermission();
    if (perm === 'default') perm = await requestPermission();
    setPermission(perm);
    const on = perm === 'granted';
    setNotifEnabled(on);
    saveNotificationsEnabled(eventId, on);
    if (on) {
      void showNotification('¡Avisos activados! 🔔', {
        body: 'Te avisaremos 10 min antes de cada charla de tu agenda.',
        tag: eventNotificationTag(eventId, 'welcome'),
      });
    }
  };

  const handleTest = async () => {
    setTestMsg('Enviando…');
    const ok = await showNotification('Notificación de prueba 🔔', {
      body: 'Así se verá el aviso antes de tu charla.',
      tag: eventNotificationTag(eventId, 'test'),
    });
    if (!ok) {
      setTestMsg(
        '⚠️ No se pudo mostrar. Revisa el permiso de notificaciones del sitio en tu navegador.',
      );
      return;
    }
    // En iPhone instalado, iOS NO muestra el banner mientras la app está abierta
    // y al frente: la notificación se envía igual, pero aparece al bloquear la
    // pantalla o cambiar de app. Se lo explicamos para que no parezca que falla.
    setTestMsg(
      isIOS() && isStandalone
        ? '✅ Enviada. En iPhone el aviso no salta mientras la app está abierta: bloquea la pantalla o cambia de app y lo verás en el centro de notificaciones.'
        : '✅ Enviada. En el móvil aparece en la barra/bandeja de notificaciones, no como ventana.',
    );
  };

  const results = useMemo(
    () => filterSessions(agenda, filters, selectedIds),
    [agenda, filters, selectedIds],
  );
  const slots = useMemo(() => groupByStart(results), [results]);
  const upcoming = nextUpcomingSelected(agenda, announceIds, now || undefined);

  const dayHeading = agenda.sessions.length
    ? formatDayHeading(agenda.sessions[0].start, agenda.event.timezone)
    : '';

  return (
    <>
      <header ref={topbarRef} className="topbar">
        <div className="topbar__inner">
          <Link className="topbar__back" href="/" aria-label="Volver a Mis eventos">
            <span aria-hidden="true">←</span>
          </Link>
          <div className="topbar__text">
            <h1 className="topbar__title">
              Mi agenda <span className="topbar__event">· {agenda.event.name}</span>
            </h1>
            <span className="topbar__day">{dayHeading}</span>
            {agenda.event.refreshMode === 'live' ? (
              <FreshnessIndicator
                status={status}
                lastSuccessfulSyncAt={lastSuccessfulSyncAt}
                lastAttemptAt={lastAttemptAt}
                now={now}
              />
            ) : (
              <span className="freshness">Copia importada</span>
            )}
          </div>
          {hydrated && selectedIds.size > 0 && (
            <button type="button" className="topbar__clear" onClick={clear}>
              Vaciar ({selectedIds.size})
            </button>
          )}
        </div>
      </header>

      <main id="main-content" className="container">
        <DelayBanner />

        <InstallPrompt />

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
          testMsg={testMsg}
        />

        <UpcomingBanner session={upcoming} tz={agenda.event.timezone} now={now} />

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
                  {formatTime(slot.start, agenda.event.timezone)}
                </h2>
                <div className="slot__cards">
                  {slot.sessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      tz={agenda.event.timezone}
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
            <a href={agenda.event.sourceUrl} target="_blank" rel="noreferrer">
              {agenda.event.name}
            </a>
            . Tu selección se guarda solo en este dispositivo. En iPhone, la app
            instalada y el navegador la guardan por separado.
          </p>
        </footer>
      </main>
    </>
  );
}

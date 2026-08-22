/**
 * Descarga la agenda pública de Containers Day y la convierte a un JSON limpio
 * que la app importa en build time. Correr con: `npm run fetch-agenda`.
 *
 * La página sirve cada sesión como un <article class="session-card"> con atributos
 * data-* estructurados (data-session = UUID estable, data-start / data-end / data-room),
 * el título en <h3 class="session-card__title"> y los speakers en <ul class="session-card__speakers">.
 *
 * Los datetimes vienen SIN offset (hora local del evento). Containers Day es en
 * Rep. Dominicana (America/Santo_Domingo, UTC-4, sin horario de verano), así que
 * les anexamos "-04:00" para obtener un instante absoluto correcto en cualquier device.
 */
import { parse } from 'node-html-parser';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AGENDA_URL = 'https://containers.day/agenda/';
const CONFERENCE_TZ = 'America/Santo_Domingo';
const CONFERENCE_UTC_OFFSET = '-04:00';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, '..', 'src', 'data', 'agenda.json');

function withOffset(localIso) {
  if (!localIso) return null;
  // "2026-08-22T09:00:00" -> "2026-08-22T09:00:00-04:00"
  return `${localIso}${CONFERENCE_UTC_OFFSET}`;
}

function clean(text) {
  return (text || '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log(`[fetch-agenda] Descargando ${AGENDA_URL} ...`);
  const res = await fetch(AGENDA_URL, {
    headers: { 'user-agent': 'containers-day-agenda-pwa/1.0 (+build)' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al descargar la agenda`);
  }
  const html = await res.text();
  const root = parse(html);

  const cards = root.querySelectorAll('article.session-card');
  if (cards.length === 0) {
    throw new Error('No se encontró ninguna .session-card; ¿cambió el markup?');
  }

  const sessions = [];
  for (const card of cards) {
    const id = card.getAttribute('data-session');
    const start = card.getAttribute('data-start');
    const end = card.getAttribute('data-end');
    const room = clean(card.getAttribute('data-room'));
    const isService = card.getAttribute('data-service') === 'true';

    // Título: puede venir como texto plano o dentro de un <button>.
    const titleEl = card.querySelector('.session-card__title');
    const title = clean(titleEl?.text);

    // Speakers: cada <li class="session-card__speaker"> tiene un <span> con el nombre.
    const speakers = card
      .querySelectorAll('.session-card__speaker')
      .map((li) => clean(li.querySelector('span')?.text || li.text))
      .filter(Boolean);

    // Labels / temas.
    const labels = card
      .querySelectorAll('.session-card__labels .session-label')
      .map((li) => clean(li.text))
      .filter(Boolean);

    if (!id || !start || !title) continue;

    sessions.push({
      id,
      title,
      room,
      speakers,
      labels,
      isService, // registro, coffee break, ceremonias, etc.
      start: withOffset(start),
      end: withOffset(end),
    });
  }

  // Orden estable por hora de inicio y luego por salón.
  sessions.sort((a, b) => {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return a.room.localeCompare(b.room);
  });

  const rooms = [...new Set(sessions.map((s) => s.room).filter(Boolean))];
  const allLabels = [...new Set(sessions.flatMap((s) => s.labels))].sort((a, b) =>
    a.localeCompare(b),
  );

  const payload = {
    source: AGENDA_URL,
    timezone: CONFERENCE_TZ,
    utcOffset: CONFERENCE_UTC_OFFSET,
    fetchedAt: new Date().toISOString(),
    rooms,
    labels: allLabels,
    sessions,
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf-8');

  const talks = sessions.filter((s) => !s.isService).length;
  console.log(
    `[fetch-agenda] OK: ${sessions.length} sesiones (${talks} charlas), ${rooms.length} salones -> src/data/agenda.json`,
  );
}

main().catch((err) => {
  console.error('[fetch-agenda] ERROR:', err.message);
  process.exit(1);
});

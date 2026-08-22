'use client';

import type { Agenda } from '@/types';
import type { Filters } from '@/lib/agenda';

interface Props {
  agenda: Agenda;
  filters: Filters;
  onChange: (next: Filters) => void;
  selectedCount: number;
  resultCount: number;
}

export default function FiltersBar({
  agenda,
  filters,
  onChange,
  selectedCount,
  resultCount,
}: Props) {
  const toggleIn = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <section className="filters" aria-label="Filtros de la agenda">
      <input
        type="search"
        className="filters__search"
        placeholder="Buscar charla, speaker o tema…"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
      />

      <div className="filters__row" role="group" aria-label="Salones">
        <span className="filters__legend">Salón</span>
        {agenda.rooms.map((room) => (
          <button
            key={room}
            type="button"
            className={`pill${filters.rooms.has(room) ? ' pill--on' : ''}`}
            aria-pressed={filters.rooms.has(room)}
            onClick={() =>
              onChange({ ...filters, rooms: toggleIn(filters.rooms, room) })
            }
          >
            {room}
          </button>
        ))}
      </div>

      {agenda.labels.length > 0 && (
        <div className="filters__row" role="group" aria-label="Temas">
          <span className="filters__legend">Tema</span>
          {agenda.labels.map((label) => (
            <button
              key={label}
              type="button"
              className={`pill${filters.labels.has(label) ? ' pill--on' : ''}`}
              aria-pressed={filters.labels.has(label)}
              onClick={() =>
                onChange({ ...filters, labels: toggleIn(filters.labels, label) })
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="filters__row filters__row--foot">
        <button
          type="button"
          className={`pill pill--mine${filters.onlyMine ? ' pill--on' : ''}`}
          aria-pressed={filters.onlyMine}
          onClick={() => onChange({ ...filters, onlyMine: !filters.onlyMine })}
        >
          ★ Solo mi agenda ({selectedCount})
        </button>
        <span className="filters__count">{resultCount} sesiones</span>
      </div>
    </section>
  );
}

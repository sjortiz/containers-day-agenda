'use client';

import type { Agenda } from '@/types';
import type { Filters } from '@/lib/agenda';
import MultiSelectDropdown from './MultiSelectDropdown';

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
  return (
    <section className="filters" aria-label="Filtros de la agenda">
      <input
        type="search"
        className="filters__search"
        placeholder="Buscar charla, speaker o tema…"
        aria-label="Buscar charla, speaker o tema"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
      />

      <div className="filters__row">
        <MultiSelectDropdown
          label="Salón"
          options={agenda.rooms}
          selected={filters.rooms}
          onChange={(rooms) => onChange({ ...filters, rooms })}
        />
        {agenda.labels.length > 0 && (
          <MultiSelectDropdown
            label="Tema"
            options={agenda.labels}
            selected={filters.labels}
            onChange={(labels) => onChange({ ...filters, labels })}
          />
        )}
      </div>

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

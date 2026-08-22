'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = `msd-panel-${label.replace(/\s+/g, '-').toLowerCase()}`;

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const toggleOption = (option: string) => {
    const next = new Set(selected);
    if (next.has(option)) {
      next.delete(option);
    } else {
      next.add(option);
    }
    onChange(next);
  };

  const clearAll = () => {
    onChange(new Set());
  };

  const buttonLabel =
    selected.size > 0 ? `${label} · ${selected.size}` : label;

  return (
    <div className="msd" ref={containerRef}>
      <button
        type="button"
        className={`msd__btn${selected.size > 0 ? ' msd__btn--active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {buttonLabel}
      </button>

      {open && (
        <div id={panelId} className="msd__panel" role="dialog">
          <div className="msd__header">
            <span className="msd__title">{label}</span>
            {selected.size > 0 && (
              <button
                type="button"
                className="msd__clear"
                onClick={clearAll}
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="msd__list">
            {options.map((option) => (
              <label key={option} className="msd__option">
                <input
                  type="checkbox"
                  checked={selected.has(option)}
                  onChange={() => toggleOption(option)}
                />
                <span className="msd__option-label">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

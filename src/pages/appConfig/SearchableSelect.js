import { useState } from 'react';

// Generic searchable dropdown used across all CMS destination pickers (product / collection /
// category / business). Replaces plain native <select> elements — those render the browser's
// unstyled OS listbox and can't be searched, which becomes unusable once a list grows past a
// couple dozen items (e.g. 160+ businesses or 1000+ products).
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  emptyLabel = 'No matches found',
  isLoading = false,
  onOpen,
  currentValueLabel,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find((option) => String(option.value) === String(value));
  const selectedLabel = selectedOption
    ? selectedOption.label
    : value
      ? currentValueLabel || `#${value}`
      : '';

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? safeOptions.filter((option) =>
        (option.searchText || option.label || '').toLowerCase().includes(normalizedQuery)
      )
    : safeOptions;

  return (
    <div
      className="cms-combobox"
      onBlur={() => {
        window.setTimeout(() => setIsOpen(false), 120);
      }}
    >
      <div className="cms-combobox-control">
        {value ? (
          <span className="cms-combobox-chip" title={selectedLabel}>
            {selectedLabel}
          </span>
        ) : null}
        <input
          type="search"
          className="cms-combobox-input"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (onOpen) onOpen();
            setIsOpen(true);
          }}
          placeholder={value ? 'Search to change...' : placeholder}
        />
      </div>
      {isOpen ? (
        <div className="cms-combobox-panel">
          {isLoading ? (
            <div className="cms-combobox-empty">Loading...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="cms-combobox-empty">{emptyLabel}</div>
          ) : (
            filteredOptions.slice(0, 500).map((option) => (
              <button
                type="button"
                key={option.value}
                className={`cms-combobox-option${String(option.value) === String(value) ? ' is-selected' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setQuery('');
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

import React, { useState, useRef, useEffect, useMemo } from 'react';
import './SearchableSelect.css';

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyLabel = 'No options found',
  disabled = false,
  hasError = false,
  clearable = true,
  isLoading = false,
  loadingLabel = 'Loading...',
  className = '',
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options to: { value: string, label: string, subLabel?: string, badge?: string, searchText?: string }
  const normalizedOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    return options.map((opt) => {
      if (opt && typeof opt === 'object') {
        return {
          value: String(opt.value ?? ''),
          label: String(opt.label ?? opt.name ?? opt.value ?? ''),
          subLabel: opt.subLabel ? String(opt.subLabel) : undefined,
          badge: opt.badge ? String(opt.badge) : undefined,
          searchText: opt.searchText ? String(opt.searchText) : undefined,
        };
      }
      return {
        value: String(opt ?? ''),
        label: String(opt ?? ''),
      };
    });
  }, [options]);

  // Selected option
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null || value === '') return null;
    return normalizedOptions.find((opt) => String(opt.value) === String(value)) || null;
  }, [value, normalizedOptions]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((opt) => {
      const searchTarget = (
        (opt.searchText || '') +
        ' ' +
        opt.label +
        ' ' +
        (opt.subLabel || '') +
        ' ' +
        (opt.badge || '')
      ).toLowerCase();
      return searchTarget.includes(q);
    });
  }, [normalizedOptions, query]);

  // Handle outside click & escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setQuery('');
    }
  };

  const handleSelect = (optVal) => {
    onChange?.(optVal);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    onChange?.('');
    setQuery('');
  };

  return (
    <div
      ref={wrapperRef}
      className={`ss-wrapper ${isOpen ? 'ss-open' : ''} ${className}`}
      style={style}
    >
      <div
        className={`ss-trigger ${hasError ? 'ss-error' : ''} ${disabled ? 'ss-disabled' : ''}`}
        onClick={handleToggle}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="ss-selected-content">
          {selectedOption ? (
            <>
              <span className="ss-selected-label" title={selectedOption.label}>
                {selectedOption.label}
              </span>
              {selectedOption.badge ? (
                <span className="ss-option-badge">{selectedOption.badge}</span>
              ) : null}
              {selectedOption.subLabel ? (
                <span className="ss-selected-sub">{selectedOption.subLabel}</span>
              ) : null}
            </>
          ) : (
            <span className="ss-placeholder">{placeholder}</span>
          )}
        </div>

        <div className="ss-actions">
          {isLoading ? (
            <span className="ss-trigger-spinner" title="Loading..." />
          ) : null}
          {clearable && selectedOption && !disabled && !isLoading ? (
            <button
              type="button"
              className="ss-clear-btn"
              onClick={handleClear}
              title="Clear"
            >
              ✕
            </button>
          ) : null}
          <span className="ss-chevron">▾</span>
        </div>
      </div>

      {isOpen && !disabled ? (
        <div className="ss-panel">
          <div className="ss-search-wrap">
            <span className="ss-search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="ss-search-input"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {query ? (
              <button
                type="button"
                className="ss-search-clear"
                onClick={() => setQuery('')}
                title="Clear search"
              >
                ✕
              </button>
            ) : null}
            {filteredOptions.length > 0 && query ? (
              <span className="ss-search-count">{filteredOptions.length} found</span>
            ) : null}
          </div>

          <div className="ss-options-list">
            {isLoading ? (
              <div className="ss-loading">
                <span className="ss-spinner" />
                <span>{loadingLabel}</span>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="ss-empty">
                {query ? `No results for "${query}"` : emptyLabel}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedOption && String(selectedOption.value) === String(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ss-option ${isSelected ? 'ss-selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <div className="ss-option-main">
                      <span className="ss-option-label">{opt.label}</span>
                      {opt.subLabel ? (
                        <span className="ss-option-sub">{opt.subLabel}</span>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {opt.badge ? (
                        <span className="ss-option-badge">{opt.badge}</span>
                      ) : null}
                      {isSelected ? <span className="ss-check-icon">✓</span> : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

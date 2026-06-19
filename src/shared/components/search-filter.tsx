import type { ReactNode } from 'react';

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Optional right-aligned mono hint (e.g. "3 of 12"). */
  hint?: ReactNode;
}

/** The app's one list filter: loop icon inside the input, shared layout and
 *  spacing on every list page. */
export default function SearchFilter({
  value,
  onChange,
  placeholder = 'Filter…',
  hint,
}: SearchFilterProps) {
  return (
    <div className="okdp-filter-bar">
      <div className="okdp-search-wrapper">
        <i className="pi pi-search search-icon"></i>
        <input
          className="okdp-search-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint != null && <div className="filter-hint">{hint}</div>}
    </div>
  );
}

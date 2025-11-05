// components/DropdownUnitSelect.jsx
import { useState, useRef, useEffect } from 'react';

export default function DropdownUnitSelect({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select unit',
  disabled = false,
  label,
  labelClassName = 'sr-only', // hide by default inside tables
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  // Normalize options (accept ["bag"] or [{value,label}])
  const opts = Array.isArray(options)
    ? options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
    : [];

  const selected =
    opts.find((o) => String(o.value) === String(value)) ||
    (placeholder ? { value: '', label: placeholder } : opts[0]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Decide open direction
  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(224, Math.max(opts.length, 1) * 36); // compact list
      setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
    }
    setIsOpen((s) => !s);
  };

  const handlePick = (v) => {
    onChange?.({ target: { value: v } }); // keep event-like API
    setIsOpen(false);
  };

  return (
    <div ref={wrapRef} className={`w-full ${className}`}>
      {label !== undefined && (
        <label className={labelClassName}>{label}</label>
      )}

      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full h-8 px-2 text-sm bg-white border rounded-md flex items-center justify-between leading-none
          ${disabled
            ? 'opacity-60 cursor-not-allowed border-gray-300'
            : 'border-gray-300 hover:border-gray-400 '}
        `}
      >
        <span className="truncate">
          {selected ? selected.label : ''}
        </span>
        <svg
          className={`w-3 h-3 ml-1 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Menu */}
      {isOpen && !disabled && (
        <div
          className={`absolute z-[9999] bg-white border border-gray-300 rounded-md shadow-lg max-h-56 overflow-auto hide-scrollbar min-w-[8rem]
            ${openUpward ? 'mb-1 bottom-full' : 'mt-1'}
          `}
          style={{ left: 0, right: 0 }}
          role="listbox"
        >
          {(opts.length ? opts : [{ value: '', label: placeholder }]).map((o, i) => {
            const isSelected = String(o.value) === String(value);
            return (
              <div
                key={o.value ?? i}
                role="option"
                aria-selected={isSelected}
                onClick={() => handlePick(o.value)}
                className={`px-2 py-2 text-sm cursor-pointer border-b border-gray-100 last:border-b-0
                  ${isSelected
                    ? 'bg-gray-100 text-gray-900 font-semibold'
                    : 'text-gray-800 hover:bg-gray-100'}
                `}
              >
                {o.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

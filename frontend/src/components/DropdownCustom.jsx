import { useState, useRef, useEffect, useMemo } from 'react';

const DropdownCustom = ({
  value,
  onChange,
  options = [],
  label,
  variant = 'default',
  error = false,
  labelClassName,
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg'
  searchable = false,
  searchPlaceholder = 'Search...',
  noResultsMessage = 'No results found',
  autoFocusSearch = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');

  // --- size maps (button, option rows, icon, label, min width, icon gap) ---
  const btnSize = {
    xs: 'h-8 text-xs px-2',        // ~32px
    sm: 'h-9 text-sm px-2.5',      // ~36px
    md: 'h-9 text-sm px-3',        // ~36px (default)
    lg: 'h-11 text-base px-3.5',   // ~44px
  }[size];

  const rowSize = {
    xs: 'py-2 text-xs',
    sm: 'py-2.5 text-sm',
    md: 'py-3 text-sm',
    lg: 'py-3.5 text-base',
  }[size];

  const iconSize = {
    xs: 'w-4 h-4',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-5 h-5',
  }[size];

  const iconGap = {
    xs: 'ml-2',
    sm: 'ml-2',
    md: 'ml-3',
    lg: 'ml-3',
  }[size];

  const labelSize = {
    xs: 'text-[11px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  // min width responds to size so xs looks compact
  const minW = {
    xs: 'min-w-[7.5rem]',  // 120px
    sm: 'min-w-[8.5rem]',  // 136px
    md: 'min-w-[9.5rem]',  // 152px
    lg: 'min-w-[11rem]',   // 176px
  }[size];

  // numeric row heights for openUpward calc
  const rowHeightNum = { xs: 32, sm: 40, md: 48, lg: 56 }[size];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        if (searchable) {
          setSearchTerm('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchable]);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(240, options.length * rowHeightNum);
      setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
    }
    if (isOpen && searchable) {
      setSearchTerm('');
    }
    setIsOpen(!isOpen);
  };

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const renderedOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    if (!searchable || normalizedSearch.length === 0) {
      return options;
    }
    return options.filter((option) => {
      const labelText = option?.label ? String(option.label).toLowerCase() : '';
      return labelText.includes(normalizedSearch);
    });
  }, [options, searchable, normalizedSearch]);

  useEffect(() => {
    if (!isOpen && searchable && searchTerm) {
      setSearchTerm('');
    }
  }, [isOpen, searchable, searchTerm]);

  const renderOptionList = (list) => (
    <div className="max-h-60 overflow-auto hide-scrollbar">
      {list.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-500">
          {noResultsMessage}
        </div>
      ) : (
        list.map((option, index) => (
          <div
            key={option.value || index}
            onClick={() => {
              if (option.disabled) return;
              onChange({ target: { value: option.value } });
              setIsOpen(false);
              if (searchable) {
                setSearchTerm('');
              }
            }}
            className={`
              px-4 ${rowSize} cursor-pointer transition-colors border-b border-gray-100 last:border-b-0
              ${option.disabled ? 'opacity-50 cursor-not-allowed text-gray-400' : ''}
              ${value === option.value
                ? 'bg-green-500 text-white font-semibold hover:bg-green-600'
                : (option.disabled ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-100')
              }
            `}
          >
            {option.label}
          </div>
        ))
      )}
    </div>
  );

  const getButtonClassName = () => {
    if (variant === 'simple' || variant === 'default') {
      return `
        w-full ${btnSize} flex items-center justify-between leading-none bg-white
        transition-all duration-200 border rounded-md text-gray-900
        ${error
          ? 'border-red-500 ring-1 ring-red-50 focus:ring-red-500'
          : 'border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500'
        }
      `;
    }

    if (variant === 'floating') {
      // IMPORTANT: removed hard-coded pl-4 pr-3 and fixed 150px min-width.
      return `
        border-2 rounded-lg w-full ${minW} ${btnSize} leading-none align-middle
        font-semibold text-gray-700 bg-white cursor-pointer shadow-sm
        hover:shadow-md outline-none text-left flex items-center justify-between
        transition-all duration-200
        ${error
          ? 'border-red-500 ring-2 ring-red-50 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 hover:border-green-400'
        }
      `;
    }
  };

  const getLabelClassName = () => {
    if (labelClassName) return labelClassName;
    return `block ${labelSize} font-medium mb-1 ${error ? 'text-red-600' : 'text-gray-700'}`;
  };

  if (variant === 'simple' || variant === 'default') {
    return (
      <div className="w-full" ref={dropdownRef}>
        {label ? <label className={getLabelClassName()}>{label}</label> : null}
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggle}
            className={getButtonClassName()}
          >
            <span className="truncate">{selectedOption?.label}</span>
            <svg
              className={`${iconSize} ${iconGap} flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <div
              className={`
                absolute left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg
                z-[9999] max-h-60 overflow-hidden
                ${openUpward ? 'bottom-full mb-2' : 'top-full mt-2'}
              `}
              style={openUpward ? { marginBottom: '8px' } : { marginTop: '8px' }}
            >
              {searchable && (
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    autoFocus={autoFocusSearch}
                  />
                </div>
              )}
              {renderOptionList(renderedOptions)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'floating') {
    return (
      <div className="flex gap-x-3 items-center w-full lg:w-auto">
        <div className="relative w-full" ref={dropdownRef}>
          {label ? (
            <label
              className={`
                absolute left-2 -top-3 rounded-md bg-white px-2
                ${labelSize} font-semibold pointer-events-none z-10
                ${error ? 'text-red-600' : 'text-gray-700'}
              `}
            >
              {label}
            </label>
          ) : null}

          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggle}
            className={getButtonClassName()}
          >
            <span className="truncate">{selectedOption ? selectedOption.label : ''}</span>
            <svg
              className={`${iconSize} ${iconGap} flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <div
              className={`
                absolute left-0 bg-white border border-gray-200 rounded-md shadow-lg
                z-[9999] max-h-60 overflow-hidden min-w-full
                ${openUpward ? 'bottom-full mb-2' : 'top-full mt-2'}
              `}
              style={openUpward ? { marginBottom: '8px' } : { marginTop: '8px' }}
            >
              {searchable && (
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    autoFocus
                  />
                </div>
              )}
              {renderOptionList(renderedOptions)}
            </div>
          )}
        </div>
      </div>
    );
  }
};

export default DropdownCustom;

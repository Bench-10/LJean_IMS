import { useState, useRef, useEffect } from 'react'; 

const DropdownCustom = ({
  value,
  onChange,
  options = [],
  label,
  variant = 'default',
  error = false,
  labelClassName,
  // NEW: compact control just for places that ask for it
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // --- size maps (button, option rows, icon, label) ---
  const btnSize = {
    xs: 'h-8 text-xs px-2',         // ~32px
    sm: 'h-9 text-sm px-2.5',       // ~36px
    md: 'h-9 text-sm px-3',         // keep old ~36px default
    lg: 'h-11 text-base px-3.5',    // ~44px
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

  const labelSize = {
    xs: 'text-[11px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  // numeric row heights for openUpward calc
  const rowHeightNum = { xs: 32, sm: 40, md: 48, lg: 56 }[size];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(240, options.length * rowHeightNum);
      setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
    }
    setIsOpen(!isOpen);
  };

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  const getButtonClassName = () => {
    if (variant === 'simple' || variant === 'default') {
      return `w-full ${btnSize} flex items-center justify-between leading-none bg-white 
      transition-all duration-200 border rounded-md text-gray-900 
      ${error 
        ? 'border-red-500 ring-1 ring-red-50 focus:ring-red-500' 
        : 'border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500'
      }`;
    }
    
    if (variant === 'floating') {
      return `border-2 rounded-lg pl-4 pr-3 w-full min-w-[150px] ${btnSize} leading-none align-middle font-semibold text-gray-700 bg-white cursor-pointer shadow-sm hover:shadow-md outline-none text-left flex items-center justify-between transition-all duration-200 ${
        error
          ? 'border-red-500 ring-2 ring-red-50 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 hover:border-green-400'
      }`;
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
            <span className="truncate">{selectedOption.label}</span>
            <svg className={`${iconSize} ml-2 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isOpen && (
            <div 
              className={`absolute left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-[9999] max-h-60 overflow-hidden ${
                openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
              }`}
              style={openUpward ? { marginBottom: '8px' } : { marginTop: '8px' }}
            >
              <div className="max-h-60 overflow-auto hide-scrollbar">
                {options.map((option, index) => (
                  <div
                    key={option.value || index}
                    onClick={() => {
                      onChange({ target: { value: option.value } });
                      setIsOpen(false);
                    }}
                    className={`px-4 ${rowSize} cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
                      value === option.value
                        ? 'bg-green-500 text-white font-semibold hover:bg-green-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'floating') {
    return (
      <div className='flex gap-x-3 items-center w-full lg:w-auto'>
        <div className="relative w-full" ref={dropdownRef}>
          {label ? (
            <label className={`absolute left-3 -top-2 rounded-md bg-white px-2 ${labelSize} font-semibold pointer-events-none z-10 ${
              error ? 'text-red-600' : 'text-gray-700'
            }`}>
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
            <svg className={`${iconSize} ml-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isOpen && (
            <div 
              className={`absolute left-0 bg-white border border-gray-200 rounded-md shadow-lg z-[9999] max-h-60 overflow-hidden min-w-full ${
                openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
              }`}
              style={openUpward ? { marginBottom: '8px' } : { marginTop: '8px' }}
            >
              <div className="max-h-60 overflow-auto hide-scrollbar">
                {options.map((option, index) => (
                  <div
                    key={option.value || index}
                    onClick={() => {
                      onChange({ target: { value: option.value } });
                      setIsOpen(false);
                    }}
                    className={`px-4 ${rowSize} cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
                      value === option.value
                        ? 'bg-green-500 text-white font-semibold hover:bg-green-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
};

export default DropdownCustom;

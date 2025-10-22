import { useState, useRef, useEffect } from 'react';

const DropdownCustom = ({ value, onChange, options, label, variant = 'default', error = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

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
      const dropdownHeight = Math.min(240, options.length * 48); // Estimate dropdown height
      
      // Open upward if not enough space below AND there's more space above
      setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
    }
    setIsOpen(!isOpen);
  };

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  // Get button className based on variant and error state
  const getButtonClassName = () => {
    if (variant === 'simple' || variant === 'default') {
return `w-full h-[36px] flex items-center justify-center lg:justify-between px-3 text-sm leading-none bg-white 
transition-all duration-200 border rounded-md text-gray-900 
${error 
  ? 'border-red-500 ring-1 ring-red-50 focus:ring-red-500' 
  : 'border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500'
}`;
    }
    
    if (variant === 'floating') {
      return `border-2 rounded-lg pl-4 pr-3 py-0 w-full h-9 leading-none align-middle text-sm font-semibold text-gray-700 bg-white cursor-pointer shadow-sm hover:shadow-md outline-none text-left flex items-center justify-between transition-all duration-200 ${
        error
          ? 'border-red-500 ring-2 ring-red-50 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 hover:border-green-400'
      }`;
    }
  };

  // Simple style with LABELS ON TOP
  if (variant === 'simple' || variant === 'default') {
    return (
      <div className="w-full" ref={dropdownRef}>
        <label className={`block text-sm font-medium mb-1 ${error ? 'text-red-600' : 'text-gray-700'}`}>
          {label}
        </label>
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggle}
            className={getButtonClassName()}
          >
            <span className="truncate">{selectedOption.label}</span>
            <svg className={`w-5 h-5 ml-2 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className={`px-4 py-3 cursor-pointer transition-colors text-sm border-b border-gray-100 last:border-b-0 ${
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

  // Floating label style
  if (variant === 'floating') {
    return (
      <div className='flex gap-x-3 items-center h-9 w-full lg:w-auto'>
        <div className="relative w-full" ref={dropdownRef}>
          <label className={`absolute left-3 top-[-10px] rounded-md bg-white px-2 text-xs font-semibold pointer-events-none z-10 ${
            error ? 'text-red-600' : 'text-gray-700'
          }`}>
            {label}
          </label>
          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggle}
            className={getButtonClassName()}
          >
            <span className="truncate">{selectedOption ? selectedOption.label : ''}</span>
            <svg className={`w-4 h-4 ml-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className={`px-4 py-3 cursor-pointer transition-colors text-sm border-b border-gray-100 last:border-b-0 ${
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

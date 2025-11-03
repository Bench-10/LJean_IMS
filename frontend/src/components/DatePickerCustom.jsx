import React, { useState, useRef, useEffect } from 'react';

const DatePickerCustom = ({ 
  value, 
  onChange, 
  label, 
  error, 
  placeholder = 'Select date',
  disabled = false,
  errorMessage,
  id,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(value || '');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const calendarRef = useRef(null);

  useEffect(() => {
    setSelectedDate(value || '');
    if (value) {
      setCurrentMonth(new Date(value));
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const firstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};


  const handleToggleOpen = () => {
    if (!disabled) {
      const willOpen = !isOpen;
      setIsOpen(willOpen);
      
      if (willOpen) {
        // Wait for the dropdown to render, then scroll to show the entire calendar
        setTimeout(() => {
          if (calendarRef.current) {
            const calendarRect = calendarRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            
            // Check if calendar bottom is cut off
            if (calendarRect.bottom > viewportHeight) {
              // Scroll to show the entire calendar with some padding
              calendarRef.current.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'end',
                inline: 'nearest'
              });
            }
            // Check if calendar top is cut off
            else if (calendarRect.top < 0) {
              calendarRef.current.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
              });
            }
          }
        }, 100);
      }
    }
  };

  const handleDateSelect = (day) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateString);
    onChange({ target: { value: dateString } });
    setIsOpen(false);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const isToday = (day) => {
    const today = new Date();
    const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return today.toDateString() === checkDate.toDateString();
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    const selected = new Date(selectedDate);
    const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return selected.toDateString() === checkDate.toDateString();
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const renderCalendarDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);

    // Empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-7 w-7"></div>);
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
      const today = isToday(day);
      const selected = isSelected(day);
      
      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateSelect(day)}
          className={`h-7 w-7 rounded-full text-xs font-semibold transition-all relative
            ${selected 
              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg scale-110 hover:from-blue-600 hover:to-blue-700' 
              : today 
              ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-400 hover:bg-blue-100' 
              : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
            }
          `}
        >
          {day}
          {selected && (
            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></span>
          )}
        </button>
      );
    }

    return days;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label 
          htmlFor={id}
          className={`block text-sm font-medium mb-1 ${error ? 'text-red-600' : 'text-gray-600'}`}
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          ref={buttonRef}
          id={id}
          type="button"
          onClick={handleToggleOpen}
          disabled={disabled}
          className={`w-full py-1 px-4 rounded-lg bg-white border text-sm shadow-sm focus:outline-none transition text-left flex items-center justify-between group
            ${error 
              ? 'border-red-500 ring-2 ring-red-100 focus:ring-red-200' 
              : 'border-gray-200 hover:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:border-2'
            }
            ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
          `}
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg transition ${error ? 'bg-red-50' : 'bg-blue-50 group-hover:bg-blue-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${error ? 'text-red-500' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className={`${selectedDate ? 'text-gray-900' : 'text-gray-400'}`}>
              {selectedDate ? formatDate(selectedDate) : placeholder}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {selectedDate && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selected date"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDate('');
                  onChange({ target: { value: '' } });
                  if (buttonRef.current) {
                    buttonRef.current.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedDate('');
                    onChange({ target: { value: '' } });
                    if (buttonRef.current) {
                      buttonRef.current.focus();
                    }
                  }
                }}
                className="p-1 hover:bg-red-50 rounded-lg transition group/clear focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <svg className="h-4 w-4 text-gray-400 group-hover/clear:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
            <svg 
              className={`h-5 w-5 transition-all ${isOpen ? 'rotate-180 text-blue-600' : 'text-gray-400'}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isOpen && !disabled && (
          <div ref={calendarRef} className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-2xl border-2 border-blue-100 overflow-hidden animate-popup">
            {/* Calendar Header with Gradient */}
            <div className="bg-blue-600 p-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={previousMonth}
                  className="p-1 hover:bg-white/20 rounded transition"
                >
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="text-center">
                  <div className="font-bold text-sm text-white">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 hover:bg-white/20 rounded transition"
                >
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-3">
              {/* Day Names */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map((day, idx) => (
                  <div key={idx} className="h-7 flex items-center justify-center text-xs font-bold text-blue-600">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {renderCalendarDays()}
              </div>

              {/* Today Button */}
              <div className="pt-2 border-t border-blue-100">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    setSelectedDate(dateString);
                    setCurrentMonth(today);
                    onChange({ target: { value: dateString } });
                    setIsOpen(false);
                  }}
                  className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-lg transition shadow-md hover:shadow-lg"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Today
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {errorMessage}
        </p>
      )}
    </div>
  );
};

// Demo Component
export default DatePickerCustom

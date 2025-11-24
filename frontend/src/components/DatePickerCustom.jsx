import React, { useState, useRef, useEffect } from "react";

const DatePickerCustom = ({
  value,
  onChange,
  label,
  error = false,
  placeholder = "Select date",
  disabled = false,
  errorMessage,
  id,
  className = "",
  variant = "default", // "default" | "floating"
  showClear = true, // control X visibility
  showIcon = true, // control calendar icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(value || "");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // custom dropdown states
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);

  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const calendarRef = useRef(null);

  // NEW: refs for month/year dropdown lists
  const monthListRef = useRef(null);
  const yearListRef = useRef(null);

  // sync internal state
  useEffect(() => {
    setSelectedDate(value || "");
    if (value) setCurrentMonth(new Date(value));
  }, [value]);

  // close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsMonthOpen(false);
        setIsYearOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // NEW: scroll current month into view when dropdown opens
  useEffect(() => {
    if (isMonthOpen && monthListRef.current) {
      const active = monthListRef.current.querySelector('[data-active="true"]');
      if (active && active.scrollIntoView) {
        active.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isMonthOpen, currentMonth]);

  // NEW: scroll current year into view when dropdown opens
  useEffect(() => {
    if (isYearOpen && yearListRef.current) {
      const active = yearListRef.current.querySelector('[data-active="true"]');
      if (active && active.scrollIntoView) {
        active.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isYearOpen, currentMonth]);

  /* ---------- helpers ---------- */
  const daysInMonth = (d) =>
    new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (d) =>
    new Date(d.getFullYear(), d.getMonth(), 1).getDay();

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yy = d.getFullYear();
    return `${mm}/${dd}/${yy}`;
  };

  const handleToggleOpen = () => {
    if (disabled) return;
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (!willOpen) {
      setIsMonthOpen(false);
      setIsYearOpen(false);
    }
    if (willOpen) {
      setTimeout(() => {
        if (!calendarRef.current) return;
        const r = calendarRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        if (r.bottom > vh)
          calendarRef.current.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        else if (r.top < 0)
          calendarRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 80);
    }
  };

  const handleDateSelect = (day) => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
    setSelectedDate(ds);
    onChange?.({ target: { value: ds } });
    setIsOpen(false);
    setIsMonthOpen(false);
    setIsYearOpen(false);
  };

  const previousMonth = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );

  const nextMonth = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );

  const isToday = (day) => {
    const t = new Date();
    const c = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return t.toDateString() === c.toDateString();
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    const s = new Date(selectedDate);
    const c = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return s.toDateString() === c.toDateString();
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

  // dynamic year options (includes view / selected year even if out of base range)
  const getYearOptions = () => {
    const nowYear = new Date().getFullYear();
    const viewYear = currentMonth.getFullYear();
    const selectedYear = selectedDate
      ? new Date(selectedDate).getFullYear()
      : nowYear;

    let minYear = Math.min(nowYear - 40, viewYear, selectedYear);
    let maxYear = Math.max(nowYear + 10, viewYear, selectedYear);

    const years = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);
    return years;
  };

  const yearOptions = getYearOptions();

  const handleMonthPick = (monthIndex) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), monthIndex, 1));
    setIsMonthOpen(false);
  };

  const handleYearPick = (year) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
    setIsYearOpen(false);
  };

  const renderCalendarDays = () => {
    const nodes = [];
    const total = daysInMonth(currentMonth);
    const first = firstDayOfMonth(currentMonth);
    for (let i = 0; i < first; i++)
      nodes.push(<div key={`e-${i}`} className="h-7 w-7" />);
    for (let d = 1; d <= total; d++) {
      const today = isToday(d);
      const selected = isSelected(d);
      nodes.push(
        <button
          key={d}
          type="button"
          onClick={() => handleDateSelect(d)}
          className={`h-7 w-7 rounded-full text-xs font-semibold transition-all relative
            ${
              selected
                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg scale-110 hover:from-blue-600 hover:to-blue-700"
                : today
                ? "bg-blue-50 text-blue-700 ring-2 ring-blue-400 hover:bg-blue-100"
                : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
            }`}
        >
          {d}
          {selected && (
            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
          )}
        </button>
      );
    }
    return nodes;
  };

  /* ---------- styling ---------- */
  const isFloating = variant === "floating";

  const fieldClass = isFloating
    ? `border-2 rounded-lg pl-4 pr-3 py-0 w-full min-w-[150px] h-[38px] leading-none
        align-middle text-sm font-semibold text-gray-700 bg-white cursor-pointer
        shadow-sm hover:shadow-md outline-none text-left flex items-center justify-between
        transition-all duration-200 ${
          error
            ? "border-red-500 ring-2 ring-red-50 focus:ring-red-500 focus:border-red-500"
            : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 hover:border-blue-400"
        }
        ${disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""}`
    : `w-full h-10 py-1 px-4 rounded-lg bg-white border text-sm shadow-sm focus:outline-none
        transition text-left flex items-center justify-between
        ${
          error
            ? "border-red-500 ring-2 ring-red-100 focus:ring-red-200"
            : "border-gray-300 hover:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:border-2"
        }
        ${disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""}`;

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {/* floating chip label */}
      {isFloating && label && (
        <span className="absolute left-3 top-[-10px] rounded-md bg-white px-2 text-xs font-semibold text-gray-700 pointer-events-none z-10">
          {label}
        </span>
      )}

      {/* block label for default variant */}
      {!isFloating && label && (
        <label
          htmlFor={id}
          className={`block text-sm font-medium mb-1 ${
            error ? "text-red-600" : "text-gray-700"
          }`}
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
          className={fieldClass}
        >
          {/* left side: icon + value */}
          <div className="flex items-center gap-2">
            {showIcon && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            )}
            <span className={selectedDate ? "text-gray-700" : "text-gray-400"}>
              {selectedDate ? formatDate(selectedDate) : placeholder}
            </span>
          </div>

          {/* right side: clear + caret */}
          <div className="flex items-center gap-1">
            {showClear && selectedDate && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selected date"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDate("");
                  onChange?.({ target: { value: "" } });
                  buttonRef.current?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedDate("");
                    onChange?.({ target: { value: "" } });
                    buttonRef.current?.focus();
                  }
                }}
                className="p-1 hover:bg-red-50 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <svg
                  className="h-4 w-4 text-gray-400 hover:text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </span>
            )}
            <svg
              className={`h-5 w-5 transition-all ${
                isOpen ? "rotate-180 text-blue-600" : "text-gray-400"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isOpen && !disabled && (
          <div
            ref={calendarRef}
            className="absolute z-[10001] mt-2 w-full bg-white rounded-xl shadow-2xl border-2 border-blue-100 animate-popup max-h-[65vh] overflow-auto"
          >
            {/* HEADER WITH CUSTOM MONTH/YEAR DROPDOWNS */}
            <div className="bg-blue-600 p-3">
              <div className="flex items-center justify_between gap-2">
                {/* Prev month */}
                <button
                  type="button"
                  onClick={previousMonth}
                  className="p-1 hover:bg-white/20 rounded-full transition"
                  aria-label="Previous month"
                >
                  <svg
                    className="h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                {/* Center: custom month + year dropdowns */}
                <div className="flex-1 flex items-center justify-center gap-2 text-xs text-white">
                  {/* Month dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMonthOpen((o) => !o);
                        setIsYearOpen(false);
                      }}
                      className="flex items-center gap-1 bg-white text-blue-900 font-semibold
                                 rounded-lg px-2.5 py-1 shadow-sm border border-blue-200
                                 focus:outline-none focus:ring-2 focus:ring-white/70"
                    >
                      <span>{monthNames[currentMonth.getMonth()]}</span>
                      <svg
                        className={`h-3 w-3 ${
                          isMonthOpen ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {isMonthOpen && (
                      <div
                        ref={monthListRef}
                        className="absolute left-0 mt-1 w-auto max-h-56 overflow-auto rounded-lg
                                   bg-white shadow-lg border border-blue-100 z-[10002] hide-scrollbar"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {monthNames.map((m, idx) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleMonthPick(idx)}
                            data-active={idx === currentMonth.getMonth()} // NEW
                            className={`w-full text-left px-3 py-1.5 text-xs
                                       ${
                                         idx === currentMonth.getMonth()
                                           ? "bg-blue-50 text-blue-700 font-semibold"
                                           : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                                       }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Year dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsYearOpen((o) => !o);
                        setIsMonthOpen(false);
                      }}
                      className="flex items-center gap-1 bg-white text-blue-900 font-semibold
                                 rounded-lg px-2.5 py-1 shadow-sm border border-blue-200
                                 focus:outline-none focus:ring-2 focus:ring-white/70"
                    >
                      <span>{currentMonth.getFullYear()}</span>
                      <svg
                        className={`h-3 w-3 ${isYearOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {isYearOpen && (
                      <div
                        ref={yearListRef}
                        className="absolute left-0 mt-1 w-auto max-h-56 overflow-auto rounded-lg
                                   bg-white shadow-lg border border-blue-100 z-[10002] hide-scrollbar"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {yearOptions.map((y) => (
                          <button
                            key={y}
                            type="button"
                            onClick={() => handleYearPick(y)}
                            data-active={y === currentMonth.getFullYear()} // NEW
                            className={`w-full text-left px-3 py-1.5 text-xs
                                       ${
                                         y === currentMonth.getFullYear()
                                           ? "bg-blue-50 text-blue-700 font-semibold"
                                           : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                                       }`}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Next month */}
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 hover:bg_white/20 rounded-full transition"
                  aria-label="Next month"
                >
                  <svg
                    className="h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-3">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map((d, i) => (
                  <div
                    key={i}
                    className="h-7 flex items-center justify-center text-xs font-bold text-blue-600"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {renderCalendarDays()}
              </div>

              <div className="pt-2 border-t border-blue-100">
                <button
                  type="button"
                  onClick={() => {
                    const t = new Date();
                    const ds = `${t.getFullYear()}-${String(
                      t.getMonth() + 1
                    ).padStart(2, "0")}-${String(t.getDate()).padStart(
                      2,
                      "0"
                    )}`;
                    setSelectedDate(ds);
                    setCurrentMonth(t);
                    onChange?.({ target: { value: ds } });
                    setIsOpen(false);
                    setIsMonthOpen(false);
                    setIsYearOpen(false);
                  }}
                  className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-lg transition shadow-md hover:shadow-lg"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
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
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {errorMessage}
        </p>
      )}
    </div>
  );
};

export default DatePickerCustom;

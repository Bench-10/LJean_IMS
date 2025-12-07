import { useEffect, useRef, useState } from "react";

export default function DropdownCheckbox({
  label = "",
  values = [],                // array of selected values, e.g. ['Inventory Staff']
  options = [],               // [{ value, label, disabled? }]
  onChange,                   // (newValues: string[]) => void
  placeholder = "-- Select roles --",
  error = false,
  className = "",
  labelClassName = "block font-medium text-green-900 mb-2",
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const btnRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!boxRef.current || boxRef.current.contains(e.target)) return;
      if (!btnRef.current || btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      const estHeight = Math.min(240, options.length * 36 + 48); // items + footer
      setOpenUpward(spaceBelow < estHeight && spaceAbove > spaceBelow);
    }
    setOpen((v) => !v);
  };

  const selectedLabels = options
    .filter(o => values.includes(o.value))
    .map(o => o.label);

  const handleToggleValue = (val) => {
    if (!onChange) return;
    if (values.includes(val)) onChange(values.filter(v => v !== val));
    else onChange([...values, val]);
  };

  const clearAll = () => onChange?.([]);
  const selectAll = () => onChange?.(options.filter(o => !o.disabled).map(o => o.value));

  return (
    <div className={`w-full ${className}`}>
      {label ? <label className={labelClassName}>{label}</label> : null}

      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`w-full h-[36px] flex items-center justify-between px-3 text-sm bg-white border rounded-md transition-all
          ${error ? "border-red-500 ring-1 ring-red-50" : "border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"}`}
      >
        <span className="truncate">
          {selectedLabels.length ? selectedLabels.join(", ") : placeholder}
        </span>
        <svg className={`w-5 h-5 ml-2 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          ref={boxRef}
          className={`absolute z-[9999] bg-white border border-gray-200 rounded-md shadow-lg w-full max-w-[calc(100%-0px)]
            ${openUpward ? "mb-2 bottom-full" : "mt-2 top-full"} max-h-[280px]`}
        >
          <div className="max-h-60 overflow-auto hide-scrollbar py-1">
            {options.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer select-none
                  ${opt.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded accent-green-600"
                  disabled={opt.disabled}
                  checked={values.includes(opt.value)}
                  onChange={() => !opt.disabled && handleToggleValue(opt.value)}
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-between items-center px-3 py-2 border-t bg-gray-50">
            <button type="button" onClick={clearAll} className="text-xs font-medium text-gray-700 hover:text-gray-900">
              Clear
            </button>
            <button type="button" onClick={selectAll} className="text-xs font-medium text-green-700 hover:text-green-800">
              Select all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';

function ChartLoading({
  message = "Loading data...",
  type = 'chart',
  variant = 'overlay',
  colSpan = 1,
  minHeight = 144,
  className = ''
}) {
  const dotsClass = type === 'chart' ? 'space-x-2' : 'space-x-1';
  const dotSize = type === 'chart' ? 'w-3 h-3' : 'w-2 h-2';
  const textSize = type === 'chart' ? 'text-sm' : 'text-xs';

  const inner = (
    <div className="flex flex-col items-center justify-center py-6 w-full">
      <div className={`flex ${dotsClass} mt-2`}>
        <div className={`${dotSize} bg-green-600 rounded-full animate-bounce animation-delay-0`}></div>
        <div className={`${dotSize} bg-green-600 rounded-full animate-bounce animation-delay-150`}></div>
        <div className={`${dotSize} bg-green-600 rounded-full animate-bounce animation-delay-300`}></div>
      </div>
      <p className={`mt-4 ${textSize} text-gray-600 font-medium`}>{message}</p>
    </div>
  );

  if (variant === 'table-row') {
    return (
      <tr>
        <td colSpan={colSpan} className="p-0 bg-white">
          <div className="flex items-center justify-center w-full" style={{ minHeight }}>
            {inner}
          </div>
        </td>
      </tr>
    );
  }

  if (variant === 'container') {
    return (
      <div
        className={`flex flex-col items-center justify-center w-full bg-white rounded-md ${className}`}
        style={{ minHeight }}
      >
        {inner}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center h-full w-full bg-white absolute inset-0 z-10 rounded-md ${className}`}>
      {inner}
    </div>
  );
}

export default ChartLoading;

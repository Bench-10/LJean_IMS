import React from 'react';
import { MdInsights } from 'react-icons/md';

// IF THERE IS NO DATA SHOWING IN THE CHART
function ChartNoData({ message = 'No data to display', hint = 'Try reloading the page' }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-3">
          <MdInsights className="text-3xl text-gray-400" />
        </div>
        <p className="text-sm md:text-base text-gray-600 font-medium">{message}</p>
        {hint && <p className="text-[11px] md:text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
    </div>
  );
}

export default ChartNoData;

import React from 'react';

function ChartLoading({ message = "Loading data...", type='chart' }) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-white absolute inset-0 z-50 rounded-md">


      {/* BOUNCING THREE DOTS*/}
      <div className={` flex ${type === 'chart' ? 'space-x-2':'space-x-1'} mt-2`}>
        <div className={`${type === 'chart' ? 'w-3 h-3':'w-2 h-2'} bg-green-600 rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
        <div className={`${type === 'chart' ? 'w-3 h-3':'w-2 h-2'} bg-green-600 rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
        <div className={`${type === 'chart' ? 'w-3 h-3':'w-2 h-2'} bg-green-600 rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
      </div>
      
      
      {/*lOADING TEXT */}
      <p className={`mt-4 ${type === 'chart' ? 'text-sm':'text-xs'} text-gray-600 font-medium`}>
        {message}
      </p>
      
     
    </div>
  );
}

export default ChartLoading;

import React from 'react';

function FormLoading({ message = "Processing..." }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[12000] backdrop-blur-sm">
      <div className="bg-white p-8 rounded-lg shadow-xl flex flex-col items-center min-w-[300px] z-[11999]">
        
         {/*BOUNCING DOTS */}
        <div className="flex space-x-2 mt-2">
          <div className="w-3 h-3 bg-green-600 rounded-full animate-bounce animation-delay-0"></div>
          <div className="w-3 h-3 bg-green-600 rounded-full animate-bounce animation-delay-150"></div>
          <div className="w-3 h-3 bg-green-600 rounded-full animate-bounce animation-delay-300"></div>
        </div>
        
        {/*MESSAGE */}
        <p className="text-lg font-semibold text-gray-600 mt-5 text-center">
          {message}
        </p>
        
      </div>
    </div>
    
  );
}

export default FormLoading;

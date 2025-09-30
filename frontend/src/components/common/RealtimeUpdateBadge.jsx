import React, { useState, useEffect } from 'react';

function RealtimeUpdateBadge({ show, message, type = 'info' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'inventory':
        return 'bg-blue-500 border-blue-600';
      case 'validity':
        return 'bg-green-500 border-green-600';
      case 'notification':
        return 'bg-yellow-500 border-yellow-600';
      default:
        return 'bg-gray-500 border-gray-600';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'inventory':
        return '📦';
      case 'validity':
        return '📅';
      case 'notification':
        return '🔔';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className={`
      fixed top-20 right-5 
      ${getTypeStyles()} 
      text-white px-4 py-2 rounded-lg shadow-lg 
      border-l-4 z-50
      animate-slideInRight
      max-w-sm
    `}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{getIcon()}</span>
        <div>
          <div className="font-semibold text-sm">Real-time Update</div>
          <div className="text-xs opacity-90">{message}</div>
        </div>
      </div>
    </div>
  );
}

export default RealtimeUpdateBadge;
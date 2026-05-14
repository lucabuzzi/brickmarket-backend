import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const Toast = ({ toast, removeToast }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Start closing animation 300ms before it's actually removed from state
    const timer = setTimeout(() => {
      setIsClosing(true);
    }, toast.duration - 300);
    return () => clearTimeout(timer);
  }, [toast.duration]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      removeToast(toast.id);
    }, 300); // Wait for animation
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={18} className="text-emerald-400" />;
      case 'error':
        return <AlertCircle size={18} className="text-red-400" />;
      default:
        return <Info size={18} className="text-sky-400" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-emerald-500/50';
      case 'error':
        return 'border-red-500/50';
      default:
        return 'border-sky-500/50';
    }
  };

  const getShadowColor = () => {
    switch (toast.type) {
      case 'success':
        return 'shadow-emerald-500/10';
      case 'error':
        return 'shadow-red-500/10';
      default:
        return 'shadow-sky-500/10';
    }
  };

  return (
    <div
      className={`relative flex items-start gap-3 w-full max-w-sm bg-[#0f172a]/90 backdrop-blur-md border ${getBorderColor()} rounded-xl p-4 mb-3 shadow-lg ${getShadowColor()} pointer-events-auto transition-all duration-300 ease-in-out origin-bottom ${
        isClosing ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100 scale-100 translate-x-0'
      }`}
      style={{
        animation: !isClosing ? 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
      }}
    >
      <div className="shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={handleClose}
        className="shrink-0 text-slate-400 hover:text-white transition-colors p-1 -mr-2 -mt-2 rounded-lg hover:bg-slate-800/50"
      >
        <X size={16} />
      </button>

      {/* Subtle background glow */}
      <div className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl pointer-events-none ${toast.type === 'error' ? 'bg-red-500/10' : toast.type === 'success' ? 'bg-emerald-500/10' : 'bg-sky-500/10'}`}></div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(1rem) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default function ToastContainer({ toasts, removeToast }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end pointer-events-none sm:bottom-6 sm:right-6">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
}

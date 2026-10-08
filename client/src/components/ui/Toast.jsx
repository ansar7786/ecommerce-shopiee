/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({
      message,
      type = 'info',
      duration = 4000,
      action = null, // { label: string, onClick: () => void }
    }) => {
      const id = Date.now() + Math.random().toString(36).substring(2, 9);
      const newToast = { id, message, type, action };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastItem = ({ toast, onDismiss }) => {
  const { type, message, action } = toast;

  const typeConfig = {
    success: {
      icon: CheckCircle2,
      style: 'bg-emerald-900 text-white',
      iconStyle: 'text-emerald-300',
    },
    error: {
      icon: AlertCircle,
      style: 'bg-danger-700 text-white',
      iconStyle: 'text-red-200',
    },
    info: {
      icon: Info,
      style: 'bg-ink-900 text-white',
      iconStyle: 'text-info-50',
    },
  };

  const current = typeConfig[type] || typeConfig.info;
  const Icon = current.icon;

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-center justify-between gap-3 w-full p-4 rounded-xl shadow-lg border border-white/10 ${current.style} transition-all animate-in fade-in slide-in-from-bottom-2`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <Icon className={`w-5 h-5 flex-shrink-0 ${current.iconStyle}`} />
        <p className="text-sm font-medium leading-snug break-words">{message}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {action && (
          <button
            type="button"
            onClick={() => {
              action.onClick?.();
              onDismiss();
            }}
            className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            {action.label || 'Retry'}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss toast"
          className="p-1 hover:bg-white/10 rounded-md transition-colors"
        >
          <X className="w-4 h-4 opacity-75 hover:opacity-100" />
        </button>
      </div>
    </div>
  );
};

export const Toast = ToastItem;

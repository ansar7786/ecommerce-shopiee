import { useEffect } from 'react';
import { X } from 'lucide-react';

export const BottomSheet = ({ isOpen, onClose, title, children, className = '' }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal / Sheet Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full bg-white rounded-t-2xl md:rounded-card shadow-2xl p-6 max-h-[90vh] overflow-y-auto md:max-w-lg md:m-4 transform transition-transform duration-300 ease-out animate-in fade-in slide-in-from-bottom-6 md:slide-in-from-bottom-2 ${className}`}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-ink-300 rounded-full mx-auto mb-4 md:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-ink-300/40">
          {title ? <h3 className="text-lg font-bold text-ink-900">{title}</h3> : <div />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full text-ink-600 hover:text-ink-900 hover:bg-page transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div>{children}</div>
      </div>
    </div>
  );
};

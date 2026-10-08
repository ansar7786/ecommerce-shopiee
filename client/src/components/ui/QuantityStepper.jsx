import { Minus, Plus } from 'lucide-react';

export const QuantityStepper = ({
  value = 0,
  onChange,
  min = 0,
  max = 10,
  disabled = false,
  className = '',
}) => {
  const handleDecrement = () => {
    if (!disabled && value > min) {
      onChange?.(value - 1);
    }
  };

  const handleIncrement = () => {
    if (!disabled && value < max) {
      onChange?.(value + 1);
    }
  };

  return (
    <div
      className={`inline-flex items-center justify-between bg-white border border-ink-300 rounded-xl overflow-hidden shadow-sm select-none ${className}`}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={handleDecrement}
        aria-label="Decrease quantity"
        className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center text-ink-900 hover:bg-page active:bg-ink-300/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:bg-primary-50"
      >
        <Minus className="w-5 h-5" />
      </button>

      <span className="w-10 text-center font-semibold text-base text-ink-900 tabular-nums">
        {value}
      </span>

      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={handleIncrement}
        aria-label="Increase quantity"
        className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center text-ink-900 hover:bg-page active:bg-ink-300/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:bg-primary-50"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
};

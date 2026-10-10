import PropTypes from 'prop-types';
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
      className={`w-[108px] h-[44px] inline-flex items-center justify-between bg-white border border-ink-300 rounded-xl overflow-hidden shadow-xs select-none shrink-0 ${className}`}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={handleDecrement}
        aria-label="Decrease quantity"
        className="w-9 h-[44px] min-w-[36px] max-w-[36px] flex items-center justify-center text-ink-900 hover:bg-page active:bg-ink-300/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:bg-primary-50 shrink-0"
      >
        <Minus className="w-4 h-4" />
      </button>

      <span className="flex-1 text-center font-bold text-sm text-ink-900 tabular-nums">
        {value}
      </span>

      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={handleIncrement}
        aria-label="Increase quantity"
        className="w-9 h-[44px] min-w-[36px] max-w-[36px] flex items-center justify-center text-ink-900 hover:bg-page active:bg-ink-300/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:bg-primary-50 shrink-0"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};

QuantityStepper.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func,
  min: PropTypes.number,
  max: PropTypes.number,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

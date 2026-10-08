export const Chip = ({
  children,
  selected = false,
  onClick,
  className = '',
  disabled = false,
  ...props
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-medium transition-all select-none border min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed ${
        selected
          ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
          : 'bg-white text-ink-900 border-ink-300 hover:bg-primary-50 hover:border-primary-600'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

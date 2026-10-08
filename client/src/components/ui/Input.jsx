export const Input = ({
  label,
  error,
  id,
  type = 'text',
  className = '',
  wrapperClassName = '',
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`w-full flex flex-col gap-1.5 ${wrapperClassName}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {LeftIcon && (
          <div className="absolute left-3.5 pointer-events-none text-ink-600">
            <LeftIcon className="w-5 h-5" />
          </div>
        )}
        <input
          id={inputId}
          type={type}
          className={`w-full h-12 min-h-[48px] px-3.5 bg-white text-ink-900 placeholder:text-ink-300 rounded-xl border transition-colors outline-none text-base ${
            LeftIcon ? 'pl-11' : ''
          } ${RightIcon ? 'pr-11' : ''} ${
            error
              ? 'border-danger-600 focus:border-danger-600 focus:ring-2 focus:ring-danger-600/20'
              : 'border-ink-300 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20'
          } ${className}`}
          {...props}
        />
        {RightIcon && (
          <div className="absolute right-3.5 pointer-events-none text-ink-600">
            <RightIcon className="w-5 h-5" />
          </div>
        )}
      </div>
      {error && <p className="text-xs font-medium text-danger-600 mt-0.5">{error}</p>}
    </div>
  );
};

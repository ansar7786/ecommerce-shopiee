import PropTypes from 'prop-types';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-colors select-none focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    md: 'h-12 min-h-[48px] px-4 text-base gap-2',
    lg: 'h-14 min-h-[56px] px-6 text-lg gap-3',
  };

  const variantStyles = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-600 shadow-sm',
    secondary:
      'bg-white text-ink-900 border border-ink-300 hover:bg-page focus:ring-primary-600 shadow-sm',
    danger: 'bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-600 shadow-sm',
    ghost: 'bg-transparent text-ink-600 hover:bg-ink-300/20 hover:text-ink-900 focus:ring-ink-300',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.primary} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {LeftIcon && <LeftIcon className="w-5 h-5 flex-shrink-0" />}
          <span>{children}</span>
          {RightIcon && <RightIcon className="w-5 h-5 flex-shrink-0" />}
        </>
      )}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost']),
  size: PropTypes.oneOf(['md', 'lg']),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  type: PropTypes.string,
  leftIcon: PropTypes.elementType,
  rightIcon: PropTypes.elementType,
};

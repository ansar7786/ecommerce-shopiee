const variantStyles = {
  placed: 'bg-amber-50 text-amber-800 border-amber-200',
  accepted: 'bg-blue-50 text-blue-800 border-blue-200',
  packing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  ready: 'bg-teal-50 text-teal-800 border-teal-200',
  out: 'bg-sky-50 text-sky-800 border-sky-200',
  out_for_delivery: 'bg-sky-50 text-sky-800 border-sky-200',
  delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-50 text-red-800 border-red-200',
  cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
  expired: 'bg-gray-100 text-gray-700 border-gray-300',
  delivery_failed: 'bg-red-50 text-red-800 border-red-200',
  awaiting_customer: 'bg-orange-50 text-orange-800 border-orange-200',
  default: 'bg-gray-50 text-gray-700 border-gray-200',
};

export const Badge = ({ children, variant, status, className = '', ...props }) => {
  const key = (status || variant || 'default').toLowerCase();
  const style = variantStyles[key] || variantStyles.default;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border select-none tracking-wide ${style} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export const EmptyState = ({ icon: Icon, title, text, action, className = '' }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 rounded-card bg-white border border-dashed border-ink-300/80 my-4 ${className}`}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7" />
        </div>
      )}
      {title && <h3 className="text-lg font-semibold text-ink-900 mb-1">{title}</h3>}
      {text && <p className="text-sm text-ink-600 max-w-xs mb-6">{text}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

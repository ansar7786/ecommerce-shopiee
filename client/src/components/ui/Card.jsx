export const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white rounded-card border border-ink-300/60 shadow-sm p-4 sm:p-5 transition-shadow ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

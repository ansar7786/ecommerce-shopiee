export const Skeleton = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse bg-ink-300/30 rounded-lg ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
};

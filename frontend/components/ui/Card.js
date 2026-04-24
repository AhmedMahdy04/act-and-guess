export default function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-base-900/80 shadow-card backdrop-blur-sm transition-shadow duration-200 ${hover ? 'hover:shadow-card-hover' : ''} ${className}`}
    >
      {children}
    </div>
  );
}


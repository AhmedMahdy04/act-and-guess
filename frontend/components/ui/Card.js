export default function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}


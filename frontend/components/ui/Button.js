export default function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-xl font-black shadow-xl transition-all duration-200 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/60';

  const variants = {
    primary:
      'bg-gradient-to-r from-primary to-blue-600 hover:brightness-110 hover:-translate-y-0.5 text-white',
    secondary:
      'bg-white/10 border border-white/20 hover:bg-white/15 hover:-translate-y-0.5 text-white',
    danger:
      'bg-gradient-to-r from-red-500 to-red-600 hover:brightness-110 hover:-translate-y-0.5 text-white',
    ghost:
      'bg-transparent border border-white/20 hover:bg-white/10 hover:-translate-y-0.5 text-white',
  };

  return (
    <button
      type={props.type || 'button'}
      {...props}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
    >
      {children}
    </button>
  );
}


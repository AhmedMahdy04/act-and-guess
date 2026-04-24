export default function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'default',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-base-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 active:translate-y-px';

  const sizes = {
    sm: 'px-4 py-2.5 text-sm',
    default: 'px-6 py-3.5 text-base',
    lg: 'px-8 py-4 text-lg',
    xl: 'px-10 py-5 text-xl',
  };

  const variants = {
    primary:
      'bg-primary hover:bg-indigo-500 text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5',
    secondary:
      'bg-base-800 hover:bg-base-700 text-slate-200 border border-white/[0.08] hover:border-white/[0.12] hover:-translate-y-0.5',
    ghost:
      'bg-transparent hover:bg-white/[0.04] text-slate-300 border border-white/[0.06] hover:border-white/[0.1]',
    danger:
      'bg-accent-rose hover:bg-rose-500 text-white shadow-lg shadow-accent-rose/20 hover:shadow-accent-rose/30 hover:-translate-y-0.5',
    success:
      'bg-accent-emerald hover:bg-emerald-500 text-white shadow-lg shadow-accent-emerald/20 hover:shadow-accent-emerald/30 hover:-translate-y-0.5',
  };

  return (
    <button
      type={props.type || 'button'}
      {...props}
      className={`${base} ${sizes[size] || sizes.default} ${variants[variant] || variants.primary} ${className}`}
    >
      {children}
    </button>
  );
}


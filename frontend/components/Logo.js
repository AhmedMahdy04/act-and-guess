'use client';

export default function Logo({ size = 'md', showText = true, className = '' }) {
  const sizeMap = {
    sm: { icon: 28, text: 'text-xl' },
    md: { icon: 36, text: 'text-2xl' },
    lg: { icon: 48, text: 'text-3xl' },
    xl: { icon: 64, text: 'text-4xl' },
  };

  const { icon, text } = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Theater masks icon */}
        <rect width="48" height="48" rx="12" fill="#6366F1" fillOpacity="0.15" />
        <rect x="1" y="1" width="46" height="46" rx="11" stroke="#6366F1" strokeOpacity="0.3" strokeWidth="1" />
        
        {/* Comedy mask */}
        <ellipse cx="17" cy="20" rx="7" ry="8" fill="#6366F1" fillOpacity="0.9" />
        <circle cx="14.5" cy="18" r="1.2" fill="#0B0D17" />
        <circle cx="19.5" cy="18" r="1.2" fill="#0B0D17" />
        <path d="M13 23.5Q17 27 21 23.5" stroke="#0B0D17" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        
        {/* Tragedy mask */}
        <ellipse cx="31" cy="20" rx="7" ry="8" fill="#F43F5E" fillOpacity="0.9" />
        <circle cx="28.5" cy="18" r="1.2" fill="#0B0D17" />
        <circle cx="33.5" cy="18" r="1.2" fill="#0B0D17" />
        <path d="M27 25.5Q31 22 35 25.5" stroke="#0B0D17" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        
        {/* Sparkle */}
        <path d="M24 8L24.5 10.5L27 11L24.5 11.5L24 14L23.5 11.5L21 11L23.5 10.5Z" fill="#F59E0B" />
      </svg>

      {showText && (
        <span className={`font-black tracking-tight ${text}`}>
          <span className="text-slate-100">Act</span>
          <span className="text-primary"> &amp; </span>
          <span className="text-slate-100">Guess</span>
        </span>
      )}
    </div>
  );
}


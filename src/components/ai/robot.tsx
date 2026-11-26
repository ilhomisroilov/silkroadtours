/** Friendly assistant illustration (pure SVG, no external assets). */
export function RobotIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 170" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="rb-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe8f6" />
        </linearGradient>
        <linearGradient id="rb-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d3557" />
          <stop offset="1" stopColor="#0b1f36" />
        </linearGradient>
        <radialGradient id="rb-eye">
          <stop offset="0" stopColor="#bff6ff" />
          <stop offset="0.6" stopColor="#3fd3f5" />
          <stop offset="1" stopColor="#1a9fd0" />
        </radialGradient>
      </defs>
      {/* antenna */}
      <line x1="80" y1="14" x2="80" y2="30" stroke="#9db3d4" strokeWidth="4" strokeLinecap="round" />
      <circle cx="80" cy="11" r="6" fill="#245ba8" />
      {/* ears */}
      <rect x="28" y="50" width="14" height="30" rx="7" fill="#245ba8" />
      <rect x="118" y="50" width="14" height="30" rx="7" fill="#245ba8" />
      {/* head */}
      <rect x="36" y="28" width="88" height="72" rx="30" fill="url(#rb-body)" stroke="#c9d6ea" strokeWidth="2" />
      <rect x="48" y="44" width="64" height="40" rx="18" fill="url(#rb-visor)" />
      <ellipse cx="66" cy="63" rx="8" ry="9" fill="url(#rb-eye)" />
      <ellipse cx="94" cy="63" rx="8" ry="9" fill="url(#rb-eye)" />
      <path d="M71 75 Q80 81 89 75" fill="none" stroke="#3fd3f5" strokeWidth="3" strokeLinecap="round" />
      {/* body */}
      <path d="M50 108 Q80 98 110 108 L106 150 Q80 160 54 150 Z" fill="url(#rb-body)" stroke="#c9d6ea" strokeWidth="2" />
      <circle cx="80" cy="126" r="9" fill="#eaf1fb" stroke="#245ba8" strokeWidth="3" />
      <circle cx="80" cy="126" r="3.5" fill="#3fd3f5" />
      {/* arms: left resting, right waving */}
      <path d="M52 114 Q36 126 40 146" fill="none" stroke="#dfe8f6" strokeWidth="12" strokeLinecap="round" />
      <path d="M108 112 Q126 100 134 80" fill="none" stroke="#dfe8f6" strokeWidth="12" strokeLinecap="round" />
      <circle cx="136" cy="74" r="9" fill="#245ba8" />
      <circle cx="40" cy="149" r="8" fill="#245ba8" />
    </svg>
  );
}

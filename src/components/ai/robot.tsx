/**
 * AI mark: a calm "AI" monogram in a lit ring (concept v2). The spec asks for AI as a utility,
 * not a robot mascot, so this replaces the earlier robot drawing everywhere it was used.
 */
export function RobotIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="ai-core" cx="50%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#2b8cf0" />
          <stop offset="70%" stopColor="#176bcb" />
          <stop offset="100%" stopColor="#0d304f" />
        </radialGradient>
        <linearGradient id="ai-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7fd8ff" />
          <stop offset="55%" stopColor="#15c3d2" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#176bcb" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="url(#ai-ring)" strokeWidth="3" />
      <circle cx="60" cy="60" r="46" fill="url(#ai-core)" />
      <circle cx="60" cy="60" r="46" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.5" />
      <text x="60" y="71" textAnchor="middle" fontFamily="Manrope, ui-sans-serif, system-ui, sans-serif" fontSize="32" fontWeight="700" fill="#ffffff" letterSpacing="1">
        AI
      </text>
    </svg>
  );
}

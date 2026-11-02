/** Illustration du bandeau de titre : sphères jaune d'or et brume, tracés fins. Purement décorative. */
export function HeroArt() {
  return (
    <svg viewBox="0 0 360 180" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <radialGradient id="hero-gold" cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--art-mist)" />
        </radialGradient>
        <radialGradient id="hero-mist" cx="65%" cy="40%" r="80%">
          <stop offset="0%" stopColor="var(--art-mist)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </radialGradient>
      </defs>
      <rect width="360" height="180" fill="var(--sand)" />
      <circle cx="110" cy="130" r="72" fill="url(#hero-gold)" />
      <circle cx="205" cy="92" r="64" fill="url(#hero-mist)" opacity="0.9" />
      <circle cx="290" cy="58" r="82" fill="url(#hero-gold)" opacity="0.92" />
      <g fill="none" stroke="var(--accent-soft)" strokeWidth="1.25">
        <circle cx="110" cy="130" r="72" />
        <circle cx="205" cy="92" r="64" strokeDasharray="3 4" />
        <circle cx="290" cy="58" r="82" />
        <path d="M24 42 C 90 20, 160 60, 205 38 S 300 8, 348 26" />
      </g>
      <g fill="var(--accent-soft)">
        <circle cx="24" cy="42" r="2.5" />
        <circle cx="205" cy="38" r="2.5" />
        <circle cx="348" cy="26" r="2.5" />
      </g>
    </svg>
  );
}

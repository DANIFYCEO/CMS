export default function CMSLogo({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { width: 80, height: 40 },
    md: { width: 120, height: 60 },
    lg: { width: 200, height: 100 },
  };

  const { width, height } = sizes[size];

  return (
    <svg
      viewBox="0 0 240 120"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Film Reel Circle around C */}
      <circle cx="48" cy="42" r="30" fill="none" stroke="white" strokeWidth="3" />
      {/* Film reel sprocket holes */}
      <circle cx="48" cy="14" r="4" fill="white" />
      <circle cx="48" cy="70" r="4" fill="white" />
      <circle cx="20" cy="42" r="4" fill="white" />
      <circle cx="76" cy="42" r="4" fill="white" />
      <circle cx="28" cy="22" r="3.5" fill="white" />
      <circle cx="68" cy="22" r="3.5" fill="white" />
      <circle cx="28" cy="62" r="3.5" fill="white" />
      <circle cx="68" cy="62" r="3.5" fill="white" />
      {/* Inner circle of film reel */}
      <circle cx="48" cy="42" r="12" fill="none" stroke="white" strokeWidth="2" />
      {/* C letter */}
      <text x="32" y="54" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="38" fill="white">C</text>

      {/* M letter - yellow/gold */}
      <text x="80" y="62" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="58" fill="#FFB400">M</text>

      {/* S letter - white */}
      <text x="150" y="62" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="58" fill="white">S</text>

      {/* Horizontal lines flanking CAMPUS */}
      <line x1="30" y1="76" x2="68" y2="76" stroke="#FFB400" strokeWidth="1.5" />
      <line x1="172" y1="76" x2="210" y2="76" stroke="#FFB400" strokeWidth="1.5" />

      {/* CAMPUS text */}
      <text x="120" y="82" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="16" fill="white" textAnchor="middle" letterSpacing="6">CAMPUS</text>

      {/* MOVIE SERIES text */}
      <text x="120" y="100" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="16" fill="#FFB400" textAnchor="middle" letterSpacing="4">MOVIE SERIES</text>
    </svg>
  );
}

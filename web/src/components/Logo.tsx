interface Props {
  size?: number
  className?: string
}

/** KB Liquors monogram — a charcoal tile with a gold "KB" wordmark and a foil
 *  bar, mirroring the shop's black-and-gold signage. Self-contained, crisp. */
export function Logo({ size = 32, className }: Props) {
  const bg = 'kb-logo-bg'
  const fg = 'kb-logo-fg'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="KB Liquors"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#241f14" />
          <stop offset="1" stopColor="#14110a" />
        </linearGradient>
        <linearGradient id={fg} x1="24" y1="8" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0dca0" />
          <stop offset="0.55" stopColor="#d8b854" />
          <stop offset="1" stopColor="#b9932f" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${bg})`} stroke="#c9a227" strokeWidth="1.5" />
      <text
        x="24"
        y="27.5"
        textAnchor="middle"
        fontFamily="'Sora Variable', system-ui, sans-serif"
        fontSize="18"
        fontWeight="800"
        letterSpacing="-0.5"
        fill={`url(#${fg})`}
      >
        KB
      </text>
      <rect x="14.5" y="33.5" width="19" height="2.4" rx="1.2" fill="#c9a227" opacity="0.9" />
    </svg>
  )
}

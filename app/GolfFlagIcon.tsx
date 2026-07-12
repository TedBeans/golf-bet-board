export default function GolfFlagIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ verticalAlign: "-4px", marginRight: 8, flexShrink: 0 }}
      aria-hidden="true"
    >
      <line x1="6" y1="2" x2="6" y2="21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 3 L18 6.5 L6 10 Z" fill="currentColor" />
      <ellipse cx="6" cy="21" rx="5" ry="1.3" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

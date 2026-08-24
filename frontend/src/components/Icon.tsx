/**
 * Small inline-SVG icon set drawn in the Material Symbols Outlined style
 * (24px viewbox, ~2px stroke, rounded joins) since we don't have the
 * project's exact icon export files — swap these for the real assets
 * whenever they're available.
 */
type IconProps = { size?: number; className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ChevronDownIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function RefreshIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 4v5h5" />
      <path d="M20 20v-5h-5" />
      <path d="M5.5 9a7 7 0 0 1 12.3-2.5L20 9" />
      <path d="M18.5 15a7 7 0 0 1-12.3 2.5L4 15" />
    </svg>
  );
}

export function SearchIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

export function CloseIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ArrowBackIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function CalendarIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9.5 7H7L7 9.5H9.5L9.5 7Z" fill="currentColor" />
      <path d="M13.25 7H10.75L10.75 9.5H13.25L13.25 7Z" fill="currentColor" />
      <path d="M17 7H14.5L14.5 9.5L17 9.5L17 7Z" fill="currentColor" />
      <path d="M9.5 10.75H7L7 13.25H9.5L9.5 10.75Z" fill="currentColor" />
      <path d="M13.25 10.75H10.75L10.75 13.25H13.25L13.25 10.75Z" fill="currentColor" />
      <path d="M17 10.75L14.5 10.75L14.5 13.25H17L17 10.75Z" fill="currentColor" />
      <path d="M9.5 14.5H7L7 17H9.5L9.5 14.5Z" fill="currentColor" />
      <path d="M13.25 14.5H10.75L10.75 17H13.25L13.25 14.5Z" fill="currentColor" />
    </svg>
  );
}

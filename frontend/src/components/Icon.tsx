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

export function HelpIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.3a2.5 2.5 0 1 1 3.6 2.25c-.75.4-1.1.9-1.1 1.7v.35" />
      <circle cx="12" cy="16.7" r="0.15" fill="currentColor" />
    </svg>
  );
}

export function BellIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 10.5a6 6 0 1 1 12 0c0 4 1.3 5.3 1.3 5.3H4.7S6 14.5 6 10.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function UserIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5 19.5c1.2-3.3 4-5 7-5s5.8 1.7 7 5" />
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
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

export function BurgerIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

export function PlaneIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M20.1744 18.3919C20.6187 18.3919 20.979 18.752 20.9791 19.1959C20.9791 19.64 20.6188 20 20.1744 20H4.07929C3.63484 20 3.27454 19.64 3.27454 19.1959C3.27468 18.752 3.63493 18.3919 4.07929 18.3919H20.1744ZM8.1586 5.0109C8.6023 5.05337 9.02554 5.2182 9.38145 5.48621L12.6162 7.89837L12.6225 7.90256C12.7418 7.99326 12.884 8.04959 13.0332 8.06379C13.1825 8.07798 13.3327 8.04972 13.467 7.98317L13.4702 7.98213L16.8349 6.329L17.0675 6.22536C17.5403 6.03996 18.0555 5.98896 18.5554 6.07878L18.8048 6.13532L18.8122 6.13741L19.5928 6.3625C19.8666 6.43953 20.1188 6.57622 20.3336 6.76244C20.5504 6.95034 20.7227 7.18447 20.8377 7.44714C20.9526 7.70983 21.0081 7.99499 20.999 8.28155C20.99 8.56467 20.9169 8.84156 20.7884 9.09398L20.7895 9.09503L20.4835 9.70644C20.2229 10.227 19.8028 10.659 19.269 10.9314L19.2606 10.9356L8.92773 16.0572C8.75664 16.1419 8.57627 16.2058 8.39227 16.2478V16.4498L5.55467 15.9693L5.15125 15.9002L3 11.6004L4.60427 10.7984C4.94073 10.6294 5.31219 10.5419 5.6888 10.5419C6.01908 10.5419 6.34538 10.6091 6.64759 10.7398L6.77543 10.7995L6.79848 10.811L6.82153 10.8246L6.92527 10.8853C7.03419 10.9377 7.15318 10.9659 7.27421 10.9659C7.39998 10.9659 7.52445 10.9366 7.63677 10.8801L7.6462 10.8748L7.82328 10.7879L5.41426 5.97199L6.13414 5.61185L6.8624 5.24856C7.26398 5.05117 7.71309 4.9683 8.1586 5.0109ZM8.00456 6.61168C7.85783 6.59773 7.70964 6.62393 7.57704 6.6881L7.57285 6.69125L9.9913 11.5229L9.2599 11.8789L8.35979 12.3154C8.02292 12.485 7.65139 12.574 7.27421 12.574C6.89688 12.574 6.52455 12.4861 6.18758 12.3165L6.14147 12.2913L6.03669 12.2296C5.92807 12.1775 5.80942 12.15 5.6888 12.15C5.56302 12.15 5.43857 12.1793 5.32624 12.2359L5.32415 12.2369L5.15858 12.3186L6.2253 14.4512L6.78276 14.5454V14.5308L7.72164 14.6889C7.88861 14.717 8.06027 14.6916 8.21204 14.6166L18.5366 9.4981C18.759 9.38459 18.9341 9.20608 19.0437 8.98719L19.3539 8.3674L19.3801 8.3004C19.386 8.27757 19.3888 8.25396 19.3895 8.23025C19.391 8.18252 19.3825 8.13477 19.3633 8.09101C19.3442 8.04731 19.3156 8.00817 19.2795 7.97689C19.2435 7.94566 19.2007 7.9227 19.1548 7.90989L19.1464 7.90779L18.3731 7.6848C18.1012 7.60946 17.8109 7.63852 17.5589 7.76541L17.5516 7.76855L14.1817 9.42272C13.7787 9.62242 13.328 9.70718 12.8802 9.66457C12.4347 9.6221 12.0101 9.45588 11.6532 9.18611L8.41847 6.775L8.41428 6.77186C8.29533 6.6819 8.15307 6.62588 8.00456 6.61168Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function FolderIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18Z" />
    </svg>
  );
}

export function SettingsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H4.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1.04-1.56V4.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10a1.7 1.7 0 0 0 1.56 1.04h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z" />
    </svg>
  );
}

export function DeviceIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M9 6.5h6" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}

/** Bassinet glyph — flags an infant travelling with a passenger (nested table row). */
export function InfantIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M3 14h18" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
      <path d="M12 6v3" />
      <circle cx="12" cy="4.3" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ArrowNestedIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 4v9a3 3 0 0 0 3 3h9" />
      <path d="M14 12l4 4-4 4" />
    </svg>
  );
}

/** Small stick figure — flags a child passenger (has a guardian on the same PNR, but keeps their own seat/row, unlike an infant). */
export function ChildIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="5" r="2.2" fill="currentColor" stroke="none" />
      <path d="M12 8.5v6" />
      <path d="M8.5 11.5c1-.9 2.2-1.3 3.5-1.3s2.5.4 3.5 1.3" />
      <path d="M12 14.5l-2.8 5" />
      <path d="M12 14.5l2.8 5" />
    </svg>
  );
}

/** Filled child glyph from the Figma "Seat H" component's Child-state icon — used only for the seat-map cell, not the stroke-style ChildIcon above. Age renders as text underneath it (see .seat-child-age). */
export function SeatChildIcon({ size = 8, className }: IconProps) {
  return (
    <svg width={size} height={(size * 7) / 8} viewBox="0 0 8 7" fill="none" className={className}>
      <path
        d="M6 4.7998C7.105 4.7998 8 5.51639 8 6.40039V7H6.66699V6.40039H1.33301V7H0L2.62098e-08 6.40039C6.48507e-08 5.51639 0.895 4.7998 2 4.7998H6Z"
        fill="currentColor"
      />
      <path
        d="M4 0C4.55245 2.41484e-08 5.08197 0.21097 5.47266 0.585938C5.86336 0.96101 6.08301 1.46957 6.08301 2C6.08301 2.26264 6.0295 2.52297 5.9248 2.76562C5.82011 3.0082 5.66606 3.2284 5.47266 3.41406C5.27924 3.5997 5.04956 3.74718 4.79688 3.84766C4.5442 3.94809 4.27348 4 4 4C3.44755 4 2.91803 3.78903 2.52734 3.41406C2.13664 3.03899 1.91699 2.53043 1.91699 2C1.91699 1.46957 2.13664 0.96101 2.52734 0.585937C2.91803 0.21097 3.44755 6.1547e-09 4 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MoreIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

// ---- Seat-map attribute icons (SeatMapPanel's editor + overlay layers) ----

export function NoReclineIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M8 20V9a3 3 0 0 1 3-3h1" />
      <path d="M8 20h9" />
      <path d="M15 20v-6h3" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export function CgBlockIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </svg>
  );
}

export function BrokenIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M13 3L6 13h5l-1 8 7-10h-5l1-8z" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export function CrewIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v3a2 2 0 0 0 2 2h1v-6H5a1 1 0 0 0-1 1z" />
      <path d="M20 13v3a2 2 0 0 1-2 2h-1v-6h2a1 1 0 0 1 1 1z" />
      <path d="M12 18v2" />
    </svg>
  );
}

export function StretcherIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="8" width="18" height="8" rx="1.5" />
      <path d="M12 8v8M3 12h18" />
    </svg>
  );
}

export function WheelchairIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="10" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <path d="M10 8v5l4 3" />
      <path d="M10 11h5" />
      <path d="M9 13a5 5 0 1 0 6 6" />
      <path d="M14 16h4" />
    </svg>
  );
}

export function AnimalIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="7" cy="9" r="1.6" />
      <circle cx="12" cy="6.5" r="1.6" />
      <circle cx="17" cy="9" r="1.6" />
      <circle cx="9.5" cy="13" r="1.6" />
      <path d="M12 20c-2.5 0-4.5-1.6-4.5-3.6 0-1.7 1.6-2.9 3-3.9.5-.4 1-.7 1.5-.7s1 .3 1.5.7c1.4 1 3 2.2 3 3.9 0 2-2 3.6-4.5 3.6z" />
    </svg>
  );
}

export function TransitIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 10l4 4 4-4" />
    </svg>
  );
}

export function FixedArmrestIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="10" width="18" height="5" rx="1.5" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export function LegroomIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M20 12H6" />
      <path d="M10 7l-5 5 5 5" />
    </svg>
  );
}

export function PencilIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z" />
      <path d="M13 7l4 4" />
    </svg>
  );
}

export function LayersIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 17l9 5 9-5" />
    </svg>
  );
}

export function RowsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <rect x="3" y="16" width="18" height="4" rx="1" />
    </svg>
  );
}

export function ExpandIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M9 4H4v5" />
      <path d="M15 4h5v5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </svg>
  );
}

export function HideIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M5 12h14" />
      <path d="M14 6l6 6-6 6" />
    </svg>
  );
}

export function MinusIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function PlusIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

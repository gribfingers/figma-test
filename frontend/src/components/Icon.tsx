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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7.66846 5L8.93636 6.55556H16.25C16.6862 6.55556 17.0417 6.904 17.0417 7.33333V14.3333H14.6667L17.8333 18.2222L21 14.3333H18.625V7.33333C18.625 6.04689 17.5594 5 16.25 5H7.66846ZM5.16667 5.77778L2 9.66667H4.375V16.6667C4.375 17.9531 5.44058 19 6.75 19H15.3315L14.0636 17.4444H6.75C6.31379 17.4444 5.95833 17.096 5.95833 16.6667V9.66667H8.33333L5.16667 5.77778Z"
        fill="currentColor"
      />
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

/** Rattle glyph — flags an infant travelling with a passenger (nested table row). */
export function InfantIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M17 2C14.2505 2 12 4.25048 12 7C12 7.21307 12.0492 7.39036 12.0762 7.58594L10.8066 8.89258L8.20703 6.29297C8.11233 6.19823 7.99957 6.12348 7.87543 6.07315C7.75129 6.02282 7.61831 5.99795 7.48438 6C7.2246 6.00414 6.97663 6.10921 6.79297 6.29297L5.29297 7.79297C5.14455 7.94136 5.04658 8.13269 5.01292 8.33986C4.97927 8.54702 5.01165 8.75952 5.10547 8.94727L6.64062 12.0176C4.05754 12.2039 2 14.3716 2 17C2 19.7495 4.25048 22 7 22C9.62837 22 11.7961 19.9425 11.9824 17.3594L15.0527 18.8945C15.2405 18.9883 15.453 19.0207 15.6601 18.9871C15.8673 18.9534 16.0586 18.8555 16.207 18.707L17.707 17.207C17.8945 17.0195 17.9998 16.7652 17.9998 16.5C17.9998 16.2348 17.8945 15.9805 17.707 15.793L15.0664 13.1523L16.3066 11.8984C16.5365 11.9367 16.7436 12 17 12C19.7495 12 22 9.74952 22 7C22 4.25048 19.7495 2 17 2ZM17 4C18.6685 4 20 5.33152 20 7C20 8.66848 18.6685 10 17 10C16.7516 10 16.4937 9.95497 16.207 9.87695C16.0362 9.83063 15.8562 9.83044 15.6853 9.87642C15.5145 9.9224 15.3589 10.0129 15.2344 10.1387L13.6523 11.7383L12.2227 10.3086L13.8418 8.63867C13.9593 8.51744 14.0442 8.36843 14.0886 8.20553C14.133 8.04262 14.1355 7.87113 14.0957 7.70703C14.0344 7.45523 14 7.22506 14 7C14 5.33152 15.3315 4 17 4ZM7.5 8.41406L15.5859 16.5L15.3027 16.7832L11.9473 15.1055C11.8209 15.0425 11.6827 15.007 11.5416 15.0013C11.4006 14.9955 11.2599 15.0197 11.1289 15.0723L9.24023 15.8262L8.17383 14.7598L8.92773 12.8711C8.98027 12.7401 9.00447 12.5994 8.99875 12.4584C8.99303 12.3173 8.95751 12.1791 8.89453 12.0527L7.2168 8.69727L7.5 8.41406ZM6.28516 14.0938L6.07227 14.6289C5.99959 14.8105 5.98177 15.0094 6.02099 15.2011C6.06022 15.3927 6.15478 15.5686 6.29297 15.707L8.29297 17.707C8.4314 17.8452 8.60732 17.9398 8.79895 17.979C8.99057 18.0182 9.1895 18.0004 9.37109 17.9277L9.90625 17.7148C9.5877 19.031 8.42022 20 7 20C5.33152 20 4 18.6685 4 17C4 15.5798 4.96904 14.4123 6.28516 14.0938Z"
        fill="currentColor"
      />
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

/** Coffee cup — marks a galley block on the seat map. */
export function GalleyIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 6c0-.8.4-1.2.6-1.7.2-.4.2-.9 0-1.3" />
      <path d="M11.5 6c0-.8.4-1.2.6-1.7.2-.4.2-.9 0-1.3" />
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

/** Chat bubble — opens the messenger panel. */
export function ChatIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  );
}

/** Camera — screen-capture tool in the messenger composer. */
export function CameraIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 8h3l2-2h6l2 2h3v11H4V8z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  );
}

/** Paperclip — attach-image button in the messenger composer. */
export function AttachIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M17 8l-7.5 7.5a3 3 0 1 0 4.24 4.24L21 12.4a5 5 0 1 0-7.07-7.07L6 12.26" />
    </svg>
  );
}

/** Paper-plane send button. */
export function SendIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 20l17-8L4 4l0 6.5L15 12l-11 1.5L4 20z" />
    </svg>
  );
}

/** Checkmark in a circle — a passenger's documents checked against the booking. */
export function DocVerifiedIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5 5.5-6" />
    </svg>
  );
}

/** Document with a scan line through it — a passenger's document has been scanned (passport reader/camera). */
export function DocScannedIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M4 12h16" />
    </svg>
  );
}

/** Lowercase "i" in a circle — opens fare/baggage allowance info. */
export function InfoIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.15" fill="currentColor" />
    </svg>
  );
}

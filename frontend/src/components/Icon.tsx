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

/** Boarding pass with a checkmark — the check-in workstation nav item. */
/** A passenger with a search/lookup glyph — the check-in workstation nav item. */
export function CheckInIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3C9.794 3 8 4.794 8 7C8 9.206 9.794 11 12 11C14.206 11 16 9.206 16 7C16 4.794 14.206 3 12 3ZM12 5C13.103 5 14 5.897 14 7C14 8.103 13.103 9 12 9C10.897 9 10 8.103 10 7C10 5.897 10.897 5 12 5ZM18 13C15.2 13 13 15.2 13 18C13 20.8 15.2 23 18 23C19 23 20.0008 22.6992 20.8008 22.1992L22.5996 24L24 22.5996L22.1992 20.8008C22.6992 20.0008 23 19 23 18C23 15.2 20.8 13 18 13ZM12 14C8.859 14 3 15.546 3 18.5V21H11.6836C11.3876 20.378 11.1811 19.707 11.0801 19H5V18.5C5 17.693 8.19511 16.2314 11.2871 16.0254C11.5011 15.2954 11.8309 14.6178 12.2559 14.0078C12.1709 14.0058 12.081 14 12 14ZM18 15C19.7 15 21 16.3 21 18C21 19.7 19.7 21 18 21C16.3 21 15 19.7 15 18C15 16.3 16.3 15 18 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** An open palm — "pause/hold boarding" action on the boarding workstation header. */
export function HandIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M8 12V6a1.5 1.5 0 0 1 3 0v5" />
      <path d="M11 11V5a1.5 1.5 0 0 1 3 0v6" />
      <path d="M14 11.5V6a1.5 1.5 0 0 1 3 0v7" />
      <path d="M17 10.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L4.2 14a1.6 1.6 0 0 1 .6-2.2 1.6 1.6 0 0 1 2 .3L8 13.5" />
    </svg>
  );
}

/** Boarding pass with a checkmark — the boarding workstation nav item (was Check-in's icon). */
export function BoardingIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M9 5.5v13" strokeDasharray="2 2.2" />
      <path d="M12.5 12l2 2 3.5-4" />
    </svg>
  );
}

/** ID card with a portrait — the check-in flow's Documents step. */
export function DocumentsFlowIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c0.5-1.8 1.8-2.7 3-2.7s2.5 0.9 3 2.7" />
      <path d="M14.5 10h4M14.5 13h4" />
    </svg>
  );
}

/** A single reclined seat — the check-in flow's Seats step. */
export function SeatsFlowIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M7 12V6.5a2 2 0 0 1 4 0V12" />
      <path d="M7 12h6a2 2 0 0 1 2 2v3.5" />
      <path d="M7 12a2 2 0 0 0-2 2v2.5" />
      <path d="M5 16.5h14" />
      <path d="M17.5 16.5V14" />
    </svg>
  );
}

/** A suitcase — the check-in flow's Baggage step. */
export function BaggageFlowIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M4 13h16" />
    </svg>
  );
}

/** A cup with steam — the check-in flow's Extra services step. */
export function ServicesFlowIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z" />
      <path d="M16 10.5h1.5a2 2 0 0 1 0 4H16" />
      <path d="M8.5 5c0-0.7 0.5-0.9 0.5-1.6S8.5 2 8.5 2M12 5c0-0.7 0.5-0.9 0.5-1.6S12 2 12 2" />
    </svg>
  );
}

/** Shopping cart — the check-in flow's Cart nav item (placeholder, no action yet). */
export function CartFlowIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.1a2 2 0 0 0 2-1.6L20 8H6" />
      <circle cx="10" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Bag-tag print button on a Baggage step row. */
export function PrinterIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M7 8.5V4h10v4.5" />
      <rect x="4" y="8.5" width="16" height="8" rx="1.5" />
      <rect x="7" y="13.5" width="10" height="6.5" />
    </svg>
  );
}

/** Luggage tag — the Baggage step header's tag-info action. */
export function TagIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M11 4h6a2 2 0 0 1 2 2v6l-8.5 8.5a1.5 1.5 0 0 1-2.1 0l-5.9-5.9a1.5 1.5 0 0 1 0-2.1L11 4z" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Ruble currency mark — a bag/carry-on row's inert price indicator. */
export function RubleIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M8 20V4h4.5a4 4 0 0 1 0 8H8" />
      <path d="M6 13h7.5M6 16h7.5" />
    </svg>
  );
}

/** Remove a confirmed extra service. */
export function TrashIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
      <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/* ---- Small colored tab badges — TopTabs shows one per tab, per its section
   (flights/check-in/boarding), when the user has them enabled (see
   tabIcons.tsx). Fixed brand colors rather than currentColor, since these
   are meant to read as section badges even against a selected/hovered tab. */

export function TabFlightsIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <rect width="12" height="12" rx="2" fill="#3B8DE4" />
      <path
        d="M10.0872 9.19595C10.3094 9.19595 10.4895 9.376 10.4895 9.59795C10.4895 9.82 10.3094 10 10.0872 10H2.03964C1.81742 10 1.63727 9.82 1.63727 9.59795C1.63734 9.376 1.81746 9.19595 2.03964 9.19595H10.0872ZM4.0793 2.50545C4.30115 2.52669 4.51277 2.6091 4.69072 2.74311L6.3081 3.94919L6.31125 3.95128C6.3709 3.99663 6.442 4.0248 6.5166 4.0319C6.59125 4.03899 6.66635 4.02486 6.7335 3.99159L6.7351 3.99107L8.41745 3.1645L8.53375 3.11268C8.77015 3.01998 9.02775 2.99448 9.2777 3.03939L9.4024 3.06766L9.4061 3.06871L9.7964 3.18125C9.9333 3.21977 10.0594 3.28811 10.1668 3.38122C10.2752 3.47517 10.3613 3.59224 10.4188 3.72357C10.4763 3.85492 10.5041 3.9975 10.4995 4.14078C10.495 4.28234 10.4585 4.42078 10.3942 4.54699L10.3947 4.54752L10.2417 4.85322C10.1114 5.1135 9.9014 5.3295 9.6345 5.4657L9.6303 5.4678L4.46386 8.0286C4.37832 8.07095 4.28814 8.1029 4.19614 8.1239V8.2249L2.77733 7.98465L2.57562 7.9501L1.5 5.8002L2.30213 5.3992C2.47036 5.3147 2.65609 5.27095 2.8444 5.27095C3.00954 5.27095 3.17269 5.30455 3.3238 5.3699L3.38772 5.39975L3.39924 5.4055L3.41076 5.4123L3.46264 5.44265C3.5171 5.46885 3.57659 5.48295 3.6371 5.48295C3.69999 5.48295 3.76222 5.4683 3.81838 5.44005L3.8231 5.4374L3.91164 5.39395L2.70713 2.986L3.06707 2.80593L3.4312 2.62428C3.63199 2.52559 3.85654 2.48415 4.0793 2.50545ZM4.00228 3.30584C3.92892 3.29887 3.85482 3.31197 3.78852 3.34405L3.78643 3.34563L4.99565 5.76145L4.62995 5.93945L4.17989 6.1577C4.01146 6.2425 3.82569 6.287 3.6371 6.287C3.44844 6.287 3.26228 6.24305 3.09379 6.15825L3.07073 6.14565L3.01835 6.1148C2.96404 6.08875 2.90471 6.075 2.8444 6.075C2.78151 6.075 2.71929 6.08965 2.66312 6.11795L2.66208 6.11845L2.57929 6.1593L3.11265 7.2256L3.39138 7.2727V7.2654L3.86082 7.34445C3.94431 7.3585 4.03013 7.3458 4.10602 7.3083L9.2683 4.74905C9.3795 4.6923 9.46705 4.60304 9.52185 4.4936L9.67695 4.1837L9.69005 4.1502C9.693 4.13879 9.6944 4.12698 9.69475 4.11513C9.6955 4.09126 9.69125 4.06739 9.68165 4.04551C9.6721 4.02366 9.6578 4.00409 9.63975 3.98845C9.62175 3.97283 9.60035 3.96135 9.5774 3.95495L9.5732 3.9539L9.18655 3.8424C9.0506 3.80473 8.90545 3.81926 8.77945 3.88271L8.7758 3.88428L7.09085 4.71136C6.88935 4.81121 6.664 4.85359 6.4401 4.83229C6.21735 4.81105 6.00505 4.72794 5.8266 4.59306L4.20924 3.3875L4.20714 3.38593C4.14766 3.34095 4.07654 3.31294 4.00228 3.30584Z"
        fill="white"
      />
    </svg>
  );
}

export function TabCheckinIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <rect width="12" height="12" rx="2" fill="#FA8A00" />
      <path
        d="M6 1.5C4.897 1.5 4 2.397 4 3.5C4 4.603 4.897 5.5 6 5.5C7.103 5.5 8 4.603 8 3.5C8 2.397 7.103 1.5 6 1.5ZM6 2.5C6.5515 2.5 7 2.9485 7 3.5C7 4.0515 6.5515 4.5 6 4.5C5.4485 4.5 5 4.0515 5 3.5C5 2.9485 5.4485 2.5 6 2.5ZM9 6.5C7.6 6.5 6.5 7.6 6.5 9C6.5 10.4 7.6 11.5 9 11.5C9.5 11.5 10.0004 11.3496 10.4004 11.0996L11.2998 12L12 11.2998L11.0996 10.4004C11.3496 10.0004 11.5 9.5 11.5 9C11.5 7.6 10.4 6.5 9 6.5ZM6 7C4.4295 7 1.5 7.773 1.5 9.25V10.5H5.8418C5.6938 10.189 5.59055 9.8535 5.54005 9.5H2.5V9.25C2.5 8.8465 4.09755 8.1157 5.64355 8.0127C5.75055 7.6477 5.91545 7.3089 6.12795 7.0039C6.08545 7.0029 6.0405 7 6 7ZM9 7.5C9.85 7.5 10.5 8.15 10.5 9C10.5 9.85 9.85 10.5 9 10.5C8.15 10.5 7.5 9.85 7.5 9C7.5 8.15 8.15 7.5 9 7.5Z"
        fill="white"
      />
    </svg>
  );
}

export function TabBoardingIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <rect width="12" height="12" rx="2" fill="#71A500" />
      <path
        d="M9.5 2.75H2.5C1.94772 2.75 1.5 3.19772 1.5 3.75V8.25C1.5 8.80228 1.94772 9.25 2.5 9.25H9.5C10.0523 9.25 10.5 8.80228 10.5 8.25V3.75C10.5 3.19772 10.0523 2.75 9.5 2.75Z"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 2.75V9.25"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1.67 1.83"
      />
      <path d="M6.25 6L7.25 7L9 5" stroke="white" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

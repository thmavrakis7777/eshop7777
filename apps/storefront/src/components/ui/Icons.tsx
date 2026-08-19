type IconProps = { className?: string };

const base = "h-5 w-5";

export function SearchIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

export function HeartIcon({ className = base, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.6-10-9.3C0.3 7.8 2 4.5 5.4 4c2-.3 3.8.7 4.9 2.3C11.4 4.7 13.2 3.7 15.2 4c3.4.5 5.1 3.8 3.4 7.2-2.5 4.7-10 9.3-10 9.3z" strokeLinejoin="round" />
    </svg>
  );
}

export function UserIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.5-3.5 4.5-5.5 7.5-5.5s6 2 7.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

export function BagIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M6 8h12l-1 12.5a1 1 0 01-1 .9H8a1 1 0 01-1-.9L6 8z" strokeLinejoin="round" />
      <path d="M9 8V6.5a3 3 0 016 0V8" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function FacebookIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M15 4.5h-2a3 3 0 00-3 3V10H8v3h2v6.5h3V13h2.2l.5-3H13V7.8c0-.7.3-1 1-1h1.7z" strokeLinejoin="round" />
    </svg>
  );
}

export function InstagramIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="16.7" cy="7.3" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path
        d="M13.5 3.5v11.2a2.8 2.8 0 11-2.8-2.8c.28 0 .55.03.8.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.5 3.5c.3 2 1.9 3.5 3.9 3.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PhoneIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path
        d="M6.6 3h2.2l1.4 3.5-1.8 1.2a10.5 10.5 0 0 0 4.9 4.9l1.2-1.8L18 12.2v2.2a2 2 0 0 1-2.2 2A13.8 13.8 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

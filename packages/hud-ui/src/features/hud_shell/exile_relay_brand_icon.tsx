/** Vector brand mark matching the Exile Relay Windows desktop and system tray icon. */
export function ExileRelayBrandIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="256" height="256" rx="52" fill="#09090B" />
      <rect x="10" y="10" width="236" height="236" rx="44" stroke="#6366F1" strokeWidth="14" />
      <path
        d="M128 46 L194 128 L128 210 L62 128 Z"
        stroke="#EAB308"
        strokeWidth="18"
        strokeLinejoin="round"
      />
      <circle cx="128" cy="128" r="24" fill="#6366F1" />
    </svg>
  );
}

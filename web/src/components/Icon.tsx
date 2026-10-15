const PATHS = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v2',
  micOff:
    'M3 3l18 18M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M5 12a7 7 0 0 0 11.6 5.3M19 12a7 7 0 0 1-.6 2.8M12 19v2',
  power: 'M12 3v8M6.3 6.6a8 8 0 1 0 11.4 0',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12.5l4.5 4.5L19 7',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8 5v14M16 5v14',
  reset: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
  volume: 'M4 9.5v5h4l5 4v-13l-5 4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  volumeOff: 'M4 9.5v5h4l5 4v-13l-5 4zM17 9.5l5 5M22 9.5l-5 5',
  send: 'M4 12l16-8-6 16-2.5-6.5z',
  alert: 'M12 4l9 16H3zM12 10v4M12 17v.01',
  close: 'M6 6l12 12M18 6L6 18',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

import type { JSX } from 'react';

const INK = 'var(--color-text-secondary)';
const MUTED = 'var(--color-text-muted)';

export const ChatsIcon = (): JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M3 4.5c0-.83.67-1.5 1.5-1.5h9c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5H7.5L4.5 15v-3H4.5c-.83 0-1.5-.67-1.5-1.5v-6z"
      stroke={INK}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

export const ConnectionsIcon = (): JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M7.5 10.5l-3 3a2.12 2.12 0 01-3-3l3-3" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.5 7.5l3-3a2.12 2.12 0 013 3l-3 3" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 12l6-6" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const MemoryIcon = (): JSX.Element => (
  <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M9.5 3.5a2.25 2.25 0 00-2.25 2.25M9.5 3.5a2.25 2.25 0 012.25 2.25M9.5 3.5v12M7.25 5.75c-1.1 0-2 .9-2 2 0 .7.36 1.31.9 1.67-.54.36-.9.97-.9 1.67 0 .75.41 1.4 1.02 1.75-.27.33-.43.75-.43 1.2a1.9 1.9 0 003.41 1.13M11.75 5.75c1.1 0 2 .9 2 2 0 .7-.36 1.31-.9 1.67.54.36.9.97.9 1.67 0 .75-.41 1.4-1.02 1.75.27.33.43.75.43 1.2a1.9 1.9 0 01-3.41 1.13"
      stroke={INK}
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const NewTabIcon = (): JSX.Element => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M8 2v12M2 8h12" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const SettingsIcon = (): JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="9" cy="9" r="2.25" stroke={INK} strokeWidth="1.4" />
    <path
      d="M14.7 11.3c-.2.45-.1.95.25 1.38l.05.05a1.52 1.52 0 11-2.15 2.15l-.05-.05a1.25 1.25 0 00-1.38-.25c-.46.2-.76.65-.76 1.14v.14a1.52 1.52 0 01-3.04 0v-.07a1.25 1.25 0 00-.82-1.14c-.46-.2-.99-.1-1.38.25l-.05.05a1.52 1.52 0 11-2.15-2.15l.05-.05c.35-.43.45-.93.25-1.38a1.25 1.25 0 00-1.14-.76h-.14a1.52 1.52 0 010-3.04h.07a1.25 1.25 0 001.14-.82c.2-.46.1-.99-.25-1.38l-.05-.05a1.52 1.52 0 112.15-2.15l.05.05c.39.35.92.45 1.38.25h.07c.45-.2.76-.65.76-1.14V1.5a1.52 1.52 0 013.04 0v.07c0 .49.31.94.76 1.14.46.2.99.1 1.38-.25l.05-.05a1.52 1.52 0 112.15 2.15l-.05.05c-.35.39-.45.92-.25 1.38v.07c.2.45.65.76 1.14.76h.14a1.52 1.52 0 010 3.04h-.07c-.49 0-.94.31-1.14.76z"
      stroke={INK}
      strokeWidth="1.3"
    />
  </svg>
);

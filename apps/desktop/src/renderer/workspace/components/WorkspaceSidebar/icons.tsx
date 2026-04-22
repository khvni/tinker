import type { JSX } from 'react';

const INK = 'var(--color-text-secondary)';
const MUTED = 'var(--color-text-muted)';
const ACTIVE = 'var(--color-accent-strong)';

export const WorkspacesIcon = (): JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="2" y="2" width="6" height="6" rx="1.2" stroke={ACTIVE} strokeWidth="1.4" />
    <rect x="10" y="2" width="6" height="6" rx="1.2" stroke={ACTIVE} strokeWidth="1.4" />
    <rect x="2" y="10" width="6" height="6" rx="1.2" stroke={ACTIVE} strokeWidth="1.4" />
    <rect x="10" y="10" width="6" height="6" rx="1.2" stroke={ACTIVE} strokeWidth="1.4" />
  </svg>
);

export const ExplorerIcon = (): JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M2.5 5.25c0-.69.56-1.25 1.25-1.25h3l1.5 1.75h5.5c.69 0 1.25.56 1.25 1.25v6.25c0 .69-.56 1.25-1.25 1.25H3.75c-.69 0-1.25-.56-1.25-1.25V5.25z"
      stroke={INK}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

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

export const SkillsIcon = (): JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M9 1.5l1.8 4.7 4.7 1.8-4.7 1.8L9 14.5l-1.8-4.7L2.5 8l4.7-1.8L9 1.5z" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M14.25 11l.75 2 2 .75-2 .75-.75 2-.75-2-2-.75 2-.75.75-2z" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

export const AgentsIcon = (): JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="3" y="5.5" width="12" height="9" rx="2" stroke={INK} strokeWidth="1.4" />
    <path d="M9 3v2.5" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="9" cy="2.5" r="0.75" fill={INK} />
    <circle cx="6.5" cy="9.5" r="1" fill={INK} />
    <circle cx="11.5" cy="9.5" r="1" fill={INK} />
    <path d="M6.5 12.25h5" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
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

export const PlaybookIcon = (): JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M9 2L2.5 5v4.5c0 3.5 2.6 6.3 6.5 7 3.9-.7 6.5-3.5 6.5-7V5L9 2z" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M6.5 9l2 2 3.5-4" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const AnalyticsIcon = (): JSX.Element => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M3 15V9.5M7 15V4M11 15v-6.5M15 15v-9" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
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

export const LeftPaneIcon = (): JSX.Element => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" stroke={MUTED} strokeWidth="1.2" />
    <line x1="6" y1="2.5" x2="6" y2="12.5" stroke={MUTED} strokeWidth="1.2" />
  </svg>
);

export const RightPaneIcon = (): JSX.Element => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" stroke={MUTED} strokeWidth="1.2" />
    <line x1="9.5" y1="2.5" x2="9.5" y2="12.5" stroke={MUTED} strokeWidth="1.2" />
  </svg>
);

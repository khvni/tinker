export const colors = {
  bg: {
    primary: '#1a1612',
    elevated: '#221d17',
    panel: '#16120e',
    input: '#120f0c',
    hover: '#25201a',
  },
  border: {
    subtle: 'rgba(255, 240, 220, 0.06)',
    default: 'rgba(255, 240, 220, 0.1)',
    strong: 'rgba(255, 240, 220, 0.18)',
  },
  text: {
    primary: '#f5efe6',
    secondary: '#a8a097',
    muted: '#6f665c',
    inverse: '#1a1612',
  },
  accent: {
    base: '#f9c041',
    strong: '#e5ad2d',
    soft: 'rgba(249, 192, 65, 0.18)',
    ring: 'rgba(249, 192, 65, 0.35)',
    ink: '#201402',
  },
  semantic: {
    success: '#4ade80',
    successSoft: 'rgba(74, 222, 128, 0.18)',
    error: '#ef4444',
    errorSoft: 'rgba(239, 68, 68, 0.18)',
    warning: '#f59e0b',
    warningSoft: 'rgba(245, 158, 11, 0.2)',
    info: '#60a5fa',
    infoSoft: 'rgba(96, 165, 250, 0.2)',
    skill: '#a78bfa',
    skillSoft: 'rgba(167, 139, 250, 0.2)',
    claude: '#f2c94c',
    muted: '#6b625a',
  },
} as const;

export type ColorTokens = typeof colors;

export type User = {
  id: string;
  provider: 'local' | 'google' | 'github' | 'microsoft';
  providerUserId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  createdAt: string;
  lastSeenAt: string;
};

export const SESSION_MODES = ['build', 'plan'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];
export const DEFAULT_SESSION_MODE: SessionMode = 'build';

export const REASONING_LEVELS = ['default', 'low', 'medium', 'high', 'xhigh'] as const;
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];
export const DEFAULT_REASONING_LEVEL: ReasoningLevel = 'default';

export type Session = {
  id: string;
  userId: User['id'];
  folderPath: string;
  createdAt: string;
  lastActiveAt: string;
  mode: SessionMode;
  modelId?: string;
  reasoningLevel?: ReasoningLevel;
};

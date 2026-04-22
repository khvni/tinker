export type User = {
  id: string;
  provider: 'google' | 'github' | 'microsoft';
  providerUserId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  createdAt: string;
  lastSeenAt: string;
};

export type Session = {
  id: string;
  userId: User['id'];
  folderPath: string;
  createdAt: string;
  lastActiveAt: string;
  modelId?: string;
};

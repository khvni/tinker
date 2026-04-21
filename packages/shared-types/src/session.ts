export type User = {
  id: string;
};

export type Session = {
  id: string;
  userId: User['id'];
  folderPath: string;
  createdAt: string;
  lastActiveAt: string;
  modelId?: string;
};

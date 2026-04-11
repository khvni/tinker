export type SlackAssistant = {
  id: string;
  ownerUserId: string;
  channelId: string;
  systemPrompt: string;
  skills: string[];
  integrations: string[];
  createdAt: string;
};

export type TriageTicket = {
  id: string;
  slackMessageTs: string;
  slackChannelId: string;
  reporter: string;
  summary: string;
  classification: 'bug' | 'feature' | 'question' | 'other';
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  githubIssueUrl?: string;
  createdAt: string;
};

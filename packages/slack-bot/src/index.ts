import type { SlackAssistant, TriageTicket } from '@ramp-glass/shared-types';

export type SlackBotConfig = {
  botToken: string;
  appToken: string;
  signingSecret: string;
};

export const createSlackBot = (_config: SlackBotConfig) => {
  return {
    start: async (): Promise<void> => {
      throw new Error('slackBot.start: not yet implemented — see tasks/slack-bot.md');
    },
    stop: async (): Promise<void> => {
      throw new Error('slackBot.stop: not yet implemented — see tasks/slack-bot.md');
    },
    registerAssistant: async (_assistant: SlackAssistant): Promise<void> => {
      throw new Error('slackBot.registerAssistant: not yet implemented — see tasks/slack-bot.md');
    },
    registerTriageChannel: async (_channelId: string): Promise<void> => {
      throw new Error('slackBot.registerTriageChannel: not yet implemented — see tasks/slack-bot.md');
    },
    listTickets: async (): Promise<TriageTicket[]> => {
      throw new Error('slackBot.listTickets: not yet implemented — see tasks/slack-bot.md');
    },
  };
};

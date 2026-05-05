import type { IJsonModel } from 'flexlayout-react';

const createId = (prefix: string): string => {
  return `${prefix}-${crypto.randomUUID()}`;
};

export const createDefaultLayoutJson = (): IJsonModel => {
  const paneId = createId('pane');

  return {
    global: {
      tabEnableClose: true,
      tabEnableDrag: true,
      tabSetEnableDrop: true,
      tabSetEnableDrag: true,
      tabSetEnableMaximize: true,
      tabSetEnableTabStrip: true,
      tabSetMinWidth: 100,
      tabSetMinHeight: 100,
    },
    borders: [],
    layout: {
      type: 'row',
      weight: 100,
      children: [
        {
          type: 'tabset',
          weight: 100,
          active: true,
          children: [
            {
              type: 'tab',
              id: paneId,
              name: 'Chat',
              component: 'chat',
              config: { kind: 'chat' as const },
            },
          ],
        },
      ],
    },
  };
};

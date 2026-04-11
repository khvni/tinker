import type { IJsonModel } from 'flexlayout-react';

export const defaultLayoutModel: IJsonModel = {
  global: {
    tabEnableClose: true,
    tabEnableRename: false,
    splitterSize: 4,
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 60,
        children: [
          {
            type: 'tab',
            name: 'Chat',
            component: 'chat',
            id: 'welcome-chat',
          },
        ],
      },
      {
        type: 'tabset',
        weight: 40,
        children: [
          {
            type: 'tab',
            name: 'Dojo',
            component: 'dojo',
            id: 'welcome-dojo',
          },
          {
            type: 'tab',
            name: 'Today',
            component: 'today',
            id: 'welcome-today',
          },
        ],
      },
    ],
  },
};

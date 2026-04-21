import type { FunctionComponent } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import type { TabKind } from '@tinker/shared-types';

export type WorkspacePaneMap = Record<TabKind, FunctionComponent<IDockviewPanelProps>>;

export const createPaneRegistry = <T extends WorkspacePaneMap>(panes: T): T => panes;

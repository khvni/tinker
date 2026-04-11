import { useMemo } from 'react';
import { Layout, Model, type TabNode } from 'flexlayout-react';
import type { PaneKind } from '@ramp-glass/shared-types';
import { defaultLayoutModel } from './layout.default.js';
import { getPaneComponent, registerPane } from './pane-registry.js';
import { ChatPlaceholder } from '../panes/ChatPlaceholder.js';
import { DojoPlaceholder } from '../panes/DojoPlaceholder.js';
import { TodayPlaceholder } from '../panes/TodayPlaceholder.js';

registerPane('chat', ChatPlaceholder);
registerPane('dojo', DojoPlaceholder);
registerPane('today', TodayPlaceholder);

const factory = (node: TabNode): JSX.Element => {
  const component = node.getComponent() as PaneKind | undefined;
  if (!component) return <EmptyPane message="pane: no component assigned" />;
  const PaneComponent = getPaneComponent(component);
  if (!PaneComponent) {
    return <EmptyPane message={`pane: no renderer registered for "${component}"`} />;
  }
  return <PaneComponent paneId={node.getId()} props={node.getConfig() as Record<string, unknown>} />;
};

const EmptyPane = ({ message }: { message: string }): JSX.Element => (
  <div className="glass-empty-pane">{message}</div>
);

export const Workspace = (): JSX.Element => {
  const model = useMemo(() => Model.fromJson(defaultLayoutModel), []);
  return (
    <div className="glass-workspace">
      <Layout model={model} factory={factory} />
    </div>
  );
};

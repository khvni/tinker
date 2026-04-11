import type { ComponentType } from 'react';
import type { PaneKind } from '@ramp-glass/shared-types';

export type PaneComponent = ComponentType<{ paneId: string; props?: Record<string, unknown> }>;

type PaneRegistry = Map<PaneKind, PaneComponent>;

const registry: PaneRegistry = new Map();

export const registerPane = (kind: PaneKind, component: PaneComponent): void => {
  registry.set(kind, component);
};

export const getPaneComponent = (kind: PaneKind): PaneComponent | undefined => {
  return registry.get(kind);
};

export const listRegisteredPanes = (): PaneKind[] => {
  return Array.from(registry.keys());
};

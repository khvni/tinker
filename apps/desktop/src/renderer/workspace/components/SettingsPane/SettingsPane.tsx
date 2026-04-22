import type { JSX } from 'react';
import { EmptyPane } from '../EmptyPane/index.js';

export const SettingsPane = (): JSX.Element => {
  return (
    <EmptyPane
      eyebrow="Settings"
      title="Settings panel coming soon"
      description="Account, connection, and workspace controls will land here in a follow-up MVP task."
    />
  );
};

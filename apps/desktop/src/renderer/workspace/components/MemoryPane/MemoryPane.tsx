import type { JSX } from 'react';
import { EmptyPane } from '../EmptyPane/index.js';

export const MemoryPane = (): JSX.Element => {
  return (
    <EmptyPane
      eyebrow="Memory"
      title="Memory view coming soon"
      description="Desktop memory files and cross-session recall will land here once the MVP memory filesystem is wired in."
    />
  );
};

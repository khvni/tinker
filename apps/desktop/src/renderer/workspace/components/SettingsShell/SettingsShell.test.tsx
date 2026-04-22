import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsShell, type SettingsShellSection } from './SettingsShell.js';

const twoSections: ReadonlyArray<SettingsShellSection> = [
  { id: 'account', label: 'Account', content: <p>Account body</p> },
  { id: 'memory', label: 'Memory', content: <p>Memory body</p> },
];

describe('SettingsShell', () => {
  it('renders every section label in the rail', () => {
    const markup = renderToStaticMarkup(<SettingsShell sections={twoSections} />);
    expect(markup).toContain('Account');
    expect(markup).toContain('Memory');
  });

  it('renders the first section content by default', () => {
    const markup = renderToStaticMarkup(<SettingsShell sections={twoSections} />);
    expect(markup).toContain('Account body');
    expect(markup).not.toContain('Memory body');
  });

  it('honors defaultActiveSectionId for uncontrolled usage', () => {
    const markup = renderToStaticMarkup(
      <SettingsShell sections={twoSections} defaultActiveSectionId="memory" />,
    );
    expect(markup).toContain('Memory body');
    expect(markup).not.toContain('Account body');
  });

  it('honors controlled activeSectionId', () => {
    const markup = renderToStaticMarkup(
      <SettingsShell sections={twoSections} activeSectionId="memory" />,
    );
    expect(markup).toContain('Memory body');
  });

  it('falls back to the first section when activeSectionId does not match', () => {
    const markup = renderToStaticMarkup(
      <SettingsShell sections={twoSections} activeSectionId="does-not-exist" />,
    );
    expect(markup).toContain('Account body');
  });

  it('marks the active section with aria-current="page"', () => {
    const markup = renderToStaticMarkup(<SettingsShell sections={twoSections} />);
    expect(markup).toContain('aria-current="page"');
  });

  it('labels the rail nav with the title', () => {
    const markup = renderToStaticMarkup(
      <SettingsShell sections={twoSections} title="Preferences" />,
    );
    expect(markup).toContain('aria-label="Preferences sections"');
  });

  it('renders a default EmptyPane when sections is empty', () => {
    const markup = renderToStaticMarkup(<SettingsShell sections={[]} />);
    expect(markup).toContain('No settings yet');
    expect(markup).toContain('role="status"');
  });

  it('accepts a custom emptyState override when sections is empty', () => {
    const markup = renderToStaticMarkup(
      <SettingsShell sections={[]} emptyState={<p>nothing configured</p>} />,
    );
    expect(markup).toContain('nothing configured');
    expect(markup).not.toContain('No settings yet');
  });

  it('renders icon nodes when provided', () => {
    const sections: ReadonlyArray<SettingsShellSection> = [
      {
        id: 'account',
        label: 'Account',
        icon: <span data-testid="account-icon">A</span>,
        content: <p>body</p>,
      },
    ];
    const markup = renderToStaticMarkup(<SettingsShell sections={sections} />);
    expect(markup).toContain('data-testid="account-icon"');
    expect(markup).toContain('aria-hidden="true"');
  });
});

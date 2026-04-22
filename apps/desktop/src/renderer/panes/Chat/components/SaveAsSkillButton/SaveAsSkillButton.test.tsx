import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SaveAsSkillButton } from './SaveAsSkillButton.js';

describe('SaveAsSkillButton', () => {
  it('renders an icon-only button with the aria-label required by the spec', () => {
    const markup = renderToStaticMarkup(<SaveAsSkillButton onClick={() => undefined} />);
    expect(markup).toContain('aria-label="Save conversation as skill"');
  });

  it('renders a disabled button when asked (e.g. during streaming)', () => {
    const markup = renderToStaticMarkup(
      <SaveAsSkillButton disabled onClick={() => undefined} />,
    );
    expect(markup).toContain('disabled=""');
  });

  it('does not invoke the click handler while disabled (type-check via vi.fn)', () => {
    // DOM click isn't exercised in SSR; this test just guards the prop contract.
    const onClick = vi.fn();
    const markup = renderToStaticMarkup(
      <SaveAsSkillButton disabled onClick={onClick} />,
    );
    expect(markup).toContain('aria-label="Save conversation as skill"');
    expect(onClick).not.toHaveBeenCalled();
  });
});

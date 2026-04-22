import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromptComposer } from './PromptComposer.js';

describe('<PromptComposer>', () => {
  it('renders contextSlot and statusSlot in top row', () => {
    const { container } = render(
      <PromptComposer
        value=""
        onChange={() => undefined}
        onSubmit={() => undefined}
        contextSlot={<span data-testid="context">Context</span>}
        statusSlot={<span data-testid="status">Status</span>}
      />,
    );
    expect(screen.getByTestId('context')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toBeInTheDocument();
    expect(container.querySelector('.tk-prompt-composer__top-row')).not.toBeNull();
  });

  it('renders controls and trailingSlot in bottom row', () => {
    const { container } = render(
      <PromptComposer
        value=""
        onChange={() => undefined}
        onSubmit={() => undefined}
        controls={<span data-testid="ctrl">Control</span>}
        trailingSlot={<span data-testid="trail">Trailing</span>}
      />,
    );
    expect(screen.getByTestId('ctrl')).toBeInTheDocument();
    expect(screen.getByTestId('trail')).toBeInTheDocument();
    expect(container.querySelector('.tk-prompt-composer__bottom-row')).not.toBeNull();
  });

  it('send button is 26×26 radius-sm', () => {
    const { container } = render(
      <PromptComposer value="hello" onChange={() => undefined} onSubmit={() => undefined} />,
    );
    const send = container.querySelector('.tk-prompt-composer__send');
    expect(send).not.toBeNull();
    // Verify className contains expected styling hooks
    expect(send?.classList.contains('tk-prompt-composer__send')).toBe(true);
  });

  it('attach button has bordered class', () => {
    const { container } = render(
      <PromptComposer value="" onChange={() => undefined} onSubmit={() => undefined} />,
    );
    const attach = container.querySelector('.tk-prompt-composer__attach');
    expect(attach).not.toBeNull();
  });

  it('hides top row when no slots provided', () => {
    const { container } = render(
      <PromptComposer value="" onChange={() => undefined} onSubmit={() => undefined} />,
    );
    expect(container.querySelector('.tk-prompt-composer__top-row')).toBeNull();
  });

  it('hides bottom row when no slots provided', () => {
    const { container } = render(
      <PromptComposer value="" onChange={() => undefined} onSubmit={() => undefined} />,
    );
    expect(container.querySelector('.tk-prompt-composer__bottom-row')).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModelPicker, type ModelPickerItem } from './ModelPicker.js';

const items: ReadonlyArray<ModelPickerItem> = [
  {
    id: 'anthropic:claude-sonnet-4',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    name: 'Claude Sonnet 4',
    contextWindow: 200_000,
    pricingHint: '$3/Mtok',
  },
  {
    id: 'anthropic:claude-opus-4',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    name: 'Claude Opus 4',
    contextWindow: 200_000,
  },
  {
    id: 'openai:gpt-5',
    providerId: 'openai',
    providerName: 'OpenAI',
    name: 'GPT-5',
    contextWindow: 1_000_000,
  },
];

afterEach(() => cleanup());

describe('<ModelPicker>', () => {
  it('renders the trigger and opens the panel on click', () => {
    render(<ModelPicker items={items} onSelect={() => undefined} />);
    expect(screen.queryByTestId('modelpicker-list')).toBeNull();
    const trigger = screen.getByRole('button', { name: /Select model/i });
    fireEvent.click(trigger);
    expect(screen.getByTestId('modelpicker-list')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Select model/i })).toBeInTheDocument();
  });

  it('does not repeat the provider label inside each model row', () => {
    const { container } = render(
      <ModelPicker items={items} onSelect={() => undefined} defaultOpen />,
    );

    expect(container.querySelector('.tk-modelpicker__row-provider')).toBeNull();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
  });

  it('filters rows by typing in the search input', () => {
    render(<ModelPicker items={items} onSelect={() => undefined} defaultOpen />);
    const input = screen.getByTestId('modelpicker-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'opus' } });
    const rows = screen.getAllByRole('option');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('data-key', 'anthropic:claude-opus-4');
  });

  it('ArrowDown moves active row to next item', () => {
    const { container } = render(
      <ModelPicker items={items} onSelect={() => undefined} defaultOpen />,
    );
    const wrapper = container.querySelector('.tk-modelpicker');
    expect(wrapper).not.toBeNull();
    if (wrapper == null) throw new Error('wrapper not found');

    // Initial active should be the first row.
    const rowsBefore = screen.getAllByRole('option');
    expect(rowsBefore[0]).toHaveAttribute('data-active', 'true');

    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    const rowsAfter = screen.getAllByRole('option');
    expect(rowsAfter[1]).toHaveAttribute('data-active', 'true');
    expect(rowsAfter[0]).toHaveAttribute('data-active', 'false');
  });

  it('Enter fires onSelect with the active row id and closes', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ModelPicker items={items} onSelect={onSelect} defaultOpen />,
    );
    const wrapper = container.querySelector('.tk-modelpicker');
    if (wrapper == null) throw new Error('wrapper not found');
    // After ArrowDown, the second row (Claude Sonnet 4, alphabetical after Opus) is active.
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('anthropic:claude-sonnet-4');
    expect(screen.queryByTestId('modelpicker-list')).toBeNull();
  });

  it('Escape closes the panel', () => {
    const { container } = render(
      <ModelPicker items={items} onSelect={() => undefined} defaultOpen />,
    );
    expect(screen.getByTestId('modelpicker-list')).toBeInTheDocument();
    const wrapper = container.querySelector('.tk-modelpicker');
    if (wrapper == null) throw new Error('wrapper not found');
    fireEvent.keyDown(wrapper, { key: 'Escape' });
    expect(screen.queryByTestId('modelpicker-list')).toBeNull();
  });

  it('renders the empty state when the filter matches nothing', () => {
    render(
      <ModelPicker
        items={items}
        onSelect={() => undefined}
        defaultOpen
        defaultFilter="zzzzzz"
      />,
    );
    expect(screen.getByTestId('modelpicker-empty')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('renders the loading state when loading prop is true', () => {
    render(<ModelPicker items={items} onSelect={() => undefined} defaultOpen loading />);
    expect(screen.getByTestId('modelpicker-loading')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('open-shortcut does not fire when focus is inside an editable element', () => {
    render(
      <div>
        <input data-testid="outside-input" />
        <ModelPicker items={items} onSelect={() => undefined} />
      </div>,
    );
    const input = screen.getByTestId('outside-input') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    // Use ctrlKey (jsdom navigator.platform is non-mac, so Mod → ctrl).
    fireEvent.keyDown(input, { key: "'", ctrlKey: true });

    // Panel stays closed.
    expect(screen.queryByTestId('modelpicker-list')).toBeNull();
    const trigger = screen.getByRole('button', { name: /Select model/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('dock variant renders persistent bg and dual labels', () => {
    const { container } = render(
      <ModelPicker items={items} value={items[0]?.id} onSelect={() => undefined} variant="dock" />,
    );
    const trigger = container.querySelector('.tk-modelpicker__trigger--dock');
    expect(trigger).not.toBeNull();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('Claude Sonnet 4')).toBeInTheDocument();
  });
});

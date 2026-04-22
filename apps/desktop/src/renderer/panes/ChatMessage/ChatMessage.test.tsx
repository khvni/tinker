import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMessage } from './ChatMessage.js';

describe('ChatMessage', () => {
  it('renders user messages as plain text', () => {
    const markup = renderToStaticMarkup(<ChatMessage role="user" text="Hello **world**" />);

    expect(markup).toContain('tinker-message--user');
    expect(markup).toContain('Hello **world**');
    expect(markup).not.toContain('<strong>');
  });

  it('renders assistant markdown as html', () => {
    const markup = renderToStaticMarkup(
      <ChatMessage role="assistant" text={'# Heading\n\nSome **bold** words.'} />,
    );

    expect(markup).toContain('<h1>Heading</h1>');
    expect(markup).toContain('<strong>bold</strong>');
    expect(markup).not.toContain('**bold**');
    expect(markup).not.toContain('# Heading');
  });

  it('renders GFM lists, tables, task lists, and strikethrough', () => {
    const text = [
      '- one',
      '- two',
      '',
      '1. first',
      '2. second',
      '',
      '| col | val |',
      '| --- | --- |',
      '| a   | 1   |',
      '',
      '- [ ] open',
      '- [x] done',
      '',
      '~~old~~',
    ].join('\n');

    const markup = renderToStaticMarkup(<ChatMessage role="assistant" text={text} />);

    expect(markup).toContain('<ul>');
    expect(markup).toContain('<ol>');
    expect(markup).toContain('<table>');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('<del>old</del>');
  });

  it('renders fenced code blocks with language label and copy affordance', () => {
    const text = ['```typescript', 'const x = 1;', '```'].join('\n');
    const markup = renderToStaticMarkup(<ChatMessage role="assistant" text={text} />);

    expect(markup).toContain('tinker-chat-codeblock');
    expect(markup).toContain('tinker-chat-codeblock__lang');
    expect(markup).toContain('typescript');
    expect(markup).toContain('tinker-chat-codeblock__copy');
  });

  it('opens links in a new tab', () => {
    const markup = renderToStaticMarkup(
      <ChatMessage role="assistant" text={'[site](https://example.com)'} />,
    );

    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noreferrer noopener"');
  });

  it('shows copy + save-as-skill actions only when assistant text is non-empty and not streaming', () => {
    const withContent = renderToStaticMarkup(
      <ChatMessage role="assistant" text="hello" onSaveAsSkill={vi.fn()} />,
    );
    expect(withContent).toContain('Copy');
    expect(withContent).toContain('Save as skill');

    const empty = renderToStaticMarkup(<ChatMessage role="assistant" text="" />);
    expect(empty).not.toContain('Copy');
    expect(empty).not.toContain('Save as skill');

    const streaming = renderToStaticMarkup(
      <ChatMessage role="assistant" text="partial" streaming onSaveAsSkill={vi.fn()} />,
    );
    expect(streaming).toContain('tinker-message--streaming');
    expect(streaming).not.toContain('Save as skill');
  });
});

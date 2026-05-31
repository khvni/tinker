import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CodingAgentsSection } from './CodingAgentsSection.js';
import type { AcpConnectorState } from '@tinker/shared-types';

describe('CodingAgentsSection', () => {
  const allNotInstalled: ReadonlyArray<AcpConnectorState> = [
    { id: 'claude-code', status: 'not-installed', message: 'Claude Code binary not found.' },
    { id: 'codex', status: 'not-installed', message: 'Codex binary not found.' },
    { id: 'opencode', status: 'not-installed', message: 'OpenCode binary not found.' },
  ];

  it('renders section heading and goose status', () => {
    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled
        gooseConnection={null}
        connectorStates={allNotInstalled}
      />,
    );

    expect(markup).toContain('ACP connectors');
    expect(markup).toContain('Coding Agents');
    expect(markup).toContain('Goose installed but not running');
  });

  it('shows install hint when goose is not installed', () => {
    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled={false}
        gooseConnection={null}
        connectorStates={allNotInstalled}
      />,
    );

    expect(markup).toContain('Goose not installed');
    expect(markup).toContain('download_cli.sh');
  });

  it('renders configured connector without install hint', () => {
    const configured: ReadonlyArray<AcpConnectorState> = [
      { id: 'claude-code', status: 'configured', message: null },
      { id: 'codex', status: 'not-installed', message: 'Codex binary not found.' },
      { id: 'opencode', status: 'detected', message: 'OpenCode is installed but not configured.' },
    ];

    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled
        gooseConnection={{ baseUrl: 'http://127.0.0.1:3284/acp', sessionId: 's1', pid: 123 }}
        connectorStates={configured}
      />,
    );

    expect(markup).toContain('Goose running');
    expect(markup).toContain('Configured');
    expect(markup).toContain('Claude Code');
    expect(markup).toContain('Detected');
    expect(markup).toContain('Not installed');
  });

  it('shows errored status for a broken connector', () => {
    const errored: ReadonlyArray<AcpConnectorState> = [
      { id: 'claude-code', status: 'errored', message: 'Provider crashed on startup.' },
      { id: 'codex', status: 'configured', message: null },
      { id: 'opencode', status: 'unavailable', message: 'Requires Goose.' },
    ];

    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled
        gooseConnection={null}
        connectorStates={errored}
      />,
    );

    expect(markup).toContain('Error');
    expect(markup).toContain('Provider crashed on startup.');
    expect(markup).toContain('Unavailable');
  });

  it('shows all three connectors from ACP_CONNECTOR_META', () => {
    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled
        gooseConnection={null}
        connectorStates={allNotInstalled}
      />,
    );

    expect(markup).toContain('Claude Code');
    expect(markup).toContain('Codex');
    expect(markup).toContain('OpenCode');
  });

  it('shows install hint for not-installed connectors', () => {
    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled
        gooseConnection={null}
        connectorStates={allNotInstalled}
      />,
    );

    expect(markup).toContain('npm install -g @anthropic-ai/claude-code');
    expect(markup).toContain('npm install -g @openai/codex');
    expect(markup).toContain('npm install -g opencode');
  });
});

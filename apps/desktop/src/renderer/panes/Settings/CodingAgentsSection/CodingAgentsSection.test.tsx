import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CodingAgentsSection } from './CodingAgentsSection.js';
import type { AcpConnectorState } from '@tinker/shared-types';

describe('CodingAgentsSection', () => {
  const allNotInstalled: ReadonlyArray<AcpConnectorState> = [
    { id: 'claude-code', name: 'Claude Code', description: "Anthropic's headless coding agent via ACP.", version: '1.0.0', authors: ['Anthropic'], status: 'not-installed', message: 'Binary "claude" not found.', cmd: 'claude', args: ['acp'] },
    { id: 'codex', name: 'Codex', description: "OpenAI's headless coding agent via ACP.", version: '1.0.0', authors: ['OpenAI'], status: 'not-installed', message: 'Binary "codex" not found.', cmd: 'codex', args: ['acp'] },
    { id: 'opencode', name: 'OpenCode', description: 'Open-source coding agent by Anomaly.', version: '1.0.0', authors: ['Anomaly'], status: 'not-installed', message: 'Binary "opencode" not found.', cmd: 'opencode', args: ['acp'] },
  ];

  it('renders section heading and goose status', () => {
    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled
        gooseConnection={null}
        connectorStates={allNotInstalled}
      />,
    );

    expect(markup).toContain('ACP Registry');
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
  });

  it('renders configured connector', () => {
    const configured: ReadonlyArray<AcpConnectorState> = [
      { id: 'claude-code', name: 'Claude Code', description: "Anthropic's headless coding agent via ACP.", version: '1.0.0', authors: ['Anthropic'], status: 'configured', message: null, cmd: 'claude', args: ['acp'] },
      { id: 'codex', name: 'Codex', description: "OpenAI's headless coding agent.", version: '1.0.0', authors: ['OpenAI'], status: 'not-installed', message: 'Binary "codex" not found.', cmd: 'codex', args: ['acp'] },
      { id: 'opencode', name: 'OpenCode', description: 'Open-source coding agent.', version: '1.0.0', authors: ['Anomaly'], status: 'detected', message: null, cmd: 'opencode', args: ['acp'] },
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
      { id: 'claude-code', name: 'Claude Code', description: 'Test', version: '1.0.0', authors: ['Anthropic'], status: 'errored', message: 'Provider crashed on startup.', cmd: 'claude', args: [] },
      { id: 'codex', name: 'Codex', description: 'Test', version: '1.0.0', authors: ['OpenAI'], status: 'configured', message: null, cmd: 'codex', args: [] },
      { id: 'opencode', name: 'OpenCode', description: 'Test', version: '1.0.0', authors: ['Anomaly'], status: 'unavailable', message: 'No binary configured.', cmd: null, args: [] },
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

  it('renders all agents dynamically from connectorStates', () => {
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

  it('shows binary name for not-installed connectors', () => {
    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled
        gooseConnection={null}
        connectorStates={allNotInstalled}
      />,
    );

    expect(markup).toContain('claude');
    expect(markup).toContain('codex');
    expect(markup).toContain('opencode');
  });

  it('renders a custom agent from registry', () => {
    const customAgents: ReadonlyArray<AcpConnectorState> = [
      { id: 'my-custom-agent', name: 'My Custom Agent', description: 'Does cool stuff', version: '3.0.0', authors: ['Custom Corp'], status: 'detected', message: null, cmd: '/opt/custom/agent', args: ['--acp'] },
    ];

    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled
        gooseConnection={null}
        connectorStates={customAgents}
      />,
    );

    expect(markup).toContain('My Custom Agent');
    expect(markup).toContain('Does cool stuff');
    expect(markup).toContain('Detected');
  });

  it('shows registry path when provided', () => {
    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled
        gooseConnection={null}
        connectorStates={[]}
        registryPath="/home/user/.tinker/acp/registry.json"
      />,
    );

    expect(markup).toContain('/home/user/.tinker/acp/registry.json');
  });

  it('shows empty state message when no agents registered', () => {
    const markup = renderToStaticMarkup(
      <CodingAgentsSection
        gooseInstalled
        gooseConnection={null}
        connectorStates={[]}
      />,
    );

    expect(markup).toContain('No agents registered');
  });
});

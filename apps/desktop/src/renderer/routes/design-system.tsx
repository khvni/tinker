import { useState, type CSSProperties, type JSX, type ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Button,
  ClickableBadge,
  ComposerChip,
  ConnectionGate,
  ConnectionSplash,
  ContextBadge,
  EmptyState,
  IconButton,
  KeyboardHint,
  Modal,
  ModelPicker,
  Progress,
  PromptComposer,
  SearchInput,
  SegmentedControl,
  SelectFolderButton,
  Skeleton,
  StatusDot,
  TextInput,
  Textarea,
  Toggle,
  ToastProvider,
  useToast,
  type AvatarSize,
  type BadgeVariant,
  type ConnectionService,
  type ModelPickerItem,
  type ProgressSpinnerSize,
  type StatusDotState,
} from '@tinker/design';
import '@tinker/design/styles/tokens.css';
import {
  SettingsShell,
  type SettingsShellSection,
} from '../workspace/components/SettingsShell/index.js';
import { AccountPanel } from '../workspace/components/AccountPanel/index.js';
import { Titlebar } from '../workspace/components/Titlebar/index.js';
import { ModeToggle } from '../panes/Chat/components/ModeToggle/index.js';
import { ReasoningPicker } from '../panes/Chat/components/ReasoningPicker/index.js';
import type { ReasoningLevel } from '@tinker/shared-types';
import { SignIn } from './SignIn/index.js';
import { MemorySidebar } from '../panes/MemoryPane/components/MemorySidebar/index.js';
import {
  PREVIEW_MEMORY_BUCKETS,
  PREVIEW_MEMORY_REFERENCE_TIME_MS,
} from '../panes/MemoryPane/memory-preview.js';
import './design-system.css';

type PlaygroundTab =
  | 'colors'
  | 'typography'
  | 'type-roles'
  | 'spacing'
  | 'components'
  | 'modelpicker'
  | 'modal'
  | 'toast'
  | 'empty'
  | 'chat'
  | 'settings-shell'
  | 'sign-in'
  | 'titlebar';

const TABS: ReadonlyArray<{ value: PlaygroundTab; label: string }> = [
  { value: 'colors', label: 'Colors' },
  { value: 'typography', label: 'Typography' },
  { value: 'type-roles', label: 'Type Roles (Paper 9J-0)' },
  { value: 'spacing', label: 'Spacing' },
  { value: 'components', label: 'Components' },
  { value: 'modelpicker', label: 'Model Picker' },
  { value: 'modal', label: 'Modal' },
  { value: 'toast', label: 'Toast' },
  { value: 'empty', label: 'Empty State' },
  { value: 'chat', label: 'Chat' },
  { value: 'settings-shell', label: 'Settings Shell' },
  { value: 'sign-in', label: 'Sign In' },
  { value: 'titlebar', label: 'Titlebar' },
];

const BADGE_VARIANTS: ReadonlyArray<{ variant: BadgeVariant; label: string }> = [
  { variant: 'default', label: 'Default' },
  { variant: 'success', label: 'Success' },
  { variant: 'error', label: 'Error' },
  { variant: 'warning', label: 'Warning' },
  { variant: 'info', label: 'Info' },
  { variant: 'accent', label: 'Accent' },
  { variant: 'skill', label: 'Skill' },
  { variant: 'ghost', label: 'Ghost' },
];

const STATUS_DOTS: ReadonlyArray<{ state: StatusDotState; label: string }> = [
  { state: 'muted', label: 'Muted' },
  { state: 'constructive', label: 'Constructive' },
  { state: 'warning', label: 'Warning' },
  { state: 'danger', label: 'Danger' },
  { state: 'info', label: 'Info' },
  { state: 'claude', label: 'OpenCode' },
  { state: 'skill', label: 'Skill' },
  { state: 'pulse', label: 'Pulse' },
];

const CONTEXT_BADGE_STATES: ReadonlyArray<{
  label: string;
  percent: number;
  tokens: number;
  windowSize: number;
  model: string;
}> = [
  { label: 'Low', percent: 24, tokens: 48_320, windowSize: 200_000, model: 'claude-sonnet-4-6' },
  { label: 'Mid', percent: 64, tokens: 128_000, windowSize: 200_000, model: 'claude-sonnet-4-6' },
  { label: 'High', percent: 92, tokens: 184_320, windowSize: 200_000, model: 'claude-sonnet-4-6' },
];

const CONTEXT_BADGE_TOOLTIP_DEMO = {
  percent: 64,
  tokens: 128_000,
  windowSize: 200_000,
  model: 'claude-sonnet-4-6',
} as const;

const AVATAR_SIZES: ReadonlyArray<{ size: AvatarSize; label: string }> = [
  { size: 'xs', label: 'xs · 20' },
  { size: 'sm', label: 'sm · 24' },
  { size: 'md', label: 'md · 32' },
  { size: 'lg', label: 'lg · 40' },
];

const AVATAR_NAMES: ReadonlyArray<string> = [
  'Khani Bangalu',
  'Ada Lovelace',
  'Grace Hopper',
  'Linus Torvalds',
  'Margaret Hamilton',
  'Ken Thompson',
];

const PROGRESS_SPINNER_SIZES: ReadonlyArray<{ size: ProgressSpinnerSize; label: string }> = [
  { size: 'xs', label: 'xs · 12' },
  { size: 'sm', label: 'sm · 16' },
  { size: 'md', label: 'md · 24' },
];

const CONNECTION_GATE_PENDING: ReadonlyArray<ConnectionService> = [
  { id: 'qmd', label: 'qmd', status: 'pending' },
  { id: 'smart-connections', label: 'smart-connections', status: 'pending' },
  { id: 'exa', label: 'exa', status: 'pending' },
];

const CONNECTION_GATE_MIXED: ReadonlyArray<ConnectionService> = [
  { id: 'qmd', label: 'qmd', status: 'connected' },
  { id: 'smart-connections', label: 'smart-connections', status: 'pending' },
  { id: 'exa', label: 'exa', status: 'error', detail: 'Network timeout' },
];

const CONNECTION_GATE_DONE: ReadonlyArray<ConnectionService> = [
  { id: 'qmd', label: 'qmd', status: 'connected' },
  { id: 'smart-connections', label: 'smart-connections', status: 'connected' },
  { id: 'exa', label: 'exa', status: 'connected' },
];

const CONNECTION_SPLASH_SERVICES: ReadonlyArray<ConnectionService> = [
  { id: 'host', label: 'Host service', status: 'connected' },
  { id: 'auth', label: 'Auth sidecar', status: 'connected' },
  { id: 'opencode', label: 'OpenCode', status: 'pending' },
  { id: 'mcps', label: 'MCP servers (qmd, smart-connections, exa)', status: 'pending' },
];

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 5h10M6 5V3.5h4V5M5 5l.6 8h4.8L11 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RefreshIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 4v5h-5" />
  </svg>
);

const SpinnerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className="ds-spin"
    aria-hidden="true"
  >
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type SectionProps = {
  label: string;
  children: ReactNode;
};

const Section = ({ label, children }: SectionProps): JSX.Element => (
  <section className="ds-section">
    <p className="ds-section__label">{label}</p>
    <div className="ds-section__content">{children}</div>
  </section>
);

const Row = ({ children }: { children: ReactNode }): JSX.Element => (
  <div className="ds-row">{children}</div>
);

const ComponentsTab = (): JSX.Element => {
  const [segValue, setSegValue] = useState<'first' | 'second' | 'third'>('first');
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('Multi-line note.\nSecond line stays aligned to same token set.');
  const [splashOpen, setSplashOpen] = useState(false);

  return (
    <div className="ds-sections">
      <Section label="Button">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Row>
        <Row>
          <Button variant="primary" size="s">
            Size S
          </Button>
          <Button variant="primary" size="m">
            Size M
          </Button>
        </Row>
        <Row>
          <Button variant="primary" leadingIcon={<PlusIcon />}>
            With Icon
          </Button>
          <Button variant="secondary" leadingIcon={<SettingsIcon />}>
            Settings
          </Button>
        </Row>
      </Section>

      <Section label="IconButton">
        <Row>
          <IconButton variant="secondary" icon={<SettingsIcon />} label="Settings" />
          <IconButton variant="secondary" icon={<RefreshIcon />} label="Refresh" />
          <IconButton variant="primary" icon={<PlusIcon />} label="Add" />
          <IconButton variant="secondary" icon={<PlusIcon />} label="Add outlined" />
          <IconButton variant="danger" icon={<TrashIcon />} label="Delete" />
          <IconButton variant="secondary" icon={<SettingsIcon />} label="More" />
          <IconButton variant="ghost" icon={<SpinnerIcon />} label="Loading" />
        </Row>
        <Row>
          <IconButton variant="ghost" size="s" icon={<SettingsIcon />} label="Settings small" />
          <IconButton variant="ghost" size="m" icon={<SettingsIcon />} label="Settings medium" />
          <IconButton variant="ghost" size="l" icon={<SettingsIcon />} label="Settings large" />
        </Row>
      </Section>

      <Section label="Badge">
        <Row>
          {BADGE_VARIANTS.map((item) => (
            <Badge key={item.variant} variant={item.variant}>
              {item.label}
            </Badge>
          ))}
        </Row>
        <Row>
          <Badge variant="success" icon={<CheckIcon />}>
            With Icon
          </Badge>
        </Row>
      </Section>

      <Section label="Clickable Badge (Button)">
        <Row>
          {BADGE_VARIANTS.map((item) => (
            <ClickableBadge key={item.variant} variant={item.variant}>
              {item.label}
            </ClickableBadge>
          ))}
        </Row>
        <Row>
          <ClickableBadge variant="info">To-Dos: 2/3</ClickableBadge>
        </Row>
      </Section>

      <Section label="StatusDot">
        <Row>
          {STATUS_DOTS.map((item) => (
            <span key={item.state} className="ds-status-item">
              <StatusDot state={item.state} label={item.label} />
              <span className="ds-status-item__label">{item.label}</span>
            </span>
          ))}
        </Row>
      </Section>

      <Section label="ContextBadge">
        <Row>
          {CONTEXT_BADGE_STATES.map((item) => (
            <span key={item.label} className="ds-status-item">
              <ContextBadge
                percent={item.percent}
                tokens={item.tokens}
                windowSize={item.windowSize}
                model={item.model}
              />
              <span className="ds-status-item__label">{item.label}</span>
            </span>
          ))}
        </Row>
        <div className="ds-context-badge-demo">
          <ContextBadge
            percent={CONTEXT_BADGE_TOOLTIP_DEMO.percent}
            tokens={CONTEXT_BADGE_TOOLTIP_DEMO.tokens}
            windowSize={CONTEXT_BADGE_TOOLTIP_DEMO.windowSize}
            model={CONTEXT_BADGE_TOOLTIP_DEMO.model}
          />
          <p className="ds-context-badge-demo__hint">Hover badge to inspect native tooltip counts.</p>
        </div>
      </Section>

      <Section label="Avatar">
        <Row>
          {AVATAR_SIZES.map((item) => (
            <span key={item.size} className="ds-status-item">
              <Avatar name="Khani Bangalu" size={item.size} />
              <span className="ds-status-item__label">{item.label}</span>
            </span>
          ))}
        </Row>
        <Row>
          {AVATAR_NAMES.map((name) => (
            <span key={name} className="ds-status-item">
              <Avatar name={name} size="md" />
              <span className="ds-status-item__label">{name}</span>
            </span>
          ))}
        </Row>
        <Row>
          <span className="ds-status-item">
            <Avatar
              name="Octocat"
              size="md"
              src="https://avatars.githubusercontent.com/u/583231?v=4"
            />
            <span className="ds-status-item__label">Image</span>
          </span>
          <span className="ds-status-item">
            <Avatar name="Missing Link" size="md" src="https://x.invalid/404.png" />
            <span className="ds-status-item__label">Broken src → initials</span>
          </span>
          <span className="ds-status-item">
            <Avatar name="" size="md" />
            <span className="ds-status-item__label">No name</span>
          </span>
        </Row>
      </Section>

      <Section label="Progress">
        <Row>
          <div className="ds-progress-bar-wrap">
            <Progress variant="bar" value={25} max={100} label="25%" />
            <span className="ds-status-item__label">Determinate · 25%</span>
          </div>
          <div className="ds-progress-bar-wrap">
            <Progress variant="bar" value={72} max={100} label="72%" />
            <span className="ds-status-item__label">Determinate · 72%</span>
          </div>
          <div className="ds-progress-bar-wrap">
            <Progress variant="bar" label="Working" />
            <span className="ds-status-item__label">Indeterminate</span>
          </div>
        </Row>
        <Row>
          {PROGRESS_SPINNER_SIZES.map((item) => (
            <span key={item.size} className="ds-status-item">
              <Progress variant="spinner" size={item.size} />
              <span className="ds-status-item__label">{item.label}</span>
            </span>
          ))}
        </Row>
      </Section>

      <Section label="ConnectionGate">
        <Row>
          <ConnectionGate services={CONNECTION_GATE_PENDING} title="Connecting tools…" />
          <ConnectionGate services={CONNECTION_GATE_MIXED} title="Connecting tools…" />
          <ConnectionGate services={CONNECTION_GATE_DONE} title="Ready" />
        </Row>
      </Section>

      <Section label="ConnectionSplash">
        <Row>
          <Button variant="secondary" onClick={() => setSplashOpen(true)}>
            Show splash overlay
          </Button>
        </Row>
        {splashOpen ? (
          <ConnectionSplash
            services={CONNECTION_SPLASH_SERVICES}
            subtitle="Boots your local host, auth sidecar, OpenCode, and MCP servers."
            onClick={() => setSplashOpen(false)}
          />
        ) : null}
      </Section>

      <Section label="SegmentedControl">
        <Row>
          <SegmentedControl<'first' | 'second' | 'third'>
            value={segValue}
            onChange={setSegValue}
            options={[
              { value: 'first', label: 'First' },
              { value: 'second', label: 'Second' },
              { value: 'third', label: 'Third' },
            ]}
            label="Segmented example"
          />
        </Row>
      </Section>

      <Section label="Toggle">
        <Row>
          <span className="ds-toggle-item">
            <Toggle checked={toggleOn} onChange={setToggleOn} label="Enabled toggle" />
            <span className="ds-status-item__label">Enabled</span>
          </span>
          <span className="ds-toggle-item">
            <Toggle checked={toggleOff} onChange={setToggleOff} label="Disabled look toggle" />
            <span className="ds-status-item__label">Disabled look</span>
          </span>
          <span className="ds-toggle-item">
            <Toggle checked={false} onChange={() => undefined} label="Disabled toggle" disabled />
            <span className="ds-status-item__label">Disabled</span>
          </span>
        </Row>
      </Section>

      <Section label="TextInput">
        <Row>
          <div className="ds-input-wrap">
            <TextInput
              placeholder="Type something..."
              value={textValue}
              onChange={(event) => setTextValue(event.target.value)}
            />
          </div>
        </Row>
      </Section>

      <Section label="SearchInput">
        <Row>
          <div className="ds-input-wrap">
            <SearchInput
              placeholder="Search..."
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>
        </Row>
      </Section>

      <Section label="SelectFolderButton">
        <Row>
          <SelectFolderButton onClick={() => {}} />
          <SelectFolderButton folderPath="/Users/khani/projects/tinker" onClick={() => {}} />
          <SelectFolderButton folderPath="/Users/khani/projects/tinker" loading onClick={() => {}} />
          <SelectFolderButton disabled onClick={() => {}} />
        </Row>
      </Section>

      <Section label="Textarea">
        <Row>
          <div className="ds-input-wrap">
            <Textarea
              rows={5}
              placeholder="Write more than one line..."
              value={textareaValue}
              onChange={(event) => setTextareaValue(event.target.value)}
            />
          </div>
        </Row>
      </Section>

      <Section label="Skeleton">
        <Row>
          <span className="ds-status-item">
            <Skeleton variant="text" width={160} />
            <span className="ds-status-item__label">text</span>
          </span>
          <span className="ds-status-item">
            <Skeleton variant="circle" width={32} />
            <span className="ds-status-item__label">circle</span>
          </span>
          <span className="ds-status-item">
            <Skeleton variant="rect" width={180} height={96} />
            <span className="ds-status-item__label">rect</span>
          </span>
        </Row>
        <div className="ds-skeleton-composed">
          <Skeleton variant="circle" width={28} />
          <div className="ds-skeleton-composed__lines">
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="40%" />
          </div>
        </div>
      </Section>

      <Section label="KeyboardHint">
        <Row>
          <span className="ds-status-item">
            <KeyboardHint keys={['Esc']} os="mac" />
            <span className="ds-status-item__label">single</span>
          </span>
          <span className="ds-status-item">
            <KeyboardHint keys={['Cmd', 'K']} os="mac" />
            <span className="ds-status-item__label">two-key (mac)</span>
          </span>
          <span className="ds-status-item">
            <KeyboardHint keys={['Cmd', 'Shift', 'P']} os="mac" />
            <span className="ds-status-item__label">three-key (mac)</span>
          </span>
        </Row>
        <Row>
          <span className="ds-status-item">
            <KeyboardHint keys={['Cmd', 'K']} os="other" />
            <span className="ds-status-item__label">two-key (win/linux)</span>
          </span>
          <span className="ds-status-item">
            <KeyboardHint keys={['Alt', 'T']} os="other" />
            <span className="ds-status-item__label">toggle disclosures</span>
          </span>
          <span className="ds-status-item">
            <KeyboardHint keys={['Ctrl', 'Shift', 'Enter']} os="other" />
            <span className="ds-status-item__label">wide modifier</span>
          </span>
        </Row>
      </Section>
    </div>
  );
};

/* --------------------- Model Picker --------------------- */

const MODEL_PICKER_ITEMS: ReadonlyArray<ModelPickerItem> = [
  {
    id: 'anthropic:claude-opus-4',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    name: 'Claude Opus 4',
    contextWindow: 200_000,
    pricingHint: '$15/Mtok',
  },
  {
    id: 'anthropic:claude-sonnet-4',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    name: 'Claude Sonnet 4',
    contextWindow: 200_000,
    pricingHint: '$3/Mtok',
  },
  {
    id: 'anthropic:claude-haiku-4',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    name: 'Claude Haiku 4',
    contextWindow: 200_000,
    pricingHint: '$0.25/Mtok',
  },
  {
    id: 'openai:gpt-5',
    providerId: 'openai',
    providerName: 'OpenAI',
    name: 'GPT-5',
    contextWindow: 1_000_000,
    pricingHint: '$10/Mtok',
  },
  {
    id: 'openai:gpt-5-mini',
    providerId: 'openai',
    providerName: 'OpenAI',
    name: 'GPT-5 Mini',
    contextWindow: 400_000,
    pricingHint: '$0.40/Mtok',
  },
  {
    id: 'openai:o4',
    providerId: 'openai',
    providerName: 'OpenAI',
    name: 'o4',
    contextWindow: 200_000,
  },
  {
    id: 'google:gemini-2.5-pro',
    providerId: 'google',
    providerName: 'Google',
    name: 'Gemini 2.5 Pro',
    contextWindow: 2_000_000,
    pricingHint: '$7/Mtok',
  },
  {
    id: 'google:gemini-2.5-flash',
    providerId: 'google',
    providerName: 'Google',
    name: 'Gemini 2.5 Flash',
    contextWindow: 1_000_000,
    pricingHint: '$0.30/Mtok',
  },
  {
    id: 'openrouter:llama-4-scout',
    providerId: 'openrouter',
    providerName: 'OpenRouter',
    name: 'Llama 4 Scout',
    contextWindow: 128_000,
  },
  {
    id: 'openrouter:qwen-2.5-coder',
    providerId: 'openrouter',
    providerName: 'OpenRouter',
    name: 'Qwen 2.5 Coder',
    contextWindow: 128_000,
    pricingHint: '$0.50/Mtok',
  },
  {
    id: 'openrouter:deepseek-v3',
    providerId: 'openrouter',
    providerName: 'OpenRouter',
    name: 'DeepSeek V3',
    contextWindow: 128_000,
  },
];

const ModelPickerTab = (): JSX.Element => {
  const [openValue, setOpenValue] = useState<string | undefined>('anthropic:claude-sonnet-4');
  const [mode, setMode] = useState<'build' | 'plan'>('build');
  const [reasoning, setReasoning] = useState<ReasoningLevel>('medium');

  return (
    <div className="ds-sections">
      <Section label="Closed">
        <Row>
          <ModelPicker
            items={MODEL_PICKER_ITEMS}
            onSelect={() => undefined}
          />
        </Row>
      </Section>

      <Section label="Open">
        <Row>
          <div className="ds-modelpicker-anchor">
            <ModelPicker
              items={MODEL_PICKER_ITEMS}
              value={openValue}
              onSelect={setOpenValue}
              defaultOpen
            />
          </div>
        </Row>
      </Section>

      <Section label="Loading">
        <Row>
          <div className="ds-modelpicker-anchor">
            <ModelPicker
              items={[]}
              onSelect={() => undefined}
              loading
              defaultOpen
            />
          </div>
        </Row>
      </Section>

      <Section label="Empty">
        <Row>
          <div className="ds-modelpicker-anchor">
            <ModelPicker
              items={[]}
              onSelect={() => undefined}
              defaultOpen
            />
          </div>
        </Row>
      </Section>

      <Section label="Long filter">
        <Row>
          <div className="ds-modelpicker-anchor">
            <ModelPicker
              items={MODEL_PICKER_ITEMS}
              onSelect={() => undefined}
              defaultOpen
              defaultFilter="deepseek"
            />
          </div>
        </Row>
      </Section>

      <Section label="Chat header controls">
        <Row>
          <ModelPicker
            items={MODEL_PICKER_ITEMS}
            value={openValue}
            onSelect={setOpenValue}
          />
          <ModeToggle value={mode} onChange={setMode} />
          <ReasoningPicker value={reasoning} onChange={setReasoning} />
          <ContextBadge
            percent={58}
            tokens={116_000}
            windowSize={200_000}
            model="Anthropic Claude Sonnet 4"
          />
          <Badge variant={mode === 'plan' ? 'info' : 'default'}>
            {mode === 'plan' ? 'Plan · read-only' : 'Build · can edit'}
          </Badge>
        </Row>
        <Row>
          <ModeToggle value="build" onChange={() => undefined} />
          <Badge variant="default">Build state</Badge>
          <ModeToggle value="plan" onChange={() => undefined} />
          <Badge variant="info">Plan state</Badge>
        </Row>
        <p className="ds-status-item__label">
          Reasoning picker renders only for reasoning-capable models in the live chat pane.
        </p>
      </Section>
    </div>
  );
};

/* ------------------------- Colors ------------------------- */

type Swatch = { name: string; varName: string; hex: string; note?: string };

const SURFACE_SWATCHES: ReadonlyArray<Swatch> = [
  { name: 'bg-primary', varName: '--color-bg-primary', hex: '#fefcf8', note: 'canvas · dark #1a1612' },
  { name: 'bg-elevated', varName: '--color-bg-elevated', hex: '#ffffff', note: 'cards / modals · dark #221d17' },
  { name: 'bg-panel', varName: '--color-bg-panel', hex: '#f9f5ec', note: 'sidebar · dark #16120e' },
  { name: 'bg-input', varName: '--color-bg-input', hex: '#fefcf8', note: 'inputs · dark #120f0c' },
  { name: 'bg-hover', varName: '--color-bg-hover', hex: '#f4efe4', note: 'interactive hover · dark #25201a' },
];

const TEXT_SWATCHES: ReadonlyArray<Swatch> = [
  { name: 'text-primary', varName: '--color-text-primary', hex: '#1a1612', note: 'dark #f5efe6' },
  { name: 'text-secondary', varName: '--color-text-secondary', hex: '#5f564c', note: 'dark #a8a097' },
  { name: 'text-muted', varName: '--color-text-muted', hex: '#a8a097', note: 'dark #6f665c' },
  { name: 'text-inverse', varName: '--color-text-inverse', hex: '#fbf8f2', note: 'text on dark surfaces' },
];

const ACCENT_SWATCHES: ReadonlyArray<Swatch> = [
  { name: 'accent', varName: '--color-accent', hex: '#f9c041', note: 'brand constant both themes' },
  { name: 'accent-strong', varName: '--color-accent-strong', hex: '#e5ad2d', note: 'hover' },
  { name: 'accent-soft', varName: '--color-accent-soft', hex: 'rgba(249,192,65,0.22)', note: 'tint · dark 0.18' },
  { name: 'accent-ink', varName: '--color-accent-ink', hex: '#1a1612', note: 'ink on accent · dark #201402' },
];

const SEMANTIC_SWATCHES: ReadonlyArray<Swatch> = [
  { name: 'success', varName: '--color-success', hex: '#22a355', note: 'dark #4ade80' },
  { name: 'error', varName: '--color-error', hex: '#d33030', note: 'dark #ef4444' },
  { name: 'warning', varName: '--color-warning', hex: '#d48806', note: 'dark #f59e0b' },
  { name: 'info', varName: '--color-info', hex: '#2d6ecb', note: 'Toggle ON · dark #60a5fa' },
  { name: 'skill', varName: '--color-skill', hex: '#7255d9', note: 'dark #a78bfa' },
  { name: 'claude', varName: '--color-claude', hex: '#d5a82e', note: 'OpenCode dot · dark #f2c94c' },
  { name: 'muted', varName: '--color-muted', hex: '#a8a097', note: 'dark #6b625a' },
];

const SwatchTile = ({ swatch }: { swatch: Swatch }): JSX.Element => (
  <div className="ds-swatch">
    <div className="ds-swatch__chip" style={{ background: `var(${swatch.varName})` }} />
    <div className="ds-swatch__meta">
      <span className="ds-swatch__name">{swatch.name}</span>
      <span className="ds-swatch__hex">{swatch.hex}</span>
      {swatch.note ? <span className="ds-swatch__note">{swatch.note}</span> : null}
    </div>
  </div>
);

const ColorsTab = (): JSX.Element => (
  <div className="ds-sections">
    <Section label="Surfaces">
      <div className="ds-swatch-grid">
        {SURFACE_SWATCHES.map((s) => (
          <SwatchTile key={s.name} swatch={s} />
        ))}
      </div>
    </Section>
    <Section label="Text">
      <div className="ds-swatch-grid">
        {TEXT_SWATCHES.map((s) => (
          <SwatchTile key={s.name} swatch={s} />
        ))}
      </div>
    </Section>
    <Section label="Accent (amber)">
      <div className="ds-swatch-grid">
        {ACCENT_SWATCHES.map((s) => (
          <SwatchTile key={s.name} swatch={s} />
        ))}
      </div>
    </Section>
    <Section label="Semantic + status">
      <div className="ds-swatch-grid">
        {SEMANTIC_SWATCHES.map((s) => (
          <SwatchTile key={s.name} swatch={s} />
        ))}
      </div>
    </Section>
  </div>
);

/* ---------------------- Typography ----------------------- */

const TYPE_SIZES: ReadonlyArray<{ name: string; varName: string; px: string }> = [
  { name: 'xxl', varName: '--font-size-xxl', px: '28px' },
  { name: 'xl', varName: '--font-size-xl', px: '20px' },
  { name: 'lg', varName: '--font-size-lg', px: '16px' },
  { name: 'md', varName: '--font-size-md', px: '14px' },
  { name: 'base', varName: '--font-size-base', px: '13px' },
  { name: 'sm', varName: '--font-size-sm', px: '12px' },
  { name: 'xs', varName: '--font-size-xs', px: '11px' },
];

const TYPE_WEIGHTS: ReadonlyArray<{ name: string; varName: string; num: string }> = [
  { name: 'regular', varName: '--font-weight-regular', num: '400' },
  { name: 'medium', varName: '--font-weight-medium', num: '500' },
  { name: 'semibold', varName: '--font-weight-semibold', num: '600' },
  { name: 'bold', varName: '--font-weight-bold', num: '700' },
];

const TypographyTab = (): JSX.Element => (
  <div className="ds-sections">
    <Section label="Family">
      <div className="ds-type-family">
        <p className="ds-type-family__name">Host Grotesk Variable</p>
        <p className="ds-type-family__stack">
          --font-sans = Host Grotesk Variable, -apple-system, BlinkMacSystemFont, Inter, system-ui
        </p>
        <p className="ds-type-family__specimen">The quick brown fox jumps over the lazy dog.</p>
      </div>
    </Section>

    <Section label="Size scale">
      <div className="ds-type-scale">
        {TYPE_SIZES.map((s) => (
          <div key={s.name} className="ds-type-row" style={{ fontSize: `var(${s.varName})` }}>
            <span className="ds-type-row__sample">Raise the floor</span>
            <span className="ds-type-row__meta">
              {s.name} · {s.px} · <code>{s.varName}</code>
            </span>
          </div>
        ))}
      </div>
    </Section>

    <Section label="Weight">
      <div className="ds-type-scale">
        {TYPE_WEIGHTS.map((w) => (
          <div key={w.name} className="ds-type-row" style={{ fontWeight: `var(${w.varName})` as unknown as number }}>
            <span className="ds-type-row__sample">Tinker workspace</span>
            <span className="ds-type-row__meta">
              {w.name} · {w.num} · <code>{w.varName}</code>
            </span>
          </div>
        ))}
      </div>
    </Section>

    <Section label="Label (uppercase, tracked)">
      <p className="ds-section__label" style={{ margin: 0 }}>
        Section eyebrow
      </p>
      <p className="ds-type-row__meta" style={{ marginTop: 6 }}>
        font-size xs · weight semibold · letter-spacing 0.08em · uppercase
      </p>
    </Section>
  </div>
);

/* ---------------------- Type Roles ----------------------- */

type TypeRoleRow = {
  role: string;
  sample: string;
  sizeVar: string;
  weightVar: string;
  lineHeightVar: string;
  fontFamily: 'sans' | 'mono';
  uppercase?: boolean;
  letterSpacingVar?: string;
  tokenSummary: string;
};

const TYPE_ROLE_ROWS: ReadonlyArray<TypeRoleRow> = [
  {
    role: 'Display',
    sample: 'Aa · Host Grotesk 700 · 28',
    sizeVar: '--font-size-display',
    weightVar: '--font-weight-display',
    lineHeightVar: '--line-height-display',
    fontFamily: 'sans',
    tokenSummary: 'size-display · weight-display · lh-display',
  },
  {
    role: 'H2',
    sample: 'Aa · Host Grotesk 600 · 20',
    sizeVar: '--font-size-h2',
    weightVar: '--font-weight-h2',
    lineHeightVar: '--line-height-h2',
    fontFamily: 'sans',
    tokenSummary: 'size-h2 · weight-h2 · lh-h2',
  },
  {
    role: 'H3',
    sample: 'Aa · Host Grotesk 500 · 16',
    sizeVar: '--font-size-h3',
    weightVar: '--font-weight-h3',
    lineHeightVar: '--line-height-h3',
    fontFamily: 'sans',
    tokenSummary: 'size-h3 · weight-h3 · lh-h3',
  },
  {
    role: 'Body',
    sample: 'Aa · Host Grotesk 400 · 14 — body copy sits here, comfortable line-height 1.45.',
    sizeVar: '--font-size-body',
    weightVar: '--font-weight-body',
    lineHeightVar: '--line-height-body',
    fontFamily: 'sans',
    tokenSummary: 'size-body · weight-body · lh-body',
  },
  {
    role: 'Secondary',
    sample: 'Aa · 13 secondary · metadata, captions',
    sizeVar: '--font-size-secondary',
    weightVar: '--font-weight-regular',
    lineHeightVar: '--line-height-secondary',
    fontFamily: 'sans',
    tokenSummary: 'size-secondary · weight-regular · lh-secondary',
  },
  {
    role: 'Label',
    sample: 'Aa · 11 label · uppercase 0.08em',
    sizeVar: '--font-size-label',
    weightVar: '--font-weight-medium',
    lineHeightVar: '--line-height-label',
    fontFamily: 'sans',
    uppercase: true,
    letterSpacingVar: '--letter-spacing-label',
    tokenSummary: 'size-label · weight-medium · lh-label · letter-spacing-label',
  },
  {
    role: 'Mono',
    sample: 'Aa · JetBrains Mono 400 · 12 — tabular-nums 012,345',
    sizeVar: '--font-size-mono',
    weightVar: '--font-weight-regular',
    lineHeightVar: '--line-height-mono',
    fontFamily: 'mono',
    tokenSummary: 'size-mono · weight-regular · lh-mono · font-mono',
  },
];

const TypeRoleSample = ({ row }: { row: TypeRoleRow }): JSX.Element => {
  const style: CSSProperties = {
    fontFamily: row.fontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
    fontSize: `var(${row.sizeVar})`,
    fontWeight: `var(${row.weightVar})` as unknown as number,
    lineHeight: `var(${row.lineHeightVar})`,
    color: 'var(--color-text-primary)',
  };
  if (row.uppercase) {
    style.textTransform = 'uppercase';
  }
  if (row.letterSpacingVar) {
    style.letterSpacing = `var(${row.letterSpacingVar})`;
  }
  if (row.fontFamily === 'mono') {
    style.fontVariantNumeric = 'tabular-nums';
  }
  return <div style={style}>{row.sample}</div>;
};

const TypeRolesTab = (): JSX.Element => (
  <div className="ds-sections">
    <Section label="Paper 9J-0 parity · 7 roles">
      <p className="ds-type-roles-lede">
        Mirrors the TEXT section on Paper artboard 9J-0 ("Tinker Tokens — Light"). Each row
        exercises a role token group — size, weight, and line-height wired to the new
        <code> --font-*-{'{'}role{'}'}</code> vars. Light mode is the default; the display
        weight shifts to 600 under <code>[data-theme="dark"]</code>.
      </p>
      <div className="ds-type-roles-list">
        {TYPE_ROLE_ROWS.map((row) => (
          <div key={row.role} className="ds-type-role-row">
            <span className="ds-type-role-row__label">{row.role}</span>
            <div className="ds-type-role-row__sample">
              <TypeRoleSample row={row} />
            </div>
            <span className="ds-type-role-row__tokens">{row.tokenSummary}</span>
          </div>
        ))}
      </div>
    </Section>

    <Section label="Dark preview (display shifts to weight 600)">
      <div className="ds-type-roles-dark" data-theme="dark">
        <p className="ds-type-roles-lede">
          Same rows re-rendered inside a <code>data-theme="dark"</code> scope to verify the
          display weight flips per Paper 6M-0.
        </p>
        <div className="ds-type-roles-list">
          {TYPE_ROLE_ROWS.map((row) => (
            <div key={row.role} className="ds-type-role-row">
              <span className="ds-type-role-row__label">{row.role}</span>
              <div className="ds-type-role-row__sample">
                <TypeRoleSample row={row} />
              </div>
              <span className="ds-type-role-row__tokens">{row.tokenSummary}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  </div>
);

/* ------------------------ Spacing ------------------------ */

const SPACE_SCALE: ReadonlyArray<{ name: string; varName: string; px: string }> = [
  { name: 'space-1', varName: '--space-1', px: '4px' },
  { name: 'space-2', varName: '--space-2', px: '8px' },
  { name: 'space-3', varName: '--space-3', px: '12px' },
  { name: 'space-4', varName: '--space-4', px: '16px' },
  { name: 'space-5', varName: '--space-5', px: '20px' },
  { name: 'space-6', varName: '--space-6', px: '24px' },
  { name: 'space-8', varName: '--space-8', px: '32px' },
  { name: 'space-10', varName: '--space-10', px: '40px' },
  { name: 'space-12', varName: '--space-12', px: '48px' },
];

const RADIUS_SCALE: ReadonlyArray<{ name: string; varName: string; px: string }> = [
  { name: 'xs', varName: '--radius-xs', px: '4px' },
  { name: 'sm', varName: '--radius-sm', px: '6px' },
  { name: 'md', varName: '--radius-md', px: '8px' },
  { name: 'lg', varName: '--radius-lg', px: '12px' },
  { name: 'pill', varName: '--radius-pill', px: '9999px' },
];

const SpacingTab = (): JSX.Element => (
  <div className="ds-sections">
    <Section label="Scale (4px base)">
      <div className="ds-space-scale">
        {SPACE_SCALE.map((s) => (
          <div key={s.name} className="ds-space-row">
            <span className="ds-space-row__bar" style={{ width: `var(${s.varName})` }} />
            <span className="ds-space-row__meta">
              {s.name} · {s.px} · <code>{s.varName}</code>
            </span>
          </div>
        ))}
      </div>
    </Section>

    <Section label="Radius">
      <div className="ds-radius-grid">
        {RADIUS_SCALE.map((r) => (
          <div key={r.name} className="ds-radius-item">
            <div className="ds-radius-item__chip" style={{ borderRadius: `var(${r.varName})` }} />
            <span className="ds-radius-item__meta">
              {r.name} · {r.px}
            </span>
          </div>
        ))}
      </div>
    </Section>
  </div>
);

/* ------------------------- Modal ------------------------- */

const ModalTab = (): JSX.Element => {
  const [basicOpen, setBasicOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [longOpen, setLongOpen] = useState(false);

  return (
    <div className="ds-sections">
      <Section label="Basic confirm">
        <Row>
          <Button variant="primary" onClick={() => setBasicOpen(true)}>
            Open modal
          </Button>
        </Row>
        <Modal
          open={basicOpen}
          onClose={() => setBasicOpen(false)}
          title="Rename vault"
          actions={
            <>
              <Button variant="ghost" onClick={() => setBasicOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setBasicOpen(false)}>
                Rename
              </Button>
            </>
          }
        >
          <p>Enter a new label for this vault. It only affects how Tinker displays the vault in the sidebar.</p>
          <div className="ds-input-wrap">
            <TextInput placeholder="Vault name" defaultValue="Daily workspace" />
          </div>
        </Modal>
      </Section>

      <Section label="Destructive">
        <Row>
          <Button variant="danger" onClick={() => setDestructiveOpen(true)}>
            Delete session
          </Button>
        </Row>
        <Modal
          open={destructiveOpen}
          onClose={() => setDestructiveOpen(false)}
          title="Delete this session"
          actions={
            <>
              <Button variant="ghost" onClick={() => setDestructiveOpen(false)}>
                Keep
              </Button>
              <Button variant="danger" onClick={() => setDestructiveOpen(false)}>
                Delete
              </Button>
            </>
          }
        >
          <p>The transcript and any streamed tool output will be removed from local state. Vault memory is unaffected.</p>
        </Modal>
      </Section>

      <Section label="Long content">
        <Row>
          <Button variant="secondary" onClick={() => setLongOpen(true)}>
            Open long modal
          </Button>
        </Row>
        <Modal
          open={longOpen}
          onClose={() => setLongOpen(false)}
          title="About memory injection"
          actions={<Button variant="primary" onClick={() => setLongOpen(false)}>Got it</Button>}
        >
          <p>Memory injection resolves the top relevant entities for the current prompt, then rewrites the session prelude before dispatching to OpenCode.</p>
          <p>Only the top N entities are ever included, to keep token spend predictable on long histories.</p>
          <p>Relevance scoring uses a cached embedding, and the injection path falls back to raw note titles if the embedding cache is unavailable.</p>
          <p>Scroll to see how the body stays inside the card while header and footer remain anchored.</p>
          <p>Scroll to see how the body stays inside the card while header and footer remain anchored.</p>
          <p>Scroll to see how the body stays inside the card while header and footer remain anchored.</p>
        </Modal>
      </Section>
    </div>
  );
};

/* ------------------------- Toast ------------------------- */

const ToastTabInner = (): JSX.Element => {
  const { show } = useToast();
  return (
    <div className="ds-sections">
      <Section label="Variants">
        <Row>
          <Button variant="secondary" onClick={() => show({ title: 'Note indexed', variant: 'info' })}>
            Info
          </Button>
          <Button variant="secondary" onClick={() => show({ title: 'Vault synced', description: 'All 42 notes up to date.', variant: 'success' })}>
            Success
          </Button>
          <Button variant="secondary" onClick={() => show({ title: 'Rate limit approaching', description: '80% of your model quota used today.', variant: 'warning' })}>
            Warning
          </Button>
          <Button variant="secondary" onClick={() => show({ title: 'OpenCode disconnected', description: 'Sidecar exited unexpectedly.', variant: 'error' })}>
            Error
          </Button>
        </Row>
      </Section>

      <Section label="With action">
        <Row>
          <Button
            variant="secondary"
            onClick={() =>
              show({
                title: 'Skill added',
                description: 'coach was pinned to this session.',
                variant: 'success',
                actionLabel: 'Undo',
                onAction: () => show({ title: 'Skill removed', variant: 'info' }),
              })
            }
          >
            Trigger with undo
          </Button>
        </Row>
      </Section>

      <Section label="Persistent">
        <Row>
          <Button
            variant="secondary"
            onClick={() =>
              show({
                title: 'Stuck until dismissed',
                description: 'Pass durationMs: 0 to pin the toast.',
                durationMs: 0,
              })
            }
          >
            Show persistent
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              show({ title: 'Note indexed', variant: 'info', durationMs: 0 });
              show({ title: 'Vault synced', description: 'All 42 notes up to date.', variant: 'success', durationMs: 0 });
              show({ title: 'Rate limit approaching', description: '80% of your model quota used today.', variant: 'warning', durationMs: 0 });
              show({ title: 'OpenCode disconnected', description: 'Sidecar exited unexpectedly.', variant: 'error', durationMs: 0 });
            }}
          >
            Show all (pinned)
          </Button>
        </Row>
      </Section>
    </div>
  );
};

const ToastTab = (): JSX.Element => (
  <ToastProvider>
    <ToastTabInner />
  </ToastProvider>
);

/* ---------------------- Empty State ---------------------- */

const EmptyStateTab = (): JSX.Element => (
  <div className="ds-sections">
    <Section label="Chat — no messages">
      <EmptyState
        title="Start a conversation"
        description="Ask Tinker a question. Messages stream from OpenCode over HTTP + SSE."
        icon={
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 6.5C4 5.12 5.12 4 6.5 4h11C18.88 4 20 5.12 20 6.5v8c0 1.38-1.12 2.5-2.5 2.5H10l-4 3v-3H6.5C5.12 17 4 15.88 4 14.5v-8Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        }
      />
    </Section>

    <Section label="Memory — no notes yet">
      <EmptyState
        title="No indexed notes yet"
        description="Connect a vault or create the default one. Tinker will surface recent notes and entities here."
        icon={
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M6 4.5h9l3 3v12a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 4.5 19.5v-13.5A1.5 1.5 0 0 1 6 4.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M8 12h8M8 15.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        }
        action={<Button variant="secondary" size="s">Run memory sweep</Button>}
      />
    </Section>

    <Section label="Memory sidebar (TIN-196)">
      <MemorySidebarPlayground />
    </Section>

    <Section label="Connections — none connected">
      <EmptyState
        size="s"
        align="start"
        title="No connections yet"
        description="Sign in with Google or GitHub to light up your connected tools. Tinker still works as a local coding agent without them."
        icon={
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 14a4 4 0 0 0 5.66 0l2.5-2.5a4 4 0 1 0-5.66-5.66L11 7.34"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 10a4 4 0 0 0-5.66 0l-2.5 2.5a4 4 0 1 0 5.66 5.66L13 16.66"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      />
    </Section>
  </div>
);

/* -------------------------- Chat ------------------------- */

type ChatMode = 'chat' | 'plan';

const EmptyChatIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 6.5C4 5.12 5.12 4 6.5 4h11C18.88 4 20 5.12 20 6.5v8c0 1.38-1.12 2.5-2.5 2.5H10l-4 3v-3H6.5C5.12 17 4 15.88 4 14.5v-8Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

type ChatChromeProps = {
  message: string;
  onMessageChange: (value: string) => void;
  mode: ChatMode;
  onModeChange: (next: ChatMode) => void;
  showHistory: boolean;
};

const ChatPaneChrome = ({
  message,
  onMessageChange,
  mode,
  onModeChange,
  showHistory,
}: ChatChromeProps): JSX.Element => {
  const modelId = MODEL_PICKER_ITEMS[0]?.id;
  const modelName = MODEL_PICKER_ITEMS[0]?.name ?? 'Claude Sonnet';
  const windowSize = MODEL_PICKER_ITEMS[0]?.contextWindow ?? 200_000;
  return (
    <div className="ds-chat-frame">
      <section className="tinker-pane tinker-pane--chat">
        <header className="tinker-chat-header">
          <div className="tinker-chat-header__left">
            <span className="tinker-chat-legend" title="Toggle thinking + tool disclosures (Alt+T)">
              ⌥T thinking
            </span>
          </div>
          <div className="tinker-chat-header__right">
            <ContextBadge
              percent={57}
              tokens={Math.round(windowSize * 0.57)}
              windowSize={windowSize}
              model={modelName}
            />
            <Badge variant="default" size="small">
              OpenCode is ready.
            </Badge>
            <Button variant="ghost" size="s">
              New chat tab
            </Button>
          </div>
        </header>

        <div className="tinker-chat-log" tabIndex={-1}>
          {showHistory ? (
            <>
              <div className="tinker-message tinker-message--user">
                Pull yesterday&apos;s spend anomalies from Ramp, draft a Slack summary.
              </div>
              <div className="tinker-message tinker-message--assistant">
                <p className="tinker-message-text">
                  Found 4 anomalies over $2k. Top offender: vendor &ldquo;Acme Cloud&rdquo;
                  (+312% vs 7d avg). Drafting summary.
                </p>
              </div>
              <div className="tinker-message tinker-message--system">
                Scheduling daily sweep at 08:00 · see Today pane
              </div>
            </>
          ) : (
            <EmptyState
              title="Start a conversation"
              description="Ask Tinker a question. Messages stream from OpenCode over HTTP + SSE."
              icon={<EmptyChatIcon />}
            />
          )}
        </div>

        <div className="tinker-composer-card__wrap">
          <PromptComposer
            value={message}
            onChange={onMessageChange}
            onSubmit={() => undefined}
            attachLabel="Attachments coming soon"
            attachDisabled
            controls={
              <>
                <ComposerChip label={mode === 'plan' ? 'Plan' : 'Build'} onClick={() => onModeChange(mode === 'plan' ? 'chat' : 'plan')} />
                <ModelPicker
                  items={MODEL_PICKER_ITEMS}
                  value={modelId}
                  onSelect={() => undefined}
                  emptyLabel="No models available."
                />
                <ComposerChip label="Default" />
              </>
            }
          />
        </div>
      </section>
    </div>
  );
};

const ChatTab = (): JSX.Element => {
  const [withHistoryMessage, setWithHistoryMessage] = useState('');
  const [emptyMessage, setEmptyMessage] = useState('');
  const [mode, setMode] = useState<ChatMode>('chat');
  return (
    <div className="ds-sections">
      <Section label="Chat — with history">
        <ChatPaneChrome
          message={withHistoryMessage}
          onMessageChange={setWithHistoryMessage}
          mode={mode}
          onModeChange={setMode}
          showHistory
        />
      </Section>

      <Section label="Chat — empty state (first message)">
        <ChatPaneChrome
          message={emptyMessage}
          onMessageChange={setEmptyMessage}
          mode={mode}
          onModeChange={setMode}
          showHistory={false}
        />
      </Section>
    </div>
  );
};

/* -------------------- Settings Shell --------------------- */

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MemoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3h6" />
    <path d="M9 21h6" />
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="M9 10h6M9 14h4" />
  </svg>
);

const PlugIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22v-5" />
    <path d="M9 7V2" />
    <path d="M15 7V2" />
    <path d="M6 13V8h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" />
  </svg>
);

const DisplayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="14" rx="2" />
    <path d="M8 21h8" />
    <path d="M12 18v3" />
  </svg>
);

const SettingsSectionBody = ({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children?: ReactNode;
}): JSX.Element => (
  <div className="ds-settings-body">
    <p className="ds-settings-body__eyebrow">{eyebrow}</p>
    <h2 className="ds-settings-body__title">{title}</h2>
    <p className="ds-settings-body__lede">{lede}</p>
    {children ? <div className="ds-settings-body__content">{children}</div> : null}
  </div>
);

const SAMPLE_ACCOUNT_SESSION = {
  provider: 'google' as const,
  userId: 'demo-user',
  email: 'demo@tinker.local',
  displayName: 'Demo User',
  accessToken: '',
  refreshToken: '',
  expiresAt: new Date().toISOString(),
  scopes: [],
};

const SETTINGS_SECTIONS: ReadonlyArray<SettingsShellSection> = [
  {
    id: 'account',
    label: 'Account',
    icon: <UserIcon />,
    content: (
      <AccountPanel
        session={SAMPLE_ACCOUNT_SESSION}
        signOutBusy={false}
        signOutMessage={null}
        onSignOut={async () => {
          console.warn('Sample sign-out');
        }}
      />
    ),
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: <MemoryIcon />,
    content: (
      <SettingsSectionBody
        eyebrow="Knowledge"
        title="Memory"
        lede="Vault index + entity graph live in the local SQLite store."
      >
        <div className="ds-settings-card">
          <p className="ds-settings-card__label">Vault root</p>
          <p className="ds-settings-card__value">~/Documents/tinker-vault</p>
        </div>
      </SettingsSectionBody>
    ),
  },
  {
    id: 'connections',
    label: 'Connections',
    icon: <PlugIcon />,
    content: (
      <SettingsSectionBody
        eyebrow="Integrations"
        title="Connections"
        lede="MCP servers configured in opencode.json surface here as toggles."
      />
    ),
  },
  {
    id: 'display',
    label: 'Display',
    icon: <DisplayIcon />,
    content: (
      <SettingsSectionBody
        eyebrow="Appearance"
        title="Display"
        lede="Theme, density, and accent preview."
      />
    ),
  },
];

const SettingsShellTab = (): JSX.Element => (
  <div className="ds-sections">
    <Section label="Default shell (Account · Memory · Connections · Display)">
      <div className="ds-settings-frame">
        <SettingsShell sections={SETTINGS_SECTIONS} />
      </div>
    </Section>

    <Section label="Account panel — signed in (provider: Google)">
      <div className="ds-settings-frame">
        <AccountPanel
          session={SAMPLE_ACCOUNT_SESSION}
          signOutBusy={false}
          signOutMessage={null}
          onSignOut={async () => {
            console.warn('Sample sign-out');
          }}
        />
      </div>
    </Section>

    <Section label="Account panel — signing out (busy + notice)">
      <div className="ds-settings-frame">
        <AccountPanel
          session={SAMPLE_ACCOUNT_SESSION}
          signOutBusy
          signOutMessage="Clearing keychain…"
          onSignOut={async () => {}}
        />
      </div>
    </Section>

    <Section label="Account panel — not signed in">
      <div className="ds-settings-frame">
        <AccountPanel session={null} signOutBusy={false} signOutMessage={null} onSignOut={async () => {}} />
      </div>
    </Section>

    <Section label="Controlled — Memory active">
      <div className="ds-settings-frame">
        <SettingsShell sections={SETTINGS_SECTIONS} activeSectionId="memory" />
      </div>
    </Section>

    <Section label="Empty — default EmptyPane">
      <div className="ds-settings-frame">
        <SettingsShell sections={[]} />
      </div>
    </Section>
  </div>
);

const SignInTab = (): JSX.Element => (
  <div className="ds-sections">
    <Section label="Idle (provider picker)">
      <div className="ds-settings-frame">
        <SignIn
          nativeRuntimeAvailable
          providerMessages={{}}
          onSignIn={() => new Promise<void>(() => {})}
          onContinueAsGuest={async () => {}}
        />
      </div>
    </Section>

    <Section label="Native runtime unavailable (web preview)">
      <div className="ds-settings-frame">
        <SignIn
          nativeRuntimeAvailable={false}
          providerMessages={{}}
          onSignIn={async () => {}}
          onContinueAsGuest={async () => {}}
        />
      </div>
    </Section>
  </div>
);

const TitlebarTab = (): JSX.Element => (
  <div className="ds-sections">
    <Section label="No session — bare brand">
      <Titlebar
        sessionFolderPath={null}
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />
    </Section>

    <Section label="With session folder crumb">
      <Titlebar
        sessionFolderPath="/Users/khani/Desktop/projects/tinker"
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />
    </Section>

    <Section label="Left rail collapsed (left toggle aria-pressed)">
      <Titlebar
        sessionFolderPath="/Users/khani/Desktop/projects/tinker"
        isLeftRailVisible={false}
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />
    </Section>

    <Section label="Dark theme preview">
      <div data-theme="dark" style={{ background: 'var(--color-bg-elevated)', padding: 'var(--space-4)' }}>
        <Titlebar
          sessionFolderPath="/Users/khani/Desktop/projects/tinker"
          isLeftRailVisible
          isRightInspectorVisible
          onToggleLeftRail={() => undefined}
          onToggleRightInspector={() => undefined}
        />
      </div>
    </Section>
  </div>
);

/* --------------------- Memory sidebar -------------------- */

const MemorySidebarPlayground = (): JSX.Element => {
  const [selected, setSelected] = useState<string | null>(
    '/memory/demo/pending/writing-articles.md',
  );
  const [search, setSearch] = useState('');

  return (
    <div style={{ height: 480, border: '1px solid var(--color-border-subtle)' }}>
      <MemorySidebar
        buckets={PREVIEW_MEMORY_BUCKETS}
        searchQuery={search}
        onSearchChange={setSearch}
        selectedPath={selected}
        onSelect={(file) => setSelected(file.absolutePath)}
        seenPaths={new Set(['/memory/demo/pending/writing-articles.md'])}
        referenceTimeMs={PREVIEW_MEMORY_REFERENCE_TIME_MS}
      />
    </div>
  );
};

/* ----------------------- Router ------------------------- */

const renderTab = (tab: PlaygroundTab): JSX.Element => {
  switch (tab) {
    case 'colors':
      return <ColorsTab />;
    case 'typography':
      return <TypographyTab />;
    case 'type-roles':
      return <TypeRolesTab />;
    case 'spacing':
      return <SpacingTab />;
    case 'components':
      return <ComponentsTab />;
    case 'modelpicker':
      return <ModelPickerTab />;
    case 'modal':
      return <ModalTab />;
    case 'toast':
      return <ToastTab />;
    case 'empty':
      return <EmptyStateTab />;
    case 'chat':
      return <ChatTab />;
    case 'settings-shell':
      return <SettingsShellTab />;
    case 'sign-in':
      return <SignInTab />;
    case 'titlebar':
      return <TitlebarTab />;
  }
};

export const DesignSystem = (): JSX.Element => {
  const [tab, setTab] = useState<PlaygroundTab>('components');

  return (
    <div className="ds-root">
      <aside className="ds-sidebar" aria-hidden="true">
        <span className="ds-sidebar__dot" />
        <span className="ds-sidebar__dot" />
        <span className="ds-sidebar__dot" />
        <span className="ds-sidebar__dot" />
      </aside>

      <main className="ds-main">
        <header className="ds-titlebar">
          <span className="ds-titlebar__crumb">Design System</span>
        </header>

        <nav className="ds-tabs" aria-label="Design system sections">
          {TABS.map((item) => {
            const active = item.value === tab;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={active}
                className={`ds-tab${active ? ' ds-tab--active' : ''}`}
                onClick={() => setTab(item.value)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="ds-content">{renderTab(tab)}</div>
      </main>
    </div>
  );
};

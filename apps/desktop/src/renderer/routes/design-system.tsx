import { useState, type JSX, type ReactNode } from 'react';
import {
  Badge,
  Button,
  ClickableBadge,
  ContextBadge,
  IconButton,
  ModelPicker,
  SearchInput,
  SegmentedControl,
  StatusDot,
  TextInput,
  Textarea,
  Toggle,
  type BadgeVariant,
  type ModelPickerItem,
  type StatusDotState,
} from '@tinker/design';
import '@tinker/design/styles/tokens.css';
import './design-system.css';

type PlaygroundTab =
  | 'colors'
  | 'typography'
  | 'spacing'
  | 'components'
  | 'modelpicker'
  | 'chat';

const TABS: ReadonlyArray<{ value: PlaygroundTab; label: string }> = [
  { value: 'colors', label: 'Colors' },
  { value: 'typography', label: 'Typography' },
  { value: 'spacing', label: 'Spacing' },
  { value: 'components', label: 'Components' },
  { value: 'modelpicker', label: 'Model Picker' },
  { value: 'chat', label: 'Chat' },
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
    </div>
  );
};

/* ------------------------- Colors ------------------------- */

type Swatch = { name: string; varName: string; hex: string; note?: string };

const SURFACE_SWATCHES: ReadonlyArray<Swatch> = [
  { name: 'bg-primary', varName: '--color-bg-primary', hex: '#fefcf8', note: 'canvas · dark #1a1612' },
  { name: 'bg-elevated', varName: '--color-bg-elevated', hex: '#ffffff', note: 'cards / modals · dark #221d17' },
  { name: 'bg-panel', varName: '--color-bg-panel', hex: '#f9f5ec', note: 'sidebar · dark #16120e' },
  { name: 'bg-input', varName: '--color-bg-input', hex: '#ffffff', note: 'inputs · dark #120f0c' },
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

/* -------------------------- Chat ------------------------- */

const ChatTab = (): JSX.Element => {
  const [message, setMessage] = useState('');
  return (
    <div className="ds-chat">
      <div className="ds-chat__memory">
        <StatusDot state="claude" />
        <span className="ds-chat__memory-text">
          Memory loaded · 3 recent entities · vault indexed 4m ago
        </span>
        <Badge variant="skill" size="small">
          coach
        </Badge>
      </div>

      <div className="ds-chat__log">
        <div className="ds-msg ds-msg--user">
          Pull yesterday&apos;s spend anomalies from Ramp, draft a Slack summary.
        </div>

        <div className="ds-msg ds-msg--assistant">
          <div className="ds-msg__meta">
            <StatusDot state="claude" />
            <span>OpenCode · gpt-5.4</span>
            <Badge variant="info" size="small">
              MCP: ramp
            </Badge>
          </div>
          <p>Found 4 anomalies over $2k. Top offender: vendor &ldquo;Acme Cloud&rdquo; (+312% vs 7d avg). Drafting summary.</p>
          <Row>
            <Button variant="primary" size="s">
              Post to #finance
            </Button>
            <Button variant="ghost" size="s">
              Edit draft
            </Button>
            <ClickableBadge variant="info">To-Dos · 2/3</ClickableBadge>
          </Row>
        </div>

        <div className="ds-msg ds-msg--system">
          <StatusDot state="pulse" />
          <span>Scheduling daily sweep at 08:00 · see Today pane</span>
        </div>
      </div>

      <div className="ds-chat__composer">
        <Textarea
          rows={3}
          resize="none"
          placeholder="Message the workspace…"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <IconButton variant="ghost" size="m" icon={<SettingsIcon />} label="Composer settings" />
        <Button variant="primary" size="m" leadingIcon={<PlusIcon />}>
          Send
        </Button>
      </div>
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
    case 'spacing':
      return <SpacingTab />;
    case 'components':
      return <ComponentsTab />;
    case 'modelpicker':
      return <ModelPickerTab />;
    case 'chat':
      return <ChatTab />;
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

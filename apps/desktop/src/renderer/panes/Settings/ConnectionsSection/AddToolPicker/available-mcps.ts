/**
 * Catalog of MCP integrations the picker can surface.
 *
 * Every MVP row is `available: false`. Post-MVP, flipping the flag + adding a
 * click handler inside `AddToolPicker` is the only change needed here — no
 * other call sites read this list.
 */
export type AvailableMcp = {
  readonly id: string;
  readonly label: string;
  readonly ticket: string;
  readonly ticketUrl: string;
  readonly available: boolean;
};

/**
 * Blurb rendered on every unavailable MCP card. Lives next to the list so
 * future "partially available" rows can special-case by reading `available`
 * directly from the row and swapping this constant for a bespoke copy string.
 */
export const DEFAULT_UNAVAILABLE_BLURB = 'Coming soon — needs sign-in';

export const AVAILABLE_MCPS: ReadonlyArray<AvailableMcp> = [
  {
    id: 'github',
    label: 'GitHub',
    ticket: 'TIN-158',
    ticketUrl: 'https://linear.app/tinker/issue/TIN-158',
    available: false,
  },
  {
    id: 'linear',
    label: 'Linear',
    ticket: 'TIN-159',
    ticketUrl: 'https://linear.app/tinker/issue/TIN-159',
    available: false,
  },
  {
    id: 'gmail',
    label: 'Gmail',
    ticket: 'TIN-160',
    ticketUrl: 'https://linear.app/tinker/issue/TIN-160',
    available: false,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    ticket: 'TIN-161',
    ticketUrl: 'https://linear.app/tinker/issue/TIN-161',
    available: false,
  },
  {
    id: 'drive',
    label: 'Drive',
    ticket: 'TIN-162',
    ticketUrl: 'https://linear.app/tinker/issue/TIN-162',
    available: false,
  },
  {
    id: 'slack',
    label: 'Slack',
    ticket: 'TIN-163',
    ticketUrl: 'https://linear.app/tinker/issue/TIN-163',
    available: false,
  },
];

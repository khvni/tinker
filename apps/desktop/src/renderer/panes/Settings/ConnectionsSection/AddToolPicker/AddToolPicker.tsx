import type { JSX } from 'react';
import { Modal } from '@tinker/design';
import {
  AVAILABLE_MCPS,
  DEFAULT_UNAVAILABLE_BLURB,
  type AvailableMcp,
} from './available-mcps.js';
import './AddToolPicker.css';

export type AddToolPickerProps = {
  open: boolean;
  onClose: () => void;
};

export const AddToolPicker = ({ open, onClose }: AddToolPickerProps): JSX.Element => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a tool"
      contentClassName="tinker-add-tool-picker"
    >
      <p className="tinker-add-tool-picker__intro tinker-muted">
        More built-in connectors are on the way. Each one will light up the moment its sign-in flow
        ships.
      </p>

      <ul className="tinker-add-tool-picker__grid" role="list">
        {AVAILABLE_MCPS.map((mcp) => (
          <AddToolPickerCard key={mcp.id} mcp={mcp} />
        ))}
      </ul>
    </Modal>
  );
};

type AddToolPickerCardProps = {
  mcp: AvailableMcp;
};

const AddToolPickerCard = ({ mcp }: AddToolPickerCardProps): JSX.Element => {
  return (
    <li
      className="tinker-add-tool-picker__card"
      aria-disabled={mcp.available ? undefined : 'true'}
      data-available={mcp.available ? 'true' : 'false'}
    >
      <div className="tinker-add-tool-picker__card-body">
        <p className="tinker-add-tool-picker__card-title">{mcp.label}</p>
        <p className="tinker-add-tool-picker__card-blurb">
          {mcp.available ? null : DEFAULT_UNAVAILABLE_BLURB}
        </p>
      </div>
      <a
        className="tinker-add-tool-picker__ticket"
        href={mcp.ticketUrl}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`Linear ticket ${mcp.ticket} for ${mcp.label}`}
      >
        {mcp.ticket}
      </a>
    </li>
  );
};

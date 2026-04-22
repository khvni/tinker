import type { JSX } from 'react';
import {
  AgentsIcon,
  AnalyticsIcon,
  ChatsIcon,
  ConnectionsIcon,
  DojoIcon,
  ExplorerIcon,
  MemoryIcon,
  NewTabIcon,
  SettingsIcon,
  SkillsIcon,
  WorkspacesIcon,
} from './icons.js';
import './WorkspaceSidebar.css';

export type WorkspaceSidebarProps = {
  readonly userInitial: string;
  readonly showDojoBadge?: boolean;
  readonly onOpenChat: () => void;
  readonly onOpenMemory: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenAccount: () => void;
};

type RailItemProps = {
  readonly label: string;
  readonly icon: JSX.Element;
  readonly onClick?: () => void;
  readonly isActive?: boolean;
  readonly disabled?: boolean;
  readonly badge?: boolean;
};

const RailItem = ({ label, icon, onClick, isActive = false, disabled = false, badge = false }: RailItemProps): JSX.Element => (
  <button
    type="button"
    className="tinker-workspace-sidebar__item"
    aria-label={label}
    aria-current={isActive ? 'page' : undefined}
    disabled={disabled || onClick === undefined}
    onClick={onClick}
  >
    {icon}
    {badge ? <span className="tinker-workspace-sidebar__item-dot" aria-hidden="true" /> : null}
  </button>
);

export const WorkspaceSidebar = ({
  userInitial,
  showDojoBadge = false,
  onOpenChat,
  onOpenMemory,
  onOpenSettings,
  onOpenAccount,
}: WorkspaceSidebarProps): JSX.Element => {
  return (
    <nav className="tinker-workspace-sidebar" aria-label="Workspace navigation">
      <div className="tinker-workspace-sidebar__top">
        <RailItem label="Workspaces" icon={<WorkspacesIcon />} isActive />
        <RailItem label="Explorer" icon={<ExplorerIcon />} disabled />
        <RailItem label="Chats" icon={<ChatsIcon />} onClick={onOpenChat} />
        <RailItem label="Skills" icon={<SkillsIcon />} disabled />
        <RailItem label="Agents" icon={<AgentsIcon />} disabled />
        <RailItem label="Connections" icon={<ConnectionsIcon />} disabled />
        <RailItem label="Memory" icon={<MemoryIcon />} onClick={onOpenMemory} />
        <div className="tinker-workspace-sidebar__divider" aria-hidden="true" />
        <RailItem label="New tab" icon={<NewTabIcon />} onClick={onOpenChat} />
      </div>
      <div className="tinker-workspace-sidebar__bottom">
        <RailItem label="Playbook" icon={<DojoIcon />} disabled badge={showDojoBadge} />
        <RailItem label="Analytics" icon={<AnalyticsIcon />} disabled />
        <RailItem label="Settings" icon={<SettingsIcon />} onClick={onOpenSettings} />
        <button
          type="button"
          className="tinker-workspace-sidebar__avatar-shell"
          aria-label="Account"
          onClick={onOpenAccount}
        >
          <span className="tinker-workspace-sidebar__avatar" aria-hidden="true">
            {userInitial}
          </span>
        </button>
      </div>
    </nav>
  );
};

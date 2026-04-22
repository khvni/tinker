import type { JSX } from 'react';
import {
  AgentsIcon,
  AnalyticsIcon,
  ChatsIcon,
  ConnectionsIcon,
  ExplorerIcon,
  MemoryIcon,
  NewTabIcon,
  PlaybookIcon,
  SettingsIcon,
  SkillsIcon,
  WorkspacesIcon,
} from './icons.js';
import './WorkspaceSidebar.css';

export type WorkspaceSidebarProps = {
  readonly userInitial: string;
  readonly showPlaybookBadge?: boolean;
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
  readonly children?: JSX.Element | null;
};

const RailItem = ({ label, icon, onClick, isActive = false, children }: RailItemProps): JSX.Element => (
  <button
    type="button"
    className="tinker-workspace-sidebar__item"
    aria-label={label}
    aria-current={isActive ? 'page' : undefined}
    disabled={onClick === undefined}
    onClick={onClick}
  >
    {icon}
    {children}
  </button>
);

export const WorkspaceSidebar = ({
  userInitial,
  showPlaybookBadge = false,
  onOpenChat,
  onOpenMemory,
  onOpenSettings,
  onOpenAccount,
}: WorkspaceSidebarProps): JSX.Element => {
  return (
    <nav className="tinker-workspace-sidebar" aria-label="Workspace navigation">
      <div className="tinker-workspace-sidebar__top">
        <RailItem label="Workspaces" icon={<WorkspacesIcon />} isActive />
        <RailItem label="Explorer" icon={<ExplorerIcon />} />
        <RailItem label="Chats" icon={<ChatsIcon />} onClick={onOpenChat} />
        <RailItem label="Skills" icon={<SkillsIcon />} />
        <RailItem label="Agents" icon={<AgentsIcon />} />
        <RailItem label="Connections" icon={<ConnectionsIcon />} />
        <RailItem label="Memory" icon={<MemoryIcon />} onClick={onOpenMemory} />
        <div className="tinker-workspace-sidebar__divider" aria-hidden="true" />
        <RailItem label="New tab" icon={<NewTabIcon />} onClick={onOpenChat} />
      </div>
      <div className="tinker-workspace-sidebar__bottom">
        <RailItem label="Playbook" icon={<PlaybookIcon />}>
          {showPlaybookBadge ? <span className="tinker-workspace-sidebar__item-dot" aria-hidden="true" /> : null}
        </RailItem>
        <RailItem label="Analytics" icon={<AnalyticsIcon />} />
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

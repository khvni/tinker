import { useEffect, useState, type JSX } from 'react';
import type { TinkerPaneKind } from '@tinker/shared-types';
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
  readonly avatarUrl: string | null;
  readonly accountLabel: string;
  readonly activeRailItem: TinkerPaneKind | null;
  readonly showPlaybookBadge?: boolean;
  readonly onOpenChat: () => void;
  readonly onOpenMemory: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenAccount: () => void;
};

type RailItemProps = {
  readonly label: string;
  readonly icon: JSX.Element;
  readonly title?: string;
  readonly onClick?: () => void;
  readonly isActive?: boolean;
  readonly children?: JSX.Element | null;
};

const RailItem = ({ label, icon, title, onClick, isActive = false, children }: RailItemProps): JSX.Element => (
  <button
    type="button"
    className="tinker-workspace-sidebar__item"
    aria-label={label}
    title={title}
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
  avatarUrl,
  accountLabel,
  activeRailItem,
  showPlaybookBadge = false,
  onOpenChat,
  onOpenMemory,
  onOpenSettings,
  onOpenAccount,
}: WorkspaceSidebarProps): JSX.Element => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const showAvatarImage = avatarUrl !== null && !imgFailed;

  return (
    <nav className="tinker-workspace-sidebar" aria-label="Workspace navigation">
      <div className="tinker-workspace-sidebar__top">
        <RailItem label="Workspaces" title="Workspaces" icon={<WorkspacesIcon />} />
        <RailItem label="Explorer" title="Explorer" icon={<ExplorerIcon />} />
        <RailItem
          label="Chats"
          title="Chats"
          icon={<ChatsIcon />}
          isActive={activeRailItem === 'chat'}
          onClick={onOpenChat}
        />
        <RailItem label="Skills" title="Skills" icon={<SkillsIcon />} />
        <RailItem label="Agents" title="Agents" icon={<AgentsIcon />} />
        <RailItem label="Connections" title="Connections" icon={<ConnectionsIcon />} />
        <RailItem
          label="Memory"
          title="Memory"
          icon={<MemoryIcon />}
          isActive={activeRailItem === 'memory'}
          onClick={onOpenMemory}
        />
        <div className="tinker-workspace-sidebar__divider" aria-hidden="true" />
        <RailItem label="New tab" title="New tab" icon={<NewTabIcon />} onClick={onOpenChat} />
      </div>
      <div className="tinker-workspace-sidebar__bottom">
        <RailItem label="Playbook" title="Playbook" icon={<PlaybookIcon />}>
          {showPlaybookBadge ? <span className="tinker-workspace-sidebar__item-dot" aria-hidden="true" /> : null}
        </RailItem>
        <RailItem label="Analytics" title="Analytics" icon={<AnalyticsIcon />} />
        <RailItem
          label="Settings"
          title="Settings"
          icon={<SettingsIcon />}
          isActive={activeRailItem === 'settings'}
          onClick={onOpenSettings}
        />
        <button
          type="button"
          className="tinker-workspace-sidebar__avatar-shell"
          aria-label="Account"
          title={accountLabel}
          onClick={onOpenAccount}
        >
          <span className="tinker-workspace-sidebar__avatar" aria-hidden={showAvatarImage ? undefined : 'true'}>
            {showAvatarImage ? (
              <img
                className="tinker-workspace-sidebar__avatar-image"
                src={avatarUrl}
                alt=""
                loading="lazy"
                draggable={false}
                onError={() => setImgFailed(true)}
              />
            ) : (
              userInitial
            )}
          </span>
        </button>
      </div>
    </nav>
  );
};

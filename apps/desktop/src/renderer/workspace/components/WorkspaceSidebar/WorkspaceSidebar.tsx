import { useEffect, useState, type JSX } from 'react';
import {
  ChatsIcon,
  ConnectionsIcon,
  MemoryIcon,
  NewTabIcon,
  SettingsIcon,
} from './icons.js';
import './WorkspaceSidebar.css';

export type WorkspaceRailItem = 'chat' | 'file' | 'memory' | 'settings' | 'connections';

export type WorkspaceSidebarProps = {
  readonly userInitial: string;
  readonly avatarUrl: string | null;
  readonly accountLabel: string;
  readonly activeRailItem: WorkspaceRailItem | null;
  readonly onOpenChat: () => void;
  readonly onOpenMemory: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenAccount: () => void;
  readonly onOpenConnections: () => void;
};

type RailItemProps = {
  readonly label: string;
  readonly icon: JSX.Element;
  readonly title: string;
  readonly onClick: () => void;
  readonly isActive?: boolean;
};

const RailItem = ({
  label,
  icon,
  title,
  onClick,
  isActive = false,
}: RailItemProps): JSX.Element => (
  <button
    type="button"
    className="tinker-workspace-sidebar__item"
    aria-label={label}
    title={title}
    aria-current={isActive ? 'page' : undefined}
    onClick={onClick}
  >
    {icon}
  </button>
);

export const WorkspaceSidebar = ({
  userInitial,
  avatarUrl,
  accountLabel,
  activeRailItem,
  onOpenChat,
  onOpenMemory,
  onOpenSettings,
  onOpenAccount,
  onOpenConnections,
}: WorkspaceSidebarProps): JSX.Element => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const showAvatarImage = avatarUrl !== null && !imgFailed;

  return (
    <nav className="tinker-workspace-sidebar" aria-label="Workspace navigation">
      <div className="tinker-workspace-sidebar__top">
        <RailItem
          label="Chats"
          title="Chats"
          icon={<ChatsIcon />}
          isActive={activeRailItem === 'chat'}
          onClick={onOpenChat}
        />
        <RailItem
          label="Memory"
          title="Memory"
          icon={<MemoryIcon />}
          isActive={activeRailItem === 'memory'}
          onClick={onOpenMemory}
        />
        <RailItem
          label="Connections"
          title="Connections"
          icon={<ConnectionsIcon />}
          isActive={activeRailItem === 'connections'}
          onClick={onOpenConnections}
        />
        <RailItem label="New tab" title="New tab" icon={<NewTabIcon />} onClick={onOpenChat} />
      </div>
      <div className="tinker-workspace-sidebar__bottom">
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

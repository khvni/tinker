import { NAV, type RouteKey } from "./nav";
import {
  BarsIcon,
  ChatIcon,
  FolderIcon,
  GearIcon,
  GridIcon,
  HelixIcon,
  PlugIcon,
  PlusIcon,
  RobotIcon,
  ShieldCheckIcon,
  SparkleIcon,
} from "./icons";

const ICONS: Record<RouteKey, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  workspace: GridIcon,
  explorer: FolderIcon,
  chats: ChatIcon,
  skills: SparkleIcon,
  agents: RobotIcon,
  connections: PlugIcon,
  memory: HelixIcon,
};

type Props = {
  route: RouteKey;
  onNavigate: (key: RouteKey) => void;
};

export function LeftRail({ route, onNavigate }: Props) {
  return (
    <nav className="rail" aria-label="Primary">
      <div className="rail__top">
        {NAV.map((item) => {
          const Icon = ICONS[item.key];
          return (
            <button
              key={item.key}
              className="rail__slot"
              data-active={route === item.key}
              onClick={() => onNavigate(item.key)}
              aria-label={item.label}
              aria-current={route === item.key ? "page" : undefined}
            >
              <Icon />
              <span className="rail__tooltip">
                {item.label}
                <span className="rail__tooltip-kbd">{item.kbd}</span>
              </span>
            </button>
          );
        })}
        <button className="rail__slot" data-plus="true" aria-label="Add workspace">
          <PlusIcon style={{ width: 16, height: 16 }} />
        </button>
      </div>
      <div className="rail__divider" />
      <div className="rail__bottom">
        <button className="rail__slot" aria-label="Wavelength — new skills available">
          <ShieldCheckIcon />
          <span className="rail__notify-dot" />
        </button>
        <button className="rail__slot" aria-label="Activity">
          <BarsIcon />
        </button>
        <button className="rail__slot" aria-label="Settings">
          <GearIcon />
        </button>
        <button className="rail__slot" aria-label="Account — Khani">
          <span className="rail__avatar">K</span>
        </button>
      </div>
    </nav>
  );
}

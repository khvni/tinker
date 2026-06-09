import type { SSOProvider, SSOSession, SSOStatus } from '@tinker/shared-types';

export type ProjectMode = 'project' | 'no-project';

export type RecentProject = {
  readonly path: string;
  readonly name: string;
  readonly lastOpened: string;
};

export type ProjectState = {
  readonly mode: ProjectMode;
  readonly recentProjects: readonly RecentProject[];
  readonly activeRoot: string;
};

export type OpencodeConnection = {
  baseUrl: string;
  username: string;
  password: string;
  pid?: number;
};

export type AuthHandle = {
  baseUrl: string;
  pid: number;
};

export type RefreshTokenProvider = 'google' | 'github' | 'microsoft';

export type FileDialogOptions = {
  readonly multiple?: boolean;
  readonly directory?: boolean;
  readonly title?: string;
  readonly filters?: Array<{ name: string; extensions: string[] }>;
};

export type FileStat = {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly size: number;
};

export type DesktopApi = {
  dialog: {
    openFolder(): Promise<string>;
    openFile(options?: FileDialogOptions): Promise<string | null>;
  };
  fs: {
    readTextFile(path: string): Promise<string>;
    readFile(path: string): Promise<Uint8Array>;
    writeTextFile(path: string, contents: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<FileStat>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
  app: {
    getHomePath(): Promise<string>;
    joinPath(...segments: string[]): Promise<string>;
  };
  notification: {
    isPermissionGranted(): Promise<boolean>;
    requestPermission(): Promise<'granted' | 'denied'>;
    send(payload: { title: string; body: string }): Promise<void>;
  };
  keychain: {
    saveRefreshToken(provider: RefreshTokenProvider, userId: string, token: string): Promise<void>;
    loadRefreshToken(provider: RefreshTokenProvider, userId: string): Promise<string | null>;
    clearRefreshToken(provider: RefreshTokenProvider, userId: string): Promise<void>;
    saveMcpSecret(mcpId: string, secret: string): Promise<void>;
    loadMcpSecret(mcpId: string): Promise<string | null>;
    clearMcpSecret(mcpId: string): Promise<void>;
  };
  process: {
    startOpencode(folderPath: string, userId: string, memorySubdir: string): Promise<OpencodeConnection>;
    stopOpencode(pid: number): Promise<void>;
  };
  auth: {
    startSidecar(): Promise<AuthHandle>;
    signIn(provider: SSOProvider): Promise<SSOSession>;
    signOut(provider: SSOProvider): Promise<void>;
    status(): Promise<SSOStatus>;
    restoreSession(provider: RefreshTokenProvider, userId: string): Promise<SSOSession | null>;
  };
  project: {
    getState(): Promise<ProjectState>;
    setMode(mode: ProjectMode): Promise<void>;
    addRecent(project: RecentProject): Promise<void>;
    removeRecent(path: string): Promise<void>;
    setActiveRoot(root: string): Promise<void>;
  };
  platform: NodeJS.Platform;
};

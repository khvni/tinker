type TauriRuntimeWindow = Window &
  typeof globalThis & {
    __TAURI_INTERNALS__?: {
      invoke?: unknown;
    };
  };

export const isTauriRuntime = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const candidate = (window as TauriRuntimeWindow).__TAURI_INTERNALS__;
  return typeof candidate?.invoke === 'function';
};


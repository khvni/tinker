export const isElectronRuntime = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return typeof window.tinker !== 'undefined';
};

export const isDesktopRuntime = (): boolean => isElectronRuntime();

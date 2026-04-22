import { useEffect, useState } from 'react';
import {
  getMemoryRoot,
  moveMemoryRoot,
  subscribeMemoryPathChanged,
  type MemoryRootMoveProgress,
  validateMemoryRootWritable,
} from '@tinker/memory';
import { openFolderPicker } from '../../../bindings.js';

export type MemoryRootNotice = {
  kind: 'error' | 'success';
  message: string;
};

export type UseMemoryRootControlsResult = {
  memoryRoot: string | null;
  memoryRootBusy: boolean;
  moveProgress: MemoryRootMoveProgress | null;
  notice: MemoryRootNotice | null;
  changeMemoryRoot(): Promise<void>;
};

const NOTICE_TIMEOUT_MS = 4_000;

const isFolderPickerCancelled = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('cancelled');
  }

  return String(error).toLowerCase().includes('cancelled');
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
};

export const useMemoryRootControls = (): UseMemoryRootControlsResult => {
  const [memoryRoot, setMemoryRoot] = useState<string | null>(null);
  const [memoryRootBusy, setMemoryRootBusy] = useState(false);
  const [moveProgress, setMoveProgress] = useState<MemoryRootMoveProgress | null>(null);
  const [notice, setNotice] = useState<MemoryRootNotice | null>(null);

  useEffect(() => {
    let active = true;

    void getMemoryRoot()
      .then((resolvedMemoryRoot) => {
        if (active) {
          setMemoryRoot(resolvedMemoryRoot);
        }
      })
      .catch((error) => {
        if (active) {
          setNotice({
            kind: 'error',
            message: toErrorMessage(error, 'Could not load the memory folder.'),
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return subscribeMemoryPathChanged(({ nextRoot }) => {
      setMemoryRoot(nextRoot);
    });
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice((currentNotice) => (currentNotice === notice ? null : currentNotice));
    }, NOTICE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  const changeMemoryRoot = async (): Promise<void> => {
    if (memoryRootBusy) {
      return;
    }

    setNotice(null);

    let selectedPath: string;
    try {
      selectedPath = await openFolderPicker();
    } catch (error) {
      if (isFolderPickerCancelled(error)) {
        return;
      }

      setNotice({
        kind: 'error',
        message: toErrorMessage(error, 'Could not open the folder picker.'),
      });
      return;
    }

    if (memoryRoot === selectedPath) {
      return;
    }

    setMemoryRootBusy(true);
    setMoveProgress({ copiedFiles: 0, totalFiles: 0, currentPath: null });

    try {
      await validateMemoryRootWritable(selectedPath);
      const nextRoot = await moveMemoryRoot(selectedPath, {
        onProgress: (progress) => {
          setMoveProgress(progress);
        },
      });

      setMemoryRoot(nextRoot);
      setNotice({
        kind: 'success',
        message: `Memory folder moved to ${nextRoot}.`,
      });
    } catch (error) {
      setNotice({
        kind: 'error',
        message: toErrorMessage(error, 'Could not update the memory folder.'),
      });
    } finally {
      setMemoryRootBusy(false);
      setMoveProgress(null);
    }
  };

  return {
    memoryRoot,
    memoryRootBusy,
    moveProgress,
    notice,
    changeMemoryRoot,
  };
};

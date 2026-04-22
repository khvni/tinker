import { invoke } from '@tauri-apps/api/core';

export const approveMemoryEntry = (filePath: string, destinationDir: string): Promise<string> => {
  return invoke<string>('memory_approve', { filePath, destinationDir });
};

export const dismissMemoryEntry = (filePath: string): Promise<void> => {
  return invoke<void>('memory_dismiss', { filePath });
};

export const readMemoryDiff = (filePath: string): Promise<string> => {
  return invoke<string>('memory_diff', { filePath });
};

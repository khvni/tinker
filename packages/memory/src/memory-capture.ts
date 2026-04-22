import { join } from '@tauri-apps/api/path';
import { mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
import { getMemoryAutoAppendEnabled } from './memory-settings.js';

type MemoryCaptureLogger = (message: string, error: unknown) => void;

export type AppendMemoryCaptureInput = {
  memoryDirectory: string;
  sessionCreatedAt: string;
  sessionId: string;
  userPrompt: string;
  assistantMessage: string;
  capturedAt?: string;
  logger?: MemoryCaptureLogger;
};

const defaultLogger: MemoryCaptureLogger = (message, error) => {
  console.warn(message, error);
};

const normalizeIsoMinute = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 16);
  }

  return date.toISOString().slice(0, 16);
};

export const formatMemoryCaptureFileStamp = (value: string): string => {
  return normalizeIsoMinute(value).replace('T', '-').replace(':', '');
};

export const formatMemoryCaptureHeading = (value: string): string => {
  return normalizeIsoMinute(value).replace('T', ' ');
};

export const renderMemoryCaptureEntry = ({
  userPrompt,
  assistantMessage,
  capturedAt,
}: Pick<AppendMemoryCaptureInput, 'userPrompt' | 'assistantMessage'> & {
  capturedAt: string;
}): string => {
  return [
    `## ${formatMemoryCaptureHeading(capturedAt)}`,
    '',
    '### User',
    userPrompt,
    '',
    '### Assistant',
    assistantMessage,
    '',
    '',
  ].join('\n');
};

export const buildMemoryCapturePath = async (
  memoryDirectory: string,
  sessionCreatedAt: string,
  sessionId: string,
): Promise<string> => {
  const sessionsDirectory = await join(memoryDirectory, 'sessions');
  return join(sessionsDirectory, `${formatMemoryCaptureFileStamp(sessionCreatedAt)}-${sessionId}.md`);
};

export const appendMemoryCapture = async ({
  memoryDirectory,
  sessionCreatedAt,
  sessionId,
  userPrompt,
  assistantMessage,
  capturedAt = new Date().toISOString(),
  logger = defaultLogger,
}: AppendMemoryCaptureInput): Promise<boolean> => {
  try {
    if (!(await getMemoryAutoAppendEnabled())) {
      return false;
    }

    const sessionsDirectory = await join(memoryDirectory, 'sessions');
    const path = await buildMemoryCapturePath(memoryDirectory, sessionCreatedAt, sessionId);
    await mkdir(sessionsDirectory, { recursive: true });
    await writeTextFile(
      path,
      renderMemoryCaptureEntry({
        userPrompt,
        assistantMessage,
        capturedAt,
      }),
      {
        append: true,
        create: true,
      },
    );

    return true;
  } catch (error) {
    logger('Failed to append auto-captured memory.', error);
    return false;
  }
};

import type { Event } from '@opencode-ai/sdk/v2/client';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';

export type StoredChatEvent = {
  ts: string;
  event: string;
  data: unknown;
};

type ChatHistoryLogger = (message: string, error: unknown) => void;

type ChatHistoryLocation = {
  folderPath: string;
  userId: string;
  sessionId: string;
};

type ChatHistoryDirectoryLocation = Pick<ChatHistoryLocation, 'folderPath' | 'userId'>;

type CreateChatHistoryWriterOptions = ChatHistoryLocation & {
  logger?: ChatHistoryLogger;
  now?: () => string;
};

const defaultLogger: ChatHistoryLogger = (message, error) => {
  console.warn(message, error);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const trimPathEdges = (value: string): string => {
  return value.replace(/^[\\/]+|[\\/]+$/gu, '');
};

const pickPathSeparator = (path: string): string => {
  return path.includes('\\') && !path.includes('/') ? '\\' : '/';
};

const joinPath = (base: string, ...segments: string[]): string => {
  const separator = pickPathSeparator(base);
  const cleanedBase = base.replace(/[\\/]+$/u, '');
  const cleanedSegments = segments.map(trimPathEdges).filter((segment) => segment.length > 0);

  return [cleanedBase, ...cleanedSegments].join(separator);
};

const dirname = (path: string): string => {
  const normalized = path.replace(/[\\/]+$/u, '');
  const lastSeparator = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));

  return lastSeparator === -1 ? normalized : normalized.slice(0, lastSeparator);
};

const toStoredChatEvent = (event: Event, now: () => string): StoredChatEvent => {
  return {
    ts: now(),
    event: event.type,
    data: event.properties,
  };
};

const parseStoredChatEvent = (value: unknown): StoredChatEvent | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { ts, event, data } = value;
  if (typeof ts !== 'string' || typeof event !== 'string') {
    return null;
  }

  return { ts, event, data };
};

export const buildChatHistoryDirectory = ({ folderPath, userId }: ChatHistoryDirectoryLocation): string => {
  return joinPath(folderPath, '.tinker', 'chats', userId);
};

export const buildChatHistoryPath = ({ folderPath, userId, sessionId }: ChatHistoryLocation): string => {
  return joinPath(buildChatHistoryDirectory({ folderPath, userId }), `${sessionId}.jsonl`);
};

export const parseChatHistoryText = (
  text: string,
  logger: ChatHistoryLogger = defaultLogger,
): StoredChatEvent[] => {
  const entries: StoredChatEvent[] = [];
  const seenLines = new Set<string>();
  const lines = text.split('\n');
  const lastNonEmptyLineIndex = [...lines].reduce((lastIndex, line, index) => {
    return line.trim().length > 0 ? index : lastIndex;
  }, -1);

  for (const [index, line] of lines.entries()) {
    if (line.trim().length === 0 || seenLines.has(line)) {
      continue;
    }
    seenLines.add(line);

    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      if (index === lastNonEmptyLineIndex) {
        break;
      }

      logger('Skipping malformed chat-history line.', error);
      continue;
    }

    const entry = parseStoredChatEvent(parsed);
    if (!entry) {
      logger('Skipping invalid chat-history payload.', parsed);
      continue;
    }

    entries.push(entry);
  }

  return entries;
};

export const readChatHistory = async (
  location: ChatHistoryLocation,
  logger: ChatHistoryLogger = defaultLogger,
): Promise<StoredChatEvent[]> => {
  const filePath = buildChatHistoryPath(location);
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    return parseChatHistoryText(text, logger);
  } catch {
    return [];
  }
};

export const findLatestChatHistorySessionId = async (
  location: ChatHistoryDirectoryLocation,
): Promise<string | null> => {
  const directoryPath = buildChatHistoryDirectory(location);
  let dirEntries: Dirent[];
  try {
    dirEntries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = await Promise.all(
    dirEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map(async (entry) => {
        const name = entry.name;
        const absolutePath = joinPath(directoryPath, name);
        const info = await fs.stat(absolutePath);

        return {
          sessionId: name.slice(0, -'.jsonl'.length),
          modifiedAt: info.mtime?.getTime() ?? 0,
        };
      }),
  );

  const latest = candidates
    .filter((entry): entry is { sessionId: string; modifiedAt: number } => entry !== null)
    .sort((left, right) => right.modifiedAt - left.modifiedAt || left.sessionId.localeCompare(right.sessionId))[0];

  return latest?.sessionId ?? null;
};

export type ChatHistoryWriter = {
  path: string;
  appendEvent: (event: Event) => void;
  appendRecord: (record: StoredChatEvent) => void;
  flush: () => Promise<void>;
  dispose: () => Promise<void>;
};

export const createChatHistoryWriter = ({
  folderPath,
  userId,
  sessionId,
  logger = defaultLogger,
  now = () => new Date().toISOString(),
}: CreateChatHistoryWriterOptions): ChatHistoryWriter => {
  const path = buildChatHistoryPath({ folderPath, userId, sessionId });
  let closed = false;
  let directoryReady = false;
  let queue = Promise.resolve();

  const writeRecord = async (record: StoredChatEvent): Promise<void> => {
    if (!directoryReady) {
      await fs.mkdir(dirname(path), { recursive: true });
      directoryReady = true;
    }

    await fs.appendFile(path, `${JSON.stringify(record)}\n`, 'utf-8');
  };

  const appendRecord = (record: StoredChatEvent): void => {
    if (closed) {
      return;
    }

    queue = queue
      .then(() => writeRecord(record))
      .catch((error) => {
        logger('Failed to append chat-history record.', error);
      });
  };

  return {
    path,
    appendEvent(event) {
      appendRecord(toStoredChatEvent(event, now));
    },
    appendRecord,
    flush() {
      return queue;
    },
    dispose() {
      closed = true;
      return queue;
    },
  };
};

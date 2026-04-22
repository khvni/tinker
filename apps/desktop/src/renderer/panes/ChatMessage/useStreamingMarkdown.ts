import { useCallback, useEffect, useRef, useState } from 'react';

export type StreamingBuffer = {
  append: (chunk: string) => void;
  reset: () => void;
  read: () => string;
  isEmpty: () => boolean;
};

export const createStreamingBuffer = (): StreamingBuffer => {
  let buffer = '';
  return {
    append: (chunk) => {
      if (chunk.length > 0) {
        buffer += chunk;
      }
    },
    reset: () => {
      buffer = '';
    },
    read: () => buffer,
    isEmpty: () => buffer.length === 0,
  };
};

export type StreamingMarkdown = {
  text: string;
  append: (chunk: string) => void;
  reset: () => void;
  read: () => string;
};

const getScheduler = (): {
  schedule: (cb: () => void) => number;
  cancel: (id: number) => void;
} => {
  if (typeof globalThis.requestAnimationFrame === 'function' && typeof globalThis.cancelAnimationFrame === 'function') {
    return {
      schedule: (cb) => globalThis.requestAnimationFrame(cb),
      cancel: (id) => globalThis.cancelAnimationFrame(id),
    };
  }

  return {
    schedule: (cb) => globalThis.setTimeout(cb, 16) as unknown as number,
    cancel: (id) => globalThis.clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
  };
};

export const useStreamingMarkdown = (): StreamingMarkdown => {
  const bufferRef = useRef<StreamingBuffer>(createStreamingBuffer());
  const frameRef = useRef<number | null>(null);
  const schedulerRef = useRef(getScheduler());
  const [text, setText] = useState('');

  const flush = useCallback(() => {
    frameRef.current = null;
    setText(bufferRef.current.read());
  }, []);

  const append = useCallback(
    (chunk: string) => {
      if (chunk.length === 0) {
        return;
      }

      bufferRef.current.append(chunk);

      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = schedulerRef.current.schedule(flush);
    },
    [flush],
  );

  const reset = useCallback(() => {
    if (frameRef.current !== null) {
      schedulerRef.current.cancel(frameRef.current);
      frameRef.current = null;
    }

    bufferRef.current.reset();
    setText('');
  }, []);

  const read = useCallback(() => bufferRef.current.read(), []);

  useEffect(() => {
    const scheduler = schedulerRef.current;
    return () => {
      if (frameRef.current !== null) {
        scheduler.cancel(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  return { text, append, reset, read };
};

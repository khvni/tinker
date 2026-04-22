export const COMPOSER_MAX_ROWS = 10;

type ComposerHeightMetrics = {
  scrollHeight: number;
  lineHeight: number;
  paddingTop: number;
  paddingBottom: number;
  borderTopWidth: number;
  borderBottomWidth: number;
  maxRows?: number;
};

type ComposerKeyOptions = {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
};

export const calculateComposerHeight = ({
  scrollHeight,
  lineHeight,
  paddingTop,
  paddingBottom,
  borderTopWidth,
  borderBottomWidth,
  maxRows = COMPOSER_MAX_ROWS,
}: ComposerHeightMetrics): { height: number; maxHeight: number; overflowY: 'auto' | 'hidden' } => {
  const frameHeight = paddingTop + paddingBottom + borderTopWidth + borderBottomWidth;
  const maxHeight = lineHeight * maxRows + frameHeight;

  return {
    height: Math.min(scrollHeight, maxHeight),
    maxHeight,
    overflowY: scrollHeight > maxHeight ? 'auto' : 'hidden',
  };
};

export const shouldSubmitComposerKey = ({
  key,
  shiftKey,
  altKey,
  ctrlKey,
  metaKey,
  isComposing,
}: ComposerKeyOptions): boolean => {
  return key === 'Enter' && !shiftKey && !altKey && !ctrlKey && !metaKey && !isComposing;
};

export const shouldAbortComposerKey = ({
  key,
  isStreaming,
}: {
  key: string;
  isStreaming: boolean;
}): boolean => {
  return isStreaming && key === 'Escape';
};

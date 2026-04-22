import type { Session } from '@tinker/shared-types';
import type { WorkspaceModelOption } from '../../opencode.js';

type SessionModelRef = Pick<Session, 'modelId'>;

export const resolvePreferredStoredModelId = (
  folderSession: SessionModelRef | null,
  userSessions: ReadonlyArray<SessionModelRef>,
): string | undefined => {
  return folderSession?.modelId ?? userSessions.find((session) => session.modelId)?.modelId;
};

export const resolveSelectedModelId = (input: {
  readonly options: ReadonlyArray<WorkspaceModelOption>;
  readonly currentSelectedId: string | undefined;
  readonly preserveCurrent: boolean;
  readonly preferredStoredModelId: string | undefined;
  readonly defaultSelectedId: string | undefined;
}): string | undefined => {
  if (
    input.preserveCurrent
    && input.currentSelectedId
    && input.options.some((option) => option.id === input.currentSelectedId)
  ) {
    return input.currentSelectedId;
  }

  const preferredOption = input.options.find(
    (option) => option.storedId === input.preferredStoredModelId,
  );
  return preferredOption?.id ?? input.defaultSelectedId ?? input.options[0]?.id;
};

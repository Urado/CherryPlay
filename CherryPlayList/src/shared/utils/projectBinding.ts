import type { ProjectMeta } from '@core/types/project';

export const isProjectBindingCurrent = (
  meta: Pick<ProjectMeta, 'filePath' | 'linkedParty'>,
  filePath: string,
  partyId: string,
): boolean => meta.filePath === filePath && meta.linkedParty?.id === partyId;

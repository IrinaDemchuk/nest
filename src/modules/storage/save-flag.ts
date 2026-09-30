import { BadRequestException } from '@nestjs/common';

export function parseSaveFlag(raw: string | undefined): boolean {
  if (raw === undefined) {
    return false;
  }
  if (raw === 'true' || raw === '1') {
    return true;
  }
  if (raw === 'false' || raw === '0') {
    return false;
  }
  throw new BadRequestException('save must be true, false, 1, or 0');
}

export function formatSaveLog(entry: {
  userId: string;
  transformationId: string;
  fileId: string | null;
  action?: 'save' | 'download';
  outcome: number;
  fileSize: number;
  durationMs: number;
}): string {
  return `userId=${entry.userId} transformationId=${entry.transformationId} fileId=${entry.fileId ?? ''} action=${entry.action ?? 'save'} outcome=${entry.outcome} fileSize=${entry.fileSize} durationMs=${entry.durationMs}`;
}

import { FileSource } from '../hooks/usePlayerFileProcessing';

export const createFileSources = (files: string[], directories: string[]): FileSource[] => {
  const sources: FileSource[] = [];
  if (files.length > 0) {
    sources.push({ type: 'files', paths: files });
  }
  if (directories.length > 0) {
    sources.push({ type: 'directories', paths: directories });
  }
  return sources;
};

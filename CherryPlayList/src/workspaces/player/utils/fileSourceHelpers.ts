import { FileSource } from '../hooks/usePlayerFileProcessing';

/**
 * Создает массив источников файлов из массивов файлов и директорий
 * @param files - Массив путей к файлам
 * @param directories - Массив путей к директориям
 * @returns Массив источников файлов
 */
export function createFileSources(files: string[], directories: string[]): FileSource[] {
  const sources: FileSource[] = [];
  if (files.length > 0) {
    sources.push({ type: 'files', paths: files });
  }
  if (directories.length > 0) {
    sources.push({ type: 'directories', paths: directories });
  }
  return sources;
}

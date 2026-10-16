import * as fs from 'fs/promises';
import * as path from 'path';

import { logger } from './logger.js';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'] as const;

export const normalizeStatNumber = (value: number | bigint): number => {
  return typeof value === 'bigint' ? Number(value) : value;
};

export const isAudioFile = (filePath: string): boolean => {
  const ext = path.extname(filePath).toLowerCase();
  return (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
};

export const copyFileWithRetry = async (
  src: string,
  dest: string,
  maxRetries: number = 3,
): Promise<void> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const destDir = path.dirname(dest);
      await ensureFolder(destDir);

      await fs.copyFile(src, dest);
      return;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  throw lastError || new Error('Copy failed after retries');
};

export const ensureFolder = async (folderPath: string): Promise<void> => {
  try {
    await fs.access(folderPath);
  } catch {
    await fs.mkdir(folderPath, { recursive: true });
  }
};

export const safeFileName = (fileName: string): string => {
  const sanitizedName = fileName.replace(/[<>:"|?*\\]/g, '_');
  return Array.from(sanitizedName)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();
};

const WIN32_RESERVED_DIR_NAMES = new Set(
  [
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
  ].map((s) => s.toUpperCase()),
);

export const assertExactPortableProjectFolderName = (name: string): void => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Пустое название проекта — укажите имя, которое подойдёт для папки на диске');
  }
  if (trimmed !== name) {
    throw new Error('Название проекта не должно иметь лишние пробелы по краям');
  }
  if (name.includes('/') || name.includes('\\')) {
    throw new Error(
      'В названии проекта не должно быть символов пути. Измените название и повторите попытку.',
    );
  }
  if (safeFileName(name) !== name) {
    throw new Error(
      'В названии проекта есть символы, нельзя использовать в имени папки (например < > : " | ? * \\). ' +
        'Измените название так, как должна называться папка на диске, и повторите попытку.',
    );
  }
  if (process.platform === 'win32') {
    if (/[. ]$/.test(name)) {
      throw new Error(
        'В Windows имя папки не может заканчиваться точкой или пробелом. Измените название проекта.',
      );
    }
    if (WIN32_RESERVED_DIR_NAMES.has(name.toUpperCase())) {
      throw new Error(
        'Это имя зарезервировано в Windows для устройств. Задайте другое название проекта.',
      );
    }
  }
};

export const isResolvedPathUnderProjectDir = (
  projectDir: string,
  absolutePath: string,
): boolean => {
  const resolvedBase = path.resolve(projectDir);
  const resolved = path.resolve(absolutePath);
  const rel = path.relative(resolvedBase, resolved);
  if (rel === '') {
    return true;
  }
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return false;
  }
  return true;
};

export const getPortableTrackSourceResolutionMeta = (
  projectDir: string,
  srcPath: string,
): { absolute: string; outsideProjectDir: boolean } => {
  const absolute = resolveTrackSourceForPortableCopy(projectDir, srcPath);
  return { absolute, outsideProjectDir: !isResolvedPathUnderProjectDir(projectDir, absolute) };
};

export const resolveTrackSourceForPortableCopy = (projectDir: string, srcPath: string): string => {
  if (path.isAbsolute(srcPath)) {
    return path.resolve(srcPath);
  }
  return path.resolve(projectDir, srcPath);
};

export const getRelativePath = (from: string, to: string): string => {
  const fromNormalized = path.resolve(from);
  const toNormalized = path.resolve(to);

  const relative = path.relative(path.dirname(fromNormalized), toNormalized);

  return relative.replace(/\\/g, '/');
};

export const validatePath = (userPath: string, basePath?: string): boolean => {
  if (!userPath || typeof userPath !== 'string') {
    return false;
  }

  try {
    if (!basePath) {
      const hasPathTraversal =
        userPath.includes('/../') ||
        userPath.includes('\\..\\') ||
        userPath.includes('\\../') ||
        userPath.includes('/..\\') ||
        userPath.startsWith('../') ||
        userPath.startsWith('..\\') ||
        userPath.endsWith('/..') ||
        userPath.endsWith('\\..') ||
        userPath === '..';
      if (hasPathTraversal) {
        return false;
      }
    }

    const resolvedPath = path.resolve(userPath);

    if (basePath) {
      const resolvedBasePath = path.resolve(basePath);

      const relative = path.relative(resolvedBasePath, resolvedPath);

      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error('Path validation error', error);
    return false;
  }
};

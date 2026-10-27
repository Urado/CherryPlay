import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

import { type IpcMainInvokeEvent, ipcMain } from 'electron';

import {
  assertExactPortableProjectFolderName,
  copyFileWithRetry,
  ensureFolder,
  isResolvedPathUnderProjectDir,
  resolveTrackSourceForPortableCopy,
  safeFileName,
  validatePath,
} from '../utils/fsHelpers.js';

export interface ProjectFile {
  version: '2.0' | '2.1';
  name: string;
  items: Array<{
    type: 'track' | 'group';
    id: string;
    path?: string;
    name: string;
    duration?: number;
    items?: string[];
  }>;
  rootItems: string[];
  settings: {
    defaultPauseBetweenTracks: number;
    defaultActionAfterTrack: string;
    plannedEndTime: number | null;
    portableMode?: boolean;
  };
  trackSettings: Record<
    string,
    {
      pauseBetweenTracks?: number | null;
      actionAfterTrack?: string | null;
    }
  >;
  groupSettings: Record<
    string,
    {
      pauseBetweenTracks?: number | null;
      actionAfterTrack?: string | null;
    }
  >;
  collections?: Array<{
    id: string;
    name: string;
    items: ProjectFile['items'];
    rootItems: string[];
  }>;
  collectionViewState?: { bindings: Record<string, string> };
  sessionState?: {
    mode: 'preparation' | 'session';
    playedTrackIds: string[];
    disabledTrackIds: string[];
    disabledGroupIds: string[];
    currentTrackId: string | null;
    sessionStartTime: number | null;
  };
  linkedParty?: { id: string; shortCode: string; url: string };
}

const safePortableFolderSegment = (value: string, fallback: string): string => {
  const sanitized = Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? '_' : character;
    })
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 100);
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return fallback;
  }
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(sanitized)
    ? `_${sanitized}`
    : sanitized;
};

const buildTrackCollectionFolderMap = (projectFile: ProjectFile): Map<string, string | null> => {
  const itemsById = new Map<string, ProjectFile['items'][number]>();

  for (const item of projectFile.items) {
    itemsById.set(item.id, item);
  }

  const trackToGroupPath = new Map<string, string[]>();

  const visit = (itemId: string, groupPath: string[]): void => {
    const item = itemsById.get(itemId);
    if (!item) {
      return;
    }

    if (item.type === 'track') {
      if (!trackToGroupPath.has(item.id)) {
        trackToGroupPath.set(item.id, groupPath);
      }
      return;
    }

    if (item.type === 'group' && Array.isArray(item.items)) {
      const nextPath = [...groupPath, item.name];
      for (const childId of item.items) {
        visit(childId, nextPath);
      }
    }
  };

  for (const rootId of projectFile.rootItems) {
    visit(rootId, []);
  }

  const result = new Map<string, string | null>();

  for (const [trackId, groupPath] of trackToGroupPath.entries()) {
    if (groupPath.length === 0) {
      result.set(trackId, null);
      continue;
    }

    const sanitizedSegments = groupPath.map((name, index) => {
      const base = name && name.trim().length > 0 ? name.trim() : `Group${index + 1}`;
      return safePortableFolderSegment(safeFileName(base), `Group${index + 1}`);
    });

    result.set(trackId, sanitizedSegments.join(path.sep));
  }

  return result;
};

const resolveUniqueDestPath = async (destDir: string, srcPath: string): Promise<string> => {
  const ext = path.extname(srcPath);
  const baseName = path.basename(srcPath, ext);
  let candidate = path.join(destDir, `${baseName}${ext}`);

  if (path.resolve(candidate) === path.resolve(srcPath)) {
    return candidate;
  }

  let suffix = 2;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(destDir, `${baseName}_${suffix}${ext}`);
      suffix++;
    } catch {
      return candidate;
    }
  }
};

const collectionFolderName = (collection: NonNullable<ProjectFile['collections']>[number]): string => {
  if (
    typeof collection.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(collection.id)
  ) {
    throw new Error(`Некорректный ID подборки: ${String(collection.id)}`);
  }
  if (typeof collection.name !== 'string' || !Array.isArray(collection.items)) {
    throw new Error(`Некорректные данные подборки «${collection.name ?? collection.id}»`);
  }
  const safeName = safePortableFolderSegment(collection.name, 'Подборка');
  return safeName || 'Подборка';
};

const collectionFolderNames = (
  collections: NonNullable<ProjectFile['collections']>,
): string[] => {
  const usedNames = new Set<string>();
  return collections.map((collection) => {
    const baseName = collectionFolderName(collection);
    let folderName = baseName;
    let suffix = 2;
    while (usedNames.has(folderName.toLowerCase())) {
      folderName = `${baseName.slice(0, 96)} (${suffix})`;
      suffix++;
    }
    usedNames.add(folderName.toLowerCase());
    return folderName;
  });
};

const isPathUnderDirectory = (directory: string, filePath: string): boolean => {
  const relative = path.relative(path.resolve(directory), path.resolve(filePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const ensureDirectoryUnderRoot = async (root: string, target: string): Promise<void> => {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(target);
  if (!isResolvedPathUnderProjectDir(normalizedRoot, normalizedTarget)) {
    throw new Error('Invalid portable project directory');
  }
  const segments = path.relative(normalizedRoot, normalizedTarget).split(path.sep).filter(Boolean);
  let currentPath = normalizedRoot;
  for (const segment of ['', ...segments]) {
    if (segment) {
      currentPath = path.join(currentPath, segment);
    }
    try {
      const info = await fs.lstat(currentPath);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new Error(`Папка переносимого проекта небезопасна: ${currentPath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      await fs.mkdir(currentPath);
    }
  }
};

const assertRegularFileUnderRoot = async (root: string, target: string): Promise<void> => {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(target);
  if (!isResolvedPathUnderProjectDir(normalizedRoot, normalizedTarget)) {
    throw new Error(`Путь выходит за пределы переносимой папки: ${target}`);
  }
  const segments = path.relative(normalizedRoot, normalizedTarget).split(path.sep).filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Путь переносимого проекта должен указывать на файл внутри папки: ${target}`);
  }
  let currentPath = normalizedRoot;
  for (const [index, segment] of segments.entries()) {
    currentPath = path.join(currentPath, segment);
    const info = await fs.lstat(currentPath);
    if (info.isSymbolicLink() || (index < segments.length - 1 ? !info.isDirectory() : !info.isFile())) {
      throw new Error(`Путь переносимого проекта небезопасен: ${currentPath}`);
    }
  }
};

const hasSymlinkPathSegment = async (filePath: string): Promise<boolean> => {
  let currentPath = path.resolve(filePath);
  while (true) {
    try {
      if ((await fs.lstat(currentPath)).isSymbolicLink()) {
        return true;
      }
    } catch {
      return true;
    }
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return false;
    }
    currentPath = parentPath;
  }
};

const isPortableRelativeTrackPath = (rawPath: string): boolean => {
  if (!rawPath.startsWith('./tracks/') && !rawPath.startsWith('./collections/')) {
    return false;
  }
  const segments = rawPath.slice(2).split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return false;
  }
  if (segments[0] === 'collections') {
    return segments.length > 2;
  }
  return segments.length > 1;
};

const collectPortableTrackPaths = (projectFile: ProjectFile): Map<string, string> => {
  const paths = new Map<string, string>();
  const addPath = (item: ProjectFile['items'][number], expectedFolder: string | null): void => {
    if (item.type !== 'track' || typeof item.path !== 'string' || !isPortableRelativeTrackPath(item.path)) {
      return;
    }
    const segments = item.path.slice(2).split('/');
    const expectedSegment = expectedFolder === null ? 'tracks' : `collections/${expectedFolder}`;
    const actualSegment = expectedFolder === null ? segments[0] : `${segments[0]}/${segments[1]}`;
    const segmentMatches =
      process.platform === 'win32'
        ? actualSegment.toLowerCase() === expectedSegment.toLowerCase()
        : actualSegment === expectedSegment;
    if (segmentMatches) {
      const normalizedPath = process.platform === 'win32' ? item.path.toLowerCase() : item.path;
      paths.set(normalizedPath, item.path);
    }
  };
  for (const item of projectFile.items) {
    addPath(item, null);
  }
  const collections = projectFile.collections ?? [];
  const folderNames = collectionFolderNames(collections);
  for (const [index, collection] of collections.entries()) {
    const folderName = folderNames[index];
    for (const item of collection.items) {
      addPath(item, folderName);
    }
  }
  return paths;
};

const readPreviousPortableTrackPaths = async (filePath: string): Promise<Map<string, string>> => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as unknown;
    if (!validateProjectFile(parsed) || parsed.settings.portableMode !== true) {
      return new Map();
    }
    return collectPortableTrackPaths(parsed);
  } catch {
    return new Map();
  }
};

const removeObsoletePortableFiles = async (
  projectDir: string,
  previousPaths: Map<string, string>,
  currentPaths: Map<string, string>,
): Promise<void> => {
  if (await hasSymlinkPathSegment(projectDir)) {
    return;
  }
  const stalePaths = [...previousPaths.entries()].filter(([key]) => !currentPaths.has(key));
  for (const [, relativePath] of stalePaths) {
    if (!isPortableRelativeTrackPath(relativePath)) {
      continue;
    }
    const absolutePath = path.resolve(projectDir, relativePath);
    const packageRoot = path.join(projectDir, relativePath.startsWith('./tracks/') ? 'tracks' : 'collections');
    if (!isResolvedPathUnderProjectDir(packageRoot, absolutePath)) {
      continue;
    }
    const relativeSegments = path.relative(packageRoot, absolutePath).split(path.sep).filter(Boolean);
    let currentPath = packageRoot;
    let safe = true;
    try {
      const rootInfo = await fs.lstat(currentPath);
      if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }
    for (const segment of relativeSegments.slice(0, -1)) {
      currentPath = path.join(currentPath, segment);
      try {
        const info = await fs.lstat(currentPath);
        if (info.isSymbolicLink() || !info.isDirectory()) {
          safe = false;
          break;
        }
      } catch {
        safe = false;
        break;
      }
    }
    if (!safe) {
      continue;
    }
    try {
      const fileInfo = await fs.lstat(absolutePath);
      if (!fileInfo.isSymbolicLink() && fileInfo.isFile()) {
        await fs.unlink(absolutePath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        continue;
      }
    }
    while (currentPath !== packageRoot) {
      try {
        await fs.rmdir(currentPath);
      } catch {
        break;
      }
      currentPath = path.dirname(currentPath);
    }
  }
};

const copyTrackItems = async (
  items: ProjectFile['items'],
  projectDir: string,
  destinationDir: string,
  destinationPrefix: string,
  sendProgress: (current: number, total: number, fileName: string) => void,
  progressOffset: number,
  totalTracks: number,
  strictSourceFiles: boolean,
): Promise<void> => {
  const tracks = items.filter((item) => item.type === 'track');
  const sourceDestinations = new Map<string, string>();
  const normalizePath = (filePath: string) => {
    const resolved = path.resolve(filePath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };

  for (const [index, item] of tracks.entries()) {
    const label = item.name?.trim() ? String(item.name) : item.id;
    if (typeof item.path !== 'string' || item.path.trim() === '') {
      if (strictSourceFiles) {
        throw new Error(`Для переносимого сохранения у каждого трека нужен путь к файлу (трек «${label}»).`);
      }
      sendProgress(progressOffset + index + 1, totalTracks, label);
      continue;
    }

    const source = resolveTrackSourceForPortableCopy(projectDir, item.path);
    const fileName = path.basename(source);
    const normalizedSource = normalizePath(source);
    const existingDestination = sourceDestinations.get(normalizedSource);
    if (existingDestination) {
      item.path = `${destinationPrefix}/${path.relative(destinationDir, existingDestination).split(path.sep).join('/')}`;
      sendProgress(progressOffset + index + 1, totalTracks, fileName);
      continue;
    }

    if (isPathUnderDirectory(destinationDir, source)) {
      try {
        await assertRegularFileUnderRoot(destinationDir, source);
      } catch {
        if (strictSourceFiles) {
          throw new Error(`Переносимое сохранение: файл подборки недоступен. Трек: «${label}» — ${fileName} (${source})`);
        }
      }
      item.path = `${destinationPrefix}/${path.relative(destinationDir, source).split(path.sep).join('/')}`;
      sourceDestinations.set(normalizedSource, source);
      sendProgress(progressOffset + index + 1, totalTracks, fileName);
      continue;
    }

    try {
      await fs.access(source);
    } catch {
      if (strictSourceFiles) {
        throw new Error(`Нет доступа к файлу подборки «${label}» (прервано): ${fileName} — ${source}`);
      }
      sendProgress(progressOffset + index + 1, totalTracks, fileName);
      continue;
    }

    const destination = await resolveUniqueDestPath(destinationDir, source);
    await copyFileWithRetry(source, destination);
    sourceDestinations.set(normalizedSource, destination);
    item.path = `${destinationPrefix}/${path.basename(destination)}`;
    sendProgress(progressOffset + index + 1, totalTracks, fileName);
  }
};

const copyTracksForPortableMode = async (
  filePath: string,
  projectFile: ProjectFile,
  sendProgress: (current: number, total: number, fileName: string) => void,
  options?: { strictSourceFiles?: boolean },
): Promise<void> => {
  const strictSourceFiles = options?.strictSourceFiles === true;
  const projectDir = path.dirname(filePath);
  const tracksDir = path.join(projectDir, 'tracks');
  const collections = projectFile.collections ?? [];
  const trackItems = projectFile.items.filter((item) => item.type === 'track' && item.path);
  const collectionTrackCount = collections.reduce(
    (count, collection) =>
      count + (Array.isArray(collection.items) ? collection.items.filter((item) => item.type === 'track').length : 0),
    0,
  );
  const total = projectFile.items.filter((item) => item.type === 'track').length + collectionTrackCount;
  const normalizedTracksDir = path.resolve(tracksDir);
  const isWindows = process.platform === 'win32';
  const trackCollectionFolders = buildTrackCollectionFolderMap(projectFile);
  const collectionFolders = collectionFolderNames(collections);
  if (strictSourceFiles) {
    for (const [itemIndex, item] of [...projectFile.items, ...collections.flatMap((collection) => collection.items ?? [])].entries()) {
      if (item.type !== 'track') {
        continue;
      }
      const itemLabel = item.name?.trim() ? String(item.name) : item.id;
      if (typeof item.path !== 'string' || item.path.trim() === '') {
        throw new Error(`Для переносимого сохранения у каждого трека нужен путь к файлу (трек «${itemLabel}»).`);
      }
      const source = resolveTrackSourceForPortableCopy(projectDir, item.path);
      try {
        await fs.access(source);
      } catch {
        if (itemIndex < projectFile.items.length && isPathUnderDirectory(tracksDir, source)) {
          throw new Error(
            'Переносимое сохранение: в ./tracks/ указан путь, но файл на диске не найден или недоступен. ' +
              `Трек: «${itemLabel}» — ${path.basename(source)} (${source})`,
          );
        }
        if (itemIndex < projectFile.items.length && !isResolvedPathUnderProjectDir(projectDir, source)) {
          throw new Error(
            'Переносимое сохранение: путь вне папки проекта (например, через `..`) должен указывать ' +
              'на существующий, доступный для чтения файл. ' +
              `Трек: «${itemLabel}» — ${path.basename(source)} (${source})`,
          );
        }
        const collection = itemIndex >= projectFile.items.length;
        const prefix = collection ? 'файлу подборки' : 'файлу трека';
        throw new Error(`Нет доступа к ${prefix} «${itemLabel}» (прервано): ${path.basename(source)} — ${source}`);
      }
    }
  }
  await ensureFolder(projectDir);
  await ensureDirectoryUnderRoot(projectDir, tracksDir);
  const trackGroupFolders = new Set(
    [...trackCollectionFolders.values()].filter((folder): folder is string => folder !== null),
  );
  for (const folder of trackGroupFolders) {
    await ensureDirectoryUnderRoot(tracksDir, path.join(tracksDir, folder));
  }
  const collectionsRoot = path.join(projectDir, 'collections');
  if (collectionFolders.length > 0) {
    await ensureDirectoryUnderRoot(projectDir, collectionsRoot);
    for (const folderName of collectionFolders) {
      await ensureDirectoryUnderRoot(collectionsRoot, path.join(collectionsRoot, folderName));
    }
  }
  if (total === 0) {
    sendProgress(0, 0, '');
  }

  for (let i = 0; i < trackItems.length; i++) {
    const item = trackItems[i];
    const rawSrcPath = item.path!;
    const trackLabel = item.name?.trim() ? String(item.name) : item.id;
    const srcAbsolute = resolveTrackSourceForPortableCopy(projectDir, rawSrcPath);
    const fileName = path.basename(srcAbsolute);
    const normalizedSrcAbsolute = isWindows ? srcAbsolute.toLowerCase() : srcAbsolute;
    const normalizedTracksRoot = isWindows ? normalizedTracksDir.toLowerCase() : normalizedTracksDir;
    const inTracksDir =
      normalizedSrcAbsolute === normalizedTracksRoot ||
      normalizedSrcAbsolute.startsWith(normalizedTracksRoot + path.sep);

    if (inTracksDir) {
      if (strictSourceFiles) {
        try {
          await assertRegularFileUnderRoot(tracksDir, srcAbsolute);
        } catch {
          throw new Error(
            'Переносимое сохранение: в ./tracks/ указан путь, но файл на диске не найден или недоступен. ' +
              `Трек: «${trackLabel}» — ${fileName} (${srcAbsolute})`,
          );
        }
      }
      const normalizedRelative = path.relative(tracksDir, srcAbsolute).split(path.sep).join('/');
      item.path = `./tracks/${normalizedRelative}`;
      sendProgress(i + 1, total, fileName);
      continue;
    }

    try {
      await fs.access(srcAbsolute);
    } catch {
      if (strictSourceFiles) {
        if (!isResolvedPathUnderProjectDir(projectDir, srcAbsolute)) {
          throw new Error(
            'Переносимое сохранение: путь вне папки проекта (например, через `..`) должен указывать ' +
              'на существующий, доступный для чтения файл. ' +
              `Трек: «${trackLabel}» — ${fileName} (${srcAbsolute})`,
          );
        }
        throw new Error(`Нет доступа к файлу трека (прервано): ${fileName} — ${srcAbsolute}`);
      }
      sendProgress(i + 1, total, fileName);
      continue;
    }

    const collectionFolder = trackCollectionFolders.get(item.id) ?? null;
    const destBaseDir = collectionFolder ? path.join(tracksDir, collectionFolder) : tracksDir;
    await ensureDirectoryUnderRoot(tracksDir, destBaseDir);
    const destPath = await resolveUniqueDestPath(destBaseDir, srcAbsolute);
    await copyFileWithRetry(srcAbsolute, destPath);
    item.path = `./tracks/${path.relative(tracksDir, destPath).split(path.sep).join('/')}`;
    sendProgress(i + 1, total, fileName);
  }

  for (const [collectionIndex, collection] of collections.entries()) {
    const folderName = collectionFolders[collectionIndex];
    const destinationDir = path.join(collectionsRoot, folderName);
    if (!validatePath(destinationDir, collectionsRoot)) {
      throw new Error(`Некорректный путь папки подборки «${collection.name}»`);
    }
    const collectionItems = collection.items;
    await copyTrackItems(
      collectionItems,
      projectDir,
      destinationDir,
      `./collections/${folderName}`,
      sendProgress,
      projectFile.items.filter((item) => item.type === 'track').length +
        collections.slice(0, collections.indexOf(collection)).reduce(
          (count, previous) => count + previous.items.filter((item) => item.type === 'track').length,
          0,
        ),
      total,
      strictSourceFiles,
    );
  }

};

const saveProject = async (filePath: string, projectFile: ProjectFile): Promise<void> => {
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, JSON.stringify(projectFile, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to save project: ${(error as Error).message}`);
  }
};

const validateProjectFile = (value: unknown): value is ProjectFile => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const projectFile = value as Partial<ProjectFile>;
  if (
    (projectFile.version !== '2.0' && projectFile.version !== '2.1') ||
    typeof projectFile.name !== 'string' ||
    !Array.isArray(projectFile.items) ||
    !Array.isArray(projectFile.rootItems) ||
    !projectFile.settings ||
    typeof projectFile.settings !== 'object'
  ) {
    return false;
  }
  if (projectFile.collections !== undefined) {
    if (!Array.isArray(projectFile.collections)) {
      return false;
    }
    const collectionIds = new Set<string>();
    for (const collection of projectFile.collections) {
      if (
        !collection ||
        typeof collection.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(collection.id) ||
        collectionIds.has(collection.id.toLowerCase()) ||
        typeof collection.name !== 'string' ||
        !Array.isArray(collection.items) ||
        !Array.isArray(collection.rootItems) ||
        !validateSavedItemGraph(collection.items, collection.rootItems)
      ) {
        return false;
      }
      collectionIds.add(collection.id.toLowerCase());
    }
  }
  return true;
};

const normalizeCollectionViewState = (projectFile: ProjectFile): ProjectFile => {
  const withoutViewState = (): ProjectFile => {
    const normalizedProject = { ...projectFile };
    delete normalizedProject.collectionViewState;
    return normalizedProject;
  };
  const rawState: unknown = projectFile.collectionViewState;
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return withoutViewState();
  }
  const rawBindings: unknown = (rawState as { bindings?: unknown }).bindings;
  if (!rawBindings || typeof rawBindings !== 'object' || Array.isArray(rawBindings)) {
    return withoutViewState();
  }
  const collectionIds = new Set((projectFile.collections ?? []).map((collection) => collection.id));
  const bindings = Object.fromEntries(
    Object.entries(rawBindings).filter(
      ([workspaceId, collectionId]) =>
        workspaceId.length > 0 && typeof collectionId === 'string' && collectionIds.has(collectionId),
    ),
  );
  return { ...projectFile, collectionViewState: { bindings } };
};

const validateSavedItemGraph = (items: unknown, rootItems: unknown): boolean => {
  if (!Array.isArray(items) || !Array.isArray(rootItems)) {
    return false;
  }
  const itemsById = new Map<string, { type: 'track' | 'group'; children: string[] }>();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string' ||
      candidate.id.length === 0 ||
      typeof candidate.name !== 'string' ||
      itemsById.has(candidate.id)
    ) {
      return false;
    }
    if (candidate.type === 'track') {
      if (typeof candidate.path !== 'string' || candidate.path.length === 0) {
        return false;
      }
      if (candidate.duration !== undefined && typeof candidate.duration !== 'number') {
        return false;
      }
      itemsById.set(candidate.id, { type: 'track', children: [] });
      continue;
    }
    if (
      candidate.type !== 'group' ||
      !Array.isArray(candidate.items) ||
      !candidate.items.every((childId) => typeof childId === 'string')
    ) {
      return false;
    }
    const children = candidate.items;
    if (new Set(children).size !== children.length) {
      return false;
    }
    itemsById.set(candidate.id, { type: 'group', children });
  }

  if (
    !rootItems.every((rootId) => typeof rootId === 'string' && itemsById.has(rootId)) ||
    new Set(rootItems).size !== rootItems.length
  ) {
    return false;
  }
  const parentCounts = new Map<string, number>();
  for (const rootId of rootItems as string[]) {
    parentCounts.set(rootId, 1);
  }
  for (const [itemId, item] of itemsById) {
    if (item.type !== 'group') {
      continue;
    }
    for (const childId of item.children) {
      if (!itemsById.has(childId)) {
        return false;
      }
      const parentCount = (parentCounts.get(childId) ?? 0) + 1;
      if (parentCount > 1) {
        return false;
      }
      parentCounts.set(childId, parentCount);
    }
    if (item.children.includes(itemId)) {
      return false;
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (itemId: string): boolean => {
    if (visiting.has(itemId)) {
      return false;
    }
    if (visited.has(itemId)) {
      return true;
    }
    visiting.add(itemId);
    const item = itemsById.get(itemId);
    if (!item || !item.children.every(visit)) {
      return false;
    }
    visiting.delete(itemId);
    visited.add(itemId);
    return true;
  };

  for (const rootId of rootItems as string[]) {
    if (!visit(rootId)) {
      return false;
    }
  }
  return visited.size === itemsById.size && [...itemsById.keys()].every((itemId) => parentCounts.has(itemId));
};

const loadProject = async (filePath: string): Promise<ProjectFile> => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as unknown;
    if (!validateProjectFile(parsed)) {
      const projectVersion =
        parsed && typeof parsed === 'object' ? String((parsed as { version?: unknown }).version) : 'unknown';
      if (projectVersion !== '2.0' && projectVersion !== '2.1') {
        throw new Error(`Unsupported project version: ${projectVersion}`);
      }
      throw new Error('Invalid project format: missing or invalid required fields');
    }
    return normalizeCollectionViewState(parsed);
  } catch (error) {
    throw new Error(`Failed to load project: ${(error as Error).message}`);
  }
};

const savePortableProjectAsPackage = async (
  event: IpcMainInvokeEvent,
  parentPath: string,
  projectFile: ProjectFile,
): Promise<{ cherryPath: string; folderPath: string }> => {
  if (!validatePath(parentPath)) {
    throw new Error('Invalid path: path traversal detected');
  }

  const rawName = (projectFile.name || 'project').trim() || 'project';
  assertExactPortableProjectFolderName(rawName);

  const finalDir = path.join(parentPath, rawName);
  if (!validatePath(finalDir) || !validatePath(finalDir, parentPath)) {
    throw new Error('Invalid project path');
  }

  let parentStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    parentStat = await fs.stat(parentPath);
  } catch {
    throw new Error('Не удалось открыть выбранную папку');
  }
  if (!parentStat.isDirectory()) {
    throw new Error('Указанный путь не является папкой');
  }

  let finalPathExists = false;
  try {
    await fs.access(finalDir);
    finalPathExists = true;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      finalPathExists = false;
    } else {
      throw new Error(
        `Не удалось проверить папку назначения: ${err?.message ?? (e as Error).message}`,
      );
    }
  }
  if (finalPathExists) {
    throw new Error('Папка с таким именем уже существует');
  }

  const stagingName = `.cherryportable-staging-${randomUUID()}`;
  const stagingDir = path.join(parentPath, stagingName);
  if (!validatePath(stagingDir, parentPath)) {
    throw new Error('Invalid staging path');
  }

  const cherryFileName = `${rawName}.cherry`;
  const cherryPath = path.join(stagingDir, cherryFileName);
  const portableFile = JSON.parse(JSON.stringify(projectFile)) as ProjectFile;

  await fs.mkdir(stagingDir);
  try {
    await copyTracksForPortableMode(
      cherryPath,
      portableFile,
      (current, total, fileName) => {
        event.sender.send('project:save-progress', { current, total, fileName });
      },
      { strictSourceFiles: true },
    );
    portableFile.settings.portableMode = true;
    await saveProject(cherryPath, portableFile);
    try {
      await fs.rename(stagingDir, finalDir);
    } catch (renameError) {
      const code = (renameError as NodeJS.ErrnoException).code;
      if (code === 'EEXIST' || code === 'ENOTEMPTY') {
        throw new Error('Папка с таким именем уже существует');
      }
      try {
        const st = await fs.stat(finalDir);
        if (st.isDirectory()) {
          throw new Error('Папка с таким именем уже существует');
        }
      } catch (statError) {
        if (
          statError instanceof Error &&
          statError.message === 'Папка с таким именем уже существует'
        ) {
          throw statError;
        }
      }
      throw renameError;
    }
  } catch (error) {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }

  return {
    folderPath: finalDir,
    cherryPath: path.join(finalDir, cherryFileName),
  };
};

export const registerProjectHandlers = (): void => {
  ipcMain.handle(
    'project:save',
    async (
      event,
      payload: {
        path: string;
        projectFile: ProjectFile;
        portableMode?: boolean;
        strictSourceFiles?: boolean;
      },
    ) => {
      try {
        if (!validatePath(payload.path)) {
          return {
            success: false,
            error: 'Invalid path: path traversal detected',
          };
        }
        if (!validateProjectFile(payload.projectFile)) {
          return { success: false, error: 'Invalid project format' };
        }
        const normalizedProject = normalizeCollectionViewState(payload.projectFile);

        if (payload.portableMode) {
          const portableFile = JSON.parse(JSON.stringify(normalizedProject)) as ProjectFile;
          const previousTrackPaths = await readPreviousPortableTrackPaths(payload.path);

          await copyTracksForPortableMode(
            payload.path,
            portableFile,
            (current, total, fileName) => {
              event.sender.send('project:save-progress', { current, total, fileName });
            },
            { strictSourceFiles: true },
          );

          portableFile.settings.portableMode = true;

          await saveProject(payload.path, portableFile);
          await removeObsoletePortableFiles(
            path.dirname(payload.path),
            previousTrackPaths,
            collectPortableTrackPaths(portableFile),
          );
        } else {
          await saveProject(payload.path, normalizedProject);
        }

        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle(
    'project:savePortableAs',
    async (
      event,
      payload: {
        parentPath: string;
        projectFile: ProjectFile;
      },
    ) => {
      try {
        if (!validatePath(payload.parentPath)) {
          return {
            success: false,
            error: 'Invalid path: path traversal detected',
          };
        }
        if (!payload.projectFile) {
          return {
            success: false,
            error: 'Нет данных проекта',
          };
        }
        if (!validateProjectFile(payload.projectFile)) {
          return { success: false, error: 'Invalid project format' };
        }
        const normalizedProject = normalizeCollectionViewState(payload.projectFile);
        const data = await savePortableProjectAsPackage(
          event,
          payload.parentPath,
          normalizedProject,
        );
        return {
          success: true,
          data,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle('project:load', async (event, payload: { path: string }) => {
    try {
      if (!validatePath(payload.path)) {
        return {
          success: false,
          error: 'Invalid path: path traversal detected',
        };
      }

      const projectFile = await loadProject(payload.path);
      return {
        success: true,
        data: projectFile,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
};

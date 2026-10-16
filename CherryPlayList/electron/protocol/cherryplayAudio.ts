import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

import { protocol } from 'electron';

import { isAudioFile, validatePath } from '../utils/fsHelpers.js';

export const CHERRYPLAY_AUDIO_SCHEME = 'cherryplay-audio';

export const CHERRYPLAY_AUDIO_HOST = 'local';

export const MAX_AUDIO_FILE_BYTES = 2 * 1024 * 1024 * 1024;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
} as const;

const withCorsHeaders = (headers: Record<string, string> = {}): Record<string, string> => {
  return { ...CORS_HEADERS, ...headers };
};

const AUDIO_MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
};

const base64urlEncodeUtf8 = (text: string): string => {
  return Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const base64urlDecodeUtf8 = (encoded: string): string => {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(base64 + padding, 'base64').toString('utf8');
};

export const getAudioMimeType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  return AUDIO_MIME_TYPES[ext] ?? 'application/octet-stream';
};

export interface ParsedByteRange {
  readonly start: number;
  readonly end: number;
}

export const parseByteRange = (
  rangeHeader: string | null,
  fileSize: number,
): ParsedByteRange | null | 'unsatisfiable' => {
  if (!rangeHeader) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return 'unsatisfiable';
  }

  const [, startPart, endPart] = match;
  let start: number;
  let end: number;

  if (startPart === '' && endPart !== '') {
    const suffixLength = Number.parseInt(endPart, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return 'unsatisfiable';
    }
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else if (startPart !== '' && endPart === '') {
    start = Number.parseInt(startPart, 10);
    end = fileSize - 1;
  } else if (startPart !== '' && endPart !== '') {
    start = Number.parseInt(startPart, 10);
    end = Number.parseInt(endPart, 10);
  } else {
    return 'unsatisfiable';
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= fileSize) {
    return 'unsatisfiable';
  }

  if (end >= fileSize) {
    end = fileSize - 1;
  }

  if (start > end) {
    return 'unsatisfiable';
  }

  return { start, end };
};

export const encodePathToCherryplayAudioUrl = (filePath: string): string => {
  return `${CHERRYPLAY_AUDIO_SCHEME}://${CHERRYPLAY_AUDIO_HOST}/${base64urlEncodeUtf8(filePath)}`;
};

export const extractEncodedPathFromCherryplayAudioUrl = (requestUrl: string): string | null => {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== `${CHERRYPLAY_AUDIO_SCHEME}:`) {
      return null;
    }

    const pathnamePayload = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    if (pathnamePayload) {
      return pathnamePayload;
    }

    if (url.hostname && url.hostname !== CHERRYPLAY_AUDIO_HOST) {
      return url.hostname;
    }

    return null;
  } catch {
    return null;
  }
};

export const decodePathFromCherryplayAudioUrl = (requestUrl: string): string | null => {
  const encodedPath = extractEncodedPathFromCherryplayAudioUrl(requestUrl);
  if (!encodedPath) {
    return null;
  }

  try {
    return base64urlDecodeUtf8(encodedPath);
  } catch {
    return null;
  }
};

export const handleCherryplayAudioRequest = async (request: Request): Promise<Response> => {
  const filePath = decodePathFromCherryplayAudioUrl(request.url);
  if (!filePath || !validatePath(filePath)) {
    return new Response('Forbidden', { status: 403, headers: withCorsHeaders() });
  }

  const resolvedPath = path.resolve(filePath);

  if (!isAudioFile(resolvedPath)) {
    return new Response('Forbidden', { status: 403, headers: withCorsHeaders() });
  }

  let fileSize = 0;
  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      return new Response('Forbidden', { status: 403, headers: withCorsHeaders() });
    }
    fileSize = stats.size;
  } catch {
    return new Response('Forbidden', { status: 403, headers: withCorsHeaders() });
  }

  if (fileSize > MAX_AUDIO_FILE_BYTES) {
    return new Response('Payload Too Large', { status: 413, headers: withCorsHeaders() });
  }

  const mimeType = getAudioMimeType(resolvedPath);
  const rangeHeader = request.headers.get('range') ?? request.headers.get('Range');
  const parsedRange = parseByteRange(rangeHeader, fileSize);

  if (parsedRange === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: withCorsHeaders({
        'Content-Range': `bytes */${fileSize}`,
      }),
    });
  }

  if (parsedRange) {
    const { start, end } = parsedRange;
    const contentLength = end - start + 1;
    const stream = createReadStream(resolvedPath, { start, end });

    return new Response(stream as unknown as ReadableStream<Uint8Array>, {
      status: 206,
      headers: withCorsHeaders({
        'Accept-Ranges': 'bytes',
        'Content-Length': String(contentLength),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Type': mimeType,
      }),
    });
  }

  const stream = createReadStream(resolvedPath);
  return new Response(stream as unknown as ReadableStream<Uint8Array>, {
    status: 200,
    headers: withCorsHeaders({
      'Accept-Ranges': 'bytes',
      'Content-Length': String(fileSize),
      'Content-Type': mimeType,
    }),
  });
};

export const registerCherryplayAudioScheme = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CHERRYPLAY_AUDIO_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
};

export const registerCherryplayAudioProtocolHandler = (): void => {
  protocol.handle(CHERRYPLAY_AUDIO_SCHEME, handleCherryplayAudioRequest);
};

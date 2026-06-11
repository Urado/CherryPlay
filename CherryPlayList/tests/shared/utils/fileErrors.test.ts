import {
  formatMissingTrackMessage,
  isFileNotFoundError,
} from '../../../src/shared/utils/fileErrors';

describe('isFileNotFoundError', () => {
  it('returns true for ENOENT code', () => {
    expect(isFileNotFoundError({ code: 'ENOENT', message: 'read failed' })).toBe(true);
  });

  it('returns true for English file-not-found messages', () => {
    expect(isFileNotFoundError(new Error('ENOENT: no such file or directory'))).toBe(true);
    expect(isFileNotFoundError(new Error('file not found: /music/track.mp3'))).toBe(true);
    expect(isFileNotFoundError(new Error('no such file: C:\\tracks\\missing.flac'))).toBe(true);
  });

  it('returns true for Russian file-not-found messages', () => {
    expect(isFileNotFoundError(new Error('Файл не найден: D:\\music\\song.mp3'))).toBe(true);
  });

  it('returns false for unrelated "not found" errors', () => {
    expect(isFileNotFoundError(new Error('user not found'))).toBe(false);
    expect(isFileNotFoundError(new Error('route not found'))).toBe(false);
    expect(isFileNotFoundError(new Error('запись не найдена'))).toBe(false);
  });

  it('returns false for nullish and non-error values', () => {
    expect(isFileNotFoundError(null)).toBe(false);
    expect(isFileNotFoundError(undefined)).toBe(false);
    expect(isFileNotFoundError('ENOENT')).toBe(false);
  });
});

describe('formatMissingTrackMessage', () => {
  it('includes track path when provided', () => {
    expect(formatMissingTrackMessage('Song', '/path/song.mp3')).toBe(
      'Файл не найден: /path/song.mp3',
    );
  });

  it('falls back to track name when path is omitted', () => {
    expect(formatMissingTrackMessage('Song')).toBe('Файл не найден: Song');
  });
});

import * as path from 'path';

import {
  getPortableTrackSourceResolutionMeta,
  isResolvedPathUnderProjectDir,
  resolveTrackSourceForPortableCopy,
} from '../../electron/utils/fsHelpers';

describe('resolveTrackSourceForPortableCopy', () => {
  it('resolves relative paths against the project .cherry directory, not cwd', () => {
    const projectDir = path.resolve('fixture-project');
    const rel = path.join('audio', 'track.mp3');
    expect(resolveTrackSourceForPortableCopy(projectDir, rel)).toBe(path.resolve(projectDir, rel));
  });

  it('resolves project-relative ./tracks/ paths', () => {
    const projectDir = path.resolve('my', 'project-dir');
    expect(resolveTrackSourceForPortableCopy(projectDir, './tracks/nested/a.flac')).toBe(
      path.resolve(projectDir, 'tracks', 'nested', 'a.flac'),
    );
  });

  it('normalizes absolute paths without applying projectDir', () => {
    const projectDir = path.resolve('other', 'place');
    const abs = path.resolve('somewhere', 'file.wav');
    expect(resolveTrackSourceForPortableCopy(projectDir, abs)).toBe(path.resolve(abs));
  });

  it('resolves relative .. segments against the project directory', () => {
    const projectDir = path.resolve('a', 'b', 'cherry-here');
    const raw = path.join('..', '..', 'sibling', 'ext.flac');
    expect(resolveTrackSourceForPortableCopy(projectDir, raw)).toBe(path.resolve(projectDir, raw));
  });
});

describe('isResolvedPathUnderProjectDir', () => {
  it('returns true for paths inside the project (tracks subtree)', () => {
    const projectDir = path.resolve('pkg', 'MyProj');
    const inside = path.join(projectDir, 'tracks', 'a.mp3');
    expect(isResolvedPathUnderProjectDir(projectDir, inside)).toBe(true);
  });

  it('returns true when the resolved file equals the project root', () => {
    const projectDir = path.resolve('pkg', 'MyProj');
    expect(isResolvedPathUnderProjectDir(projectDir, projectDir)).toBe(true);
  });

  it('returns false for paths that resolve with .. outside the project', () => {
    const projectDir = path.resolve('pkg', 'MyProj');
    const outside = path.resolve(projectDir, '..', 'outside', 'b.wav');
    expect(isResolvedPathUnderProjectDir(projectDir, outside)).toBe(false);
  });

  it('returns false for an absolute file path that is a sibling of the project parent', () => {
    const projectDir = path.resolve('mount', 'a', 'proj');
    const outside = path.join(path.resolve(projectDir, '..'), 'sibling', 'c.mp3');
    expect(isResolvedPathUnderProjectDir(projectDir, outside)).toBe(false);
  });
});

describe('getPortableTrackSourceResolutionMeta (strict portable policy markers)', () => {
  it('marks in-project relative path as not outside the project', () => {
    const projectDir = path.resolve('p');
    const meta = getPortableTrackSourceResolutionMeta(
      projectDir,
      path.join('tracks', 'r', 'x.flac'),
    );
    expect(meta.outsideProjectDir).toBe(false);
    expect(meta.absolute).toBe(path.resolve(projectDir, 'tracks', 'r', 'x.flac'));
  });

  it('marks .. path that leaves the project as outsideProjectDir', () => {
    const projectDir = path.resolve('my', 'proj');
    const raw = path.join('..', '..', 'media', 'a.m4a');
    const meta = getPortableTrackSourceResolutionMeta(projectDir, raw);
    expect(meta.outsideProjectDir).toBe(true);
    expect(meta.absolute).toBe(path.resolve(projectDir, raw));
  });
});

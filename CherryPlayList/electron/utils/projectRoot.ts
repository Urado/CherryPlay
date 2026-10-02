import * as fs from 'fs';

export const getDevProjectRoot = (): string => fs.realpathSync.native(process.cwd());

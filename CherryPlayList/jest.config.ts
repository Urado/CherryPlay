import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^music-metadata$': '<rootDir>/tests/__mocks__/music-metadata.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@workspaces/(.*)$': '<rootDir>/src/workspaces/$1',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@cherryplay/components$': '<rootDir>/../CherryPlayComponents/src/index.ts',
    '^@cherryplay/components/(.*)$': '<rootDir>/../CherryPlayComponents/src/$1',
    // Legacy test import paths (pre-refactor src/state, src/hooks, …)
    '^\\.\\./\\.\\./src/state/(.*)$': '<rootDir>/src/shared/stores/$1',
    '^\\.\\./\\.\\./src/components/(.*)$': '<rootDir>/src/shared/components/$1',
    '^\\.\\./\\.\\./src/hooks/(.*)$': '<rootDir>/src/shared/hooks/$1',
    '^\\.\\./\\.\\./src/utils/(.*)$': '<rootDir>/src/shared/utils/$1',
    '^\\.\\./\\.\\./src/types/(.*)$': '<rootDir>/src/core/types/$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.jest.json',
    },
  },
};

export default config;

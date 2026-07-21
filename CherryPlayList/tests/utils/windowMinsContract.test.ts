import { APP_MIN_WINDOW_HEIGHT, APP_MIN_WINDOW_WIDTH } from '@shared/contracts/windowMins';

/**
 * Electron main re-exports the same module (`electron/ipc/system.ts` imports
 * `src/shared/contracts/windowMins.ts`). This test guards the documented floor.
 */
describe('window minimum size contract', () => {
  it('defines the shared app-level window floor used by renderer and Electron main', () => {
    expect(APP_MIN_WINDOW_WIDTH).toBe(800);
    expect(APP_MIN_WINDOW_HEIGHT).toBe(600);
  });
});

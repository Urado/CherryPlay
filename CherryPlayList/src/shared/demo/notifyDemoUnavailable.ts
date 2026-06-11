import { getPlatformUnavailableMessage } from '../platform/demoUnavailable';
import { useUIStore } from '../stores/uiStore';

/** Shows the standard blocked-feature toast (demo vs platform copy). */
export function notifyDemoUnavailable(): void {
  useUIStore.getState().addNotification({
    type: 'info',
    message: getPlatformUnavailableMessage(),
  });
}

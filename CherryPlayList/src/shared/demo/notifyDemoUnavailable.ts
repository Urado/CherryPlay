import { getPlatformUnavailableMessage } from '../platform/demoUnavailable';
import { useUIStore } from '../stores/uiStore';

export function notifyDemoUnavailable(): void {
  useUIStore.getState().addNotification({
    type: 'warning',
    message: getPlatformUnavailableMessage(),
  });
}

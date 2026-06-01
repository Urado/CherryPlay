import { DEMO_UNAVAILABLE_MESSAGE } from '../platform/demoUnavailable';
import { useUIStore } from '../stores/uiStore';

/** Shows the standard demo limitation toast (exact copy per web-demo spec). */
export function notifyDemoUnavailable(): void {
  useUIStore.getState().addNotification({
    type: 'info',
    message: DEMO_UNAVAILABLE_MESSAGE,
  });
}

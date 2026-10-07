import { MeetAdapter } from '../adapters/meet/meet-adapter';
import { SecurityPanelHost } from '../ui/security-panel-host';
import { isActiveGoogleMeetUrl } from './meeting-detection';

const adapter = new MeetAdapter(document);
const panelHost = new SecurityPanelHost();

function emit(message: string): void {
  console.info(`[ClassGuard] ${message}`);
}

function initialize(): void {
  if (!isActiveGoogleMeetUrl(window.location.href)) return;

  const observed = adapter.detectMeeting();
  if (observed) {
    emit('Meeting detected');
    emit('Protection active');
    panelHost.mount();
    adapter.start();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}

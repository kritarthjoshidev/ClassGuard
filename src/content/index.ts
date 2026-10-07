import { MeetAdapter } from '../adapters/meet/meet-adapter';
import { SecurityPanelHost } from '../ui/security-panel-host';
import { isActiveGoogleMeetUrl } from './meeting-detection';

const panelHost = new SecurityPanelHost();
const adapter = new MeetAdapter(document, (participants) => panelHost.setParticipants(participants));

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

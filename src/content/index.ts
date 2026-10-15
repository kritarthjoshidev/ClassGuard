import { MeetAdapter } from '../adapters/meet/meet-adapter';
import { SecurityPanelHost } from '../ui/security-panel-host';
import { isActiveGoogleMeetUrl } from './meeting-detection';

const panelHost = new SecurityPanelHost();
const chatActivity = { messagesObserved: 0, suspiciousLinks: 0 };
const adapter = new MeetAdapter(
  document,
  (participants) => panelHost.setParticipants(participants),
  (event) => {
    if (event.type === 'CHAT_MESSAGE') chatActivity.messagesObserved += 1;
    if (event.type === 'SUSPICIOUS_LINK') chatActivity.suspiciousLinks += 1;
    panelHost.setChatActivity({ ...chatActivity });
    emit(`Chat activity detected: ${event.type}`);
  },
);

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

export const MEET_PAGE_SELECTOR = 'body';
export const CHAT_PANEL_SELECTOR = '[aria-label*="Chat"], [data-tooltip*="Chat"]';

/**
 * This is the only participant candidate selector used by the detector.
 * Google Meet does not guarantee this attribute's presence or stability across
 * pages/versions. It is an ephemeral DOM-scoped hint, not a persistent identity,
 * account ID, or verified Google Meet participant identifier.
 *
 * The detector extracts only the displayed name from the matching element and
 * deliberately rejects generic participant UI labels and unrelated page controls.
 */
export const PARTICIPANT_SELECTOR = '[data-participant-id]';

export const NOTIFICATION_SELECTOR = '[role="alert"], [aria-live="polite"]';

export const MEET_PAGE_SELECTOR = 'body';
export const CHAT_PANEL_SELECTOR = '[aria-label*="Chat"], [data-tooltip*="Chat"]';

/**
 * Google Meet does not expose a guarantee in this repository that a particular
 * data attribute or class is a stable participant identity. These selectors are
 * intentionally limited to participant-specific DOM candidates and must not be
 * treated as verified identity data.
 */
export const PARTICIPANT_SELECTOR = '[data-participant-id]';

export const NOTIFICATION_SELECTOR = '[role="alert"], [aria-live="polite"]';

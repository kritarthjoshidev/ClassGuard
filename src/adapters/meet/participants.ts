const UI_TEXT_PATTERN = /frame_person|more options|more_vert|backgrounds and effects|visual_effects|you're continuously|microphone|camera|settings|chat|unmute/i;

function isUiControlText(value: string): boolean {
  return UI_TEXT_PATTERN.test(value);
}

function cleanName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized && !isUiControlText(normalized) ? normalized : '';
}

function extractFromNameElement(element: HTMLElement): string {
  const nameSelectors = [
    '[data-participant-name]',
    '[data-participant-display-name]',
    '[data-participant-name-element]',
    '[data-name]',
    '[data-testid*="participant-name"]',
    '[data-testid*="person-name"]',
  ];

  for (const selector of nameSelectors) {
    const candidate = element.querySelector<HTMLElement>(selector);
    const name = candidate ? cleanName(candidate.textContent ?? candidate.getAttribute('aria-label') ?? '') : '';
    if (name) return name;
  }

  const descendantCandidates = Array.from(element.querySelectorAll<HTMLElement>('*'))
    .map((candidate) => ({
      candidate,
      name: cleanName(candidate.textContent ?? ''),
    }))
    .filter(({ candidate, name }) => {
      const directText = cleanName(candidate.textContent ?? '');
      const hasControlText = /(?:frame_person|reframe|more_vert|visual_effects|backgrounds and effects|more options|devices|microphone|camera|settings|chat|unmute|others might still see|leave call)/i.test(directText);
      const hasChildName = candidate.querySelector('*') !== null;
      const isSingleName = directText.split(/\s+/).length <= 3 && directText.length > 0;
      return isSingleName && !hasControlText && !hasChildName;
    });

  const firstCandidate = descendantCandidates[0];
  return firstCandidate?.name ?? '';
}

export function extractParticipantName(element: Element): string {
  if (!(element instanceof HTMLElement)) return '';

  // Meet exposes the participant's display name on the list item itself.
  // Read it before descendant labels, which belong to controls such as
  // "More actions" and "You can't unmute someone else".
  const directLabel = cleanName(element.getAttribute('aria-label') ?? '');
  if (directLabel) return directLabel;

  const nestedName = extractFromNameElement(element);
  if (nestedName) return nestedName;

  return '';
}

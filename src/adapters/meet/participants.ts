const UI_TEXT_PATTERN = /frame_person|more options|backgrounds and effects|visual_effects|you're continuously|microphone|camera|settings|chat/i;

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

  const ariaCandidates = Array.from(element.querySelectorAll<HTMLElement>('[aria-label]'));
  for (const candidate of ariaCandidates) {
    const name = cleanName(candidate.getAttribute('aria-label') ?? '');
    if (name) return name;
  }

  return '';
}

export function extractParticipantName(element: Element): string {
  if (!(element instanceof HTMLElement)) return '';

  const nestedName = extractFromNameElement(element);
  if (nestedName) return nestedName;

  const directLabel = cleanName(element.getAttribute('aria-label') ?? '');
  return directLabel;
}

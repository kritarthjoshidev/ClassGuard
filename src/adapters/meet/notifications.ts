export function parseNotification(element: Element): string | null {
  return element.textContent?.trim() || null;
}

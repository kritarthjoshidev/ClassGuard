// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { SecurityPanelHost } from './security-panel-host';

describe('SecurityPanelHost pointer hit testing', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the full-screen host transparent while making the panel mount target clickable', async () => {
    const host = new SecurityPanelHost();
    host.mount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const classGuardHost = document.querySelector<HTMLElement>('[data-classguard-security-panel]');
    const mountTarget = classGuardHost?.firstElementChild as HTMLElement | null;
    const shadowRoot = mountTarget?.shadowRoot;
    const panel = shadowRoot?.querySelector<HTMLElement>('section');
    const minimizeButton = panel?.querySelector<HTMLButtonElement>('button');

    expect(classGuardHost?.style.pointerEvents).toBe('none');
    expect(mountTarget?.style.pointerEvents).toBe('auto');
    expect(panel?.getAttribute('aria-label')).toBe('ClassGuard security panel');
    expect(minimizeButton?.getAttribute('type')).toBe('button');
    expect(minimizeButton?.getAttribute('aria-label')).toBe('Minimize security panel');

    host.remove();
  });

  it('shows unattributed signals separately without inventing a participant identity', async () => {
    const host = new SecurityPanelHost();
    host.mount();
    host.setRiskPipeline({
      participantStates: [],
      unattributedObservationCount: 2,
      unattributedSignalTypes: ['SUSPICIOUS_LINK'],
      unattributedSignalCount: 2,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const classGuardHost = document.querySelector<HTMLElement>('[data-classguard-security-panel]');
    const shadowText = classGuardHost?.firstElementChild?.shadowRoot?.textContent ?? '';
    expect(shadowText).toContain('Unattributed security signals: 2');
    expect(shadowText).not.toContain('Unknown participant');

    host.remove();
  });

  it('minimizes and expands from the header button', async () => {
    const host = new SecurityPanelHost();
    host.mount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const classGuardHost = document.querySelector<HTMLElement>('[data-classguard-security-panel]');
    const shadowRoot = classGuardHost?.firstElementChild?.shadowRoot;
    const button = shadowRoot?.querySelector<HTMLButtonElement>('button');
    expect(button?.getAttribute('aria-expanded')).toBe('true');

    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button?.getAttribute('aria-label')).toBe('Expand security panel');
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(button?.getAttribute('aria-label')).toBe('Minimize security panel');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    host.remove();
  });

  it('moves the panel when the header is dragged', async () => {
    const host = new SecurityPanelHost();
    host.mount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const classGuardHost = document.querySelector<HTMLElement>('[data-classguard-security-panel]');
    const shadowRoot = classGuardHost?.firstElementChild?.shadowRoot;
    const panel = shadowRoot?.querySelector<HTMLElement>('section');
    const header = shadowRoot?.querySelector<HTMLElement>('header');
    if (!panel || !header) throw new Error('Security panel did not mount');

    panel.getBoundingClientRect = () => ({
      x: 16, y: 16, left: 16, top: 16, right: 268, bottom: 166,
      width: 252, height: 150, toJSON: () => ({}),
    });
    Object.defineProperty(header, 'setPointerCapture', { value: () => undefined });
    Object.defineProperty(header, 'hasPointerCapture', { value: () => true });
    Object.defineProperty(header, 'releasePointerCapture', { value: () => undefined });

    const pointer = (type: string, x: number, y: number): Event => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      return event;
    };
    header.dispatchEvent(pointer('pointerdown', 100, 100));
    header.dispatchEvent(pointer('pointermove', 200, 240));
    await new Promise((resolve) => setTimeout(resolve, 0));
    header.dispatchEvent(pointer('pointerup', 200, 240));

    expect(panel.style.left).toBe('116px');
    expect(panel.style.top).toBe('156px');
    host.remove();
  });
});

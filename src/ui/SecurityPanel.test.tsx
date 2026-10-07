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
});

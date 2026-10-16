// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { SecurityAlert } from '../core/types';
import { SecurityPanelHost } from './security-panel-host';

function testAlert(id = 'test-alert'): SecurityAlert {
  return {
    id,
    sourceId: 'test-message',
    category: 'PHISHING_INDICATOR',
    ruleId: 'phishing.credential-request-with-pressure',
    severity: 'MEDIUM',
    title: 'Credential request with pressure cues',
    explanation: 'Combined wording suggests a review is appropriate.',
    evidence: ['Credential-related wording', 'Urgency cue'],
    detectedAt: Date.now(),
    evidenceStrength: 'moderate',
    attribution: 'unattributed',
  };
}

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
    expect(shadowText).toContain('Unattributed risk signals: 2');
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

  it('shows real security alerts and invokes dismiss without removing history itself', async () => {
    const dismissed = vi.fn();
    const host = new SecurityPanelHost({ onDismissAlert: dismissed });
    host.mount();
    host.setRiskPipeline({
      participantStates: [],
      unattributedObservationCount: 1,
      unattributedSignalTypes: [],
      securityAlerts: [testAlert()],
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const shadowRoot = document.querySelector<HTMLElement>('[data-classguard-security-panel]')
      ?.firstElementChild?.shadowRoot;
    expect(shadowRoot?.textContent).toContain('Credential request with pressure cues');
    expect(shadowRoot?.textContent).toContain('Unknown sender · no participant score assigned');
    shadowRoot?.querySelector<HTMLButtonElement>('[aria-label^="Dismiss"]')?.click();
    expect(dismissed).toHaveBeenCalledWith('test-alert');
    expect(shadowRoot?.textContent).toContain('Credential request with pressure cues');
    host.remove();
  });

  it('renders hostile display text as text rather than HTML', async () => {
    const host = new SecurityPanelHost();
    host.mount();
    host.setParticipants([{
      domKey: 'row-1',
      participantName: '<img src=x onerror=alert(1)>',
      observedAt: Date.now(),
    }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const shadowRoot = document.querySelector<HTMLElement>('[data-classguard-security-panel]')
      ?.firstElementChild?.shadowRoot;
    expect(shadowRoot?.querySelector('img')).toBeNull();
    expect(shadowRoot?.textContent).toContain('<img src=x onerror=alert(1)>');
    host.remove();
  });

  it('wires monitoring and category settings to their real callbacks', async () => {
    const monitoring = vi.fn();
    const settings = vi.fn();
    const host = new SecurityPanelHost({ onMonitoringChange: monitoring, onSettingsChange: settings });
    host.mount();
    host.setMonitoringEnabled(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const shadowRoot = document.querySelector<HTMLElement>('[data-classguard-security-panel]')
      ?.firstElementChild?.shadowRoot;
    shadowRoot?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.click();
    const linksCheckbox = [...(shadowRoot?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? [])]
      .find((input) => input.parentElement?.textContent?.includes('URL characteristics'));
    if (!linksCheckbox) throw new Error('URL characteristics control did not mount');
    linksCheckbox.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(monitoring).toHaveBeenCalledWith(false);
    expect(settings).toHaveBeenCalledWith(expect.objectContaining({ linkSignals: false }));
    host.remove();
  });

  it('does not imply checks ran when detector startup is unavailable', async () => {
    const host = new SecurityPanelHost();
    host.mount();
    host.setMonitoringStatus('unavailable');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const shadowRoot = document.querySelector<HTMLElement>('[data-classguard-security-panel]')
      ?.firstElementChild?.shadowRoot;
    expect(shadowRoot?.textContent).toContain('Monitoring unavailable');
    expect(shadowRoot?.textContent).toContain('No security checks are currently running');
    expect(shadowRoot?.textContent).not.toContain('No alerts from the currently enabled local rules yet');
    host.remove();
  });

  it('compares expected display names only in the current panel session', async () => {
    const host = new SecurityPanelHost();
    host.mount();
    host.setParticipants([
      { domKey: 'row-1', participantName: 'Alice Sharma', observedAt: Date.now() },
      { domKey: 'row-2', participantName: 'Phoenix', observedAt: Date.now() },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const shadowRoot = document.querySelector<HTMLElement>('[data-classguard-security-panel]')
      ?.firstElementChild?.shadowRoot;
    const textarea = shadowRoot?.querySelector<HTMLTextAreaElement>('textarea');
    if (!textarea) throw new Error('Expected-name input did not mount');
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      valueSetter?.call(textarea, 'Alice Sharma');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      [...(shadowRoot?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
        .find((button) => button.textContent === 'Compare names')?.click();
    });

    expect(shadowRoot?.textContent).toContain('Display name matches your session list');
    expect(shadowRoot?.textContent).toContain('Display name is not in your session list');
    expect(shadowRoot?.textContent).toContain('does not verify identity');
    host.remove();
  });

  it('requires confirmation before calling clear-session action', async () => {
    const clearSession = vi.fn();
    const confirm = vi.fn(() => true);
    Object.defineProperty(window, 'confirm', { value: confirm, configurable: true });
    const host = new SecurityPanelHost({ onClearSession: clearSession });
    host.mount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const shadowRoot = document.querySelector<HTMLElement>('[data-classguard-security-panel]')
      ?.firstElementChild?.shadowRoot;
    const clearButton = [...(shadowRoot?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find((button) => button.textContent === 'Clear this session');
    if (!clearButton) throw new Error('Clear-session control did not mount');
    await act(async () => clearButton.click());
    expect(confirm).toHaveBeenCalledOnce();
    expect(clearSession).toHaveBeenCalledOnce();
    Reflect.deleteProperty(window, 'confirm');
    host.remove();
  });

  it('mounts cleanly again after teardown', async () => {
    const host = new SecurityPanelHost();
    host.mount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    host.remove();
    host.mount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const classGuardHost = document.querySelector<HTMLElement>('[data-classguard-security-panel]');
    expect(classGuardHost?.firstElementChild?.shadowRoot?.querySelector('section')).not.toBeNull();
    host.remove();
  });
});

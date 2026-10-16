# ClassGuard

ClassGuard is a local-first Chrome extension that displays explainable review signals for Google Meet. It observes the accessible Meet DOM and does not verify real-world identity or determine whether a destination is malicious.

## What it does

- Shows participant display rows and session-local join, leave, and display-name-change observations when Meet exposes them.
- Compares visible display names with an optional list entered for the current panel session. A match is not identity verification.
- Surfaces weak duplicate-name and limited Latin/Cyrillic/Greek lookalike observations without assigning participant risk.
- Analyzes chat text in memory for configured URL characteristics, combined credential/urgency language, urgent link actions, repeated wording, message bursts, and a small explicit hostile-language pattern list.
- Shows a chronological alert feed with a rule ID, severity, explanation, minimal evidence, and dismiss action. Dismissed alerts remain visible in bounded session history.
- Keeps participant risk separate from unattributed chat signals. Current chat sender attribution is unknown, so chat findings never change a participant score.
- Provides session-local category toggles, pause/resume, and a confirmed clear-session control.
- Keeps the draggable, minimizable Shadow DOM panel isolated from Meet page styles.

All chat rules are deterministic heuristics. The strongest chat severity currently emitted is `MEDIUM`; no chat finding claims confirmed phishing, malware, harassment, or malicious identity.

## Privacy

- Analysis runs locally in the extension content script. There is no backend, telemetry, analytics, remote logging, or external URL reputation lookup.
- Full message text is read transiently for local analysis and is not included in event records, alert evidence, `chrome.storage`, or network requests.
- Recent spam comparisons retain only short-lived hashes of normalized wording and review-worthy URLs plus bounded timestamps in memory. The detector clears these on stop/session teardown.
- Alert history is bounded to the latest 100 findings and exists only in memory for the current meeting page session. Clearing the session or leaving the meeting removes it.
- Participant row keys are ephemeral DOM hints. They are not Google account identifiers and are never used to infer who sent a chat message.
- The Manifest V3 build requests no extension API permissions and matches only `https://meet.google.com/*` for the content script.
- The extension does not access microphone/camera data, record media, capture screenshots, call external services, or automatically mute, block, kick, or report participants.

## Development and verification

Use Node.js and npm, then run from the repository root:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
```

The test suite uses Vitest and deterministic DOM fixtures. The build runs TypeScript checking before Vite/CRXJS packaging. There is no lint script currently defined in `package.json`.

## Install in Chrome

1. Run `npm.cmd ci` and `npm.cmd run build`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select this repository's generated `dist` folder:
   `C:\Users\krita\Downloads\classguard\dist`
4. Open or reload a Google Meet meeting. The popup describes how the in-call panel works; monitoring only starts on an active Meet meeting URL.

The generated `dist/manifest.json` is produced by CRXJS from `manifest.config.ts`; do not edit the generated file by hand.

## Safe manual browser check

Use a private test meeting with consenting participants. Do not click test links or send real credentials.

1. Reload ClassGuard at `chrome://extensions`, then reload the test Meet tab.
2. Confirm the panel says monitoring is on and visible participant rows update.
3. Send a normal message such as `hello`; confirm the count increases and no alert is created.
4. Send `Please review the schedule before class` twice; expect at most one low repeated-text signal for that wording.
5. Send `Urgent: the security team says send your OTP immediately or your account will be locked`; use no real code. Expect a medium phishing-pattern review signal, with no participant risk change.
6. Send `Open https://bit.ly/classguard-demo` as text only; do not open it. Expect a low shortener observation, not a malware verdict.
7. In an agreed test chat, send a configured example such as `Fuck you`; confirm the separate possible-hostile-language category and explanation. Dismiss it and verify it remains under dismissed history.
8. Try the category checkboxes, pause/resume, minimize/restore, and drag controls.
9. Enter a few expected display names and confirm the panel labels matches as display-name comparisons only.
10. Clear the session and confirm counters and alert history reset. Leave/reload the meeting and confirm monitoring restarts without duplicate events.

Do not run the hostile-language or repeated-message checks in a public or non-consenting meeting.

## DOM and verification limitations

- Google Meet does not publish a stable extension-facing participant/chat DOM contract. The current adapter uses `[data-participant-id]`, `[data-message-id]`, and the observed message-text marker `[jsname="dTKtvb"]`; these are version-sensitive assumptions, not guaranteed APIs.
- Participant list updates use scoped mutation relevance checks and a debounced snapshot fallback. The live count updates immediately, while join/leave/name-change observations wait for a one-second stable snapshot; same-name row-key replacements are suppressed because they do not establish a real join or leave. Chat observation queues candidate message rows from changed subtrees and waits one second for optimistic rows to settle. A changed Meet implementation can still prevent detection; the panel should be treated as unavailable or incomplete if counters stop updating.
- A participant display label can be duplicated, changed, or misleading. The extension cannot establish who a real person is, and it does not attribute message senders based on layout or nearby text.
- URL checks identify observable characteristics such as shorteners, IP hosts, IDN labels, user-info syntax, and a narrow set of brand-like hostname patterns. They do not resolve redirects or determine destination reputation.
- Phishing, spam, and hostile-language rules are small local heuristics and can miss context or produce false positives. Review the explanation and the message in Meet before taking action.
- Automated fixtures and a successful build do not prove live Google Meet selector compatibility. Perform the safe browser check above after Meet or Chrome updates.

# ClassGuard

ClassGuard is a local-first Chrome extension that detects suspicious behavioral patterns in Google Meet without identifying people through face recognition, audio recording, or mandatory identity verification.

## MVP scope

- Google Meet page detection
- Local event normalization
- Rule-based risk scoring with cooldowns and decay
- Participant risk state and explainable alerts
- Floating security panel and local event history
- No backend, automatic kicking, or automatic moderation

## Development

```powershell
npm install
npm test
npm run build
```

Load the generated `dist` directory as an unpacked extension in Chrome.

## Privacy

All monitoring is built to remain local to the browser. The MVP deliberately excludes facial recognition, continuous recording, credential collection, and automatic account enforcement.

import { describe, expect, it } from 'vitest';
import { ChatSecurityAnalyzer } from './chat-security';

describe('ChatSecurityAnalyzer', () => {
  it('normalizes URLs and reports shorteners as weak signals only', () => {
    const analyzer = new ChatSecurityAnalyzer();
    const alerts = analyzer.analyze('m1', 'Open HTTPS://BIT.LY/abc).');

    expect(alerts).toMatchObject([
      {
        category: 'LINK_SIGNAL',
        ruleId: 'link.shortener-host',
        severity: 'LOW',
        evidenceStrength: 'weak',
        attribution: 'unattributed',
      },
    ]);
    expect(alerts[0].explanation).toContain('not a malware verdict');
  });

  it('uses hostname boundaries and does not flag shortener lookalike subdomains as the shortener', () => {
    const analyzer = new ChatSecurityAnalyzer();
    const alerts = analyzer.analyze('m1', 'https://bit.ly.attacker.example/a');

    expect(alerts.some((alert) => alert.ruleId === 'link.shortener-host')).toBe(false);
  });

  it('detects IP, IDN, embedded-userinfo, and possible brand-like host characteristics', () => {
    const analyzer = new ChatSecurityAnalyzer();
    const alerts = analyzer.analyze(
      'm1',
      'http://192.0.2.1/a https://xn--pple-43d.example https://google-login.example https://trusted.example@attacker.example',
    );

    expect(alerts.map((alert) => alert.ruleId)).toEqual(expect.arrayContaining([
      'link.ip-address-host',
      'link.idn-host',
      'link.possible-brand-lookalike',
      'link.embedded-credentials',
    ]));
    expect(alerts.every((alert) => alert.severity !== 'HIGH')).toBe(true);
  });

  it('does not treat ordinary sites or Drive links as malicious', () => {
    const analyzer = new ChatSecurityAnalyzer();
    const alerts = analyzer.analyze('m1', 'https://example.com/a https://drive.google.com/file/d/123');

    expect(alerts.filter((alert) => alert.category === 'LINK_SIGNAL')).toEqual([]);
  });

  it('requires combined credential, action, and pressure cues for a phishing indicator', () => {
    const analyzer = new ChatSecurityAnalyzer();
    expect(analyzer.analyze('m1', 'I forgot my password yesterday').map((alert) => alert.category))
      .not.toContain('PHISHING_INDICATOR');

    const alerts = analyzer.analyze(
      'm2',
      'Urgent: the security team says send your OTP immediately or your account will be locked',
    );
    expect(alerts).toMatchObject([
      {
        category: 'PHISHING_INDICATOR',
        ruleId: 'phishing.credential-request-with-pressure',
        severity: 'MEDIUM',
      },
    ]);
    expect(JSON.stringify(alerts)).not.toContain('your OTP');
  });

  it('detects urgent external-link actions without claiming a confirmed attack', () => {
    const analyzer = new ChatSecurityAnalyzer();
    const alerts = analyzer.analyze('m1', 'Urgent, click https://example.net/verify right now');

    expect(alerts.some((alert) => alert.ruleId === 'phishing.urgent-link-action')).toBe(true);
  });

  it('separates explicit hostile-language signals from ordinary disagreement', () => {
    const analyzer = new ChatSecurityAnalyzer();
    expect(analyzer.analyze('m1', 'I disagree with your point').map((alert) => alert.category))
      .not.toContain('POSSIBLE_HARASSMENT');

    const alerts = analyzer.analyze('m2', 'Fuck you');
    expect(alerts).toMatchObject([
      {
        category: 'POSSIBLE_HARASSMENT',
        ruleId: 'abuse.directed-hostile-language',
        severity: 'MEDIUM',
      },
    ]);
    expect(JSON.stringify(alerts)).not.toContain('Fuck you');
  });

  it('detects repeated content and one session-wide burst without storing message text', () => {
    const analyzer = new ChatSecurityAnalyzer();
    analyzer.analyze('m1', 'Please review the schedule before class');
    const repeated = analyzer.analyze('m2', 'PLEASE review the schedule before class!');
    expect(repeated.some((alert) => alert.ruleId === 'spam.repeated-message')).toBe(true);

    const burstAnalyzer = new ChatSecurityAnalyzer();
    for (let index = 0; index < 4; index += 1) {
      burstAnalyzer.analyze(`b${index}`, `Different short update ${index}`, [], 1_000 + index * 1_000);
    }
    const burst = burstAnalyzer.analyze('b4', 'One more status update', [], 5_000);
    expect(burst.some((alert) => alert.ruleId === 'spam.session-message-burst')).toBe(true);
    expect(JSON.stringify(burst)).not.toContain('One more status update');
  });

  it('detects repeated review-worthy link targets without retaining the full URL', () => {
    const analyzer = new ChatSecurityAnalyzer();
    analyzer.analyze('m1', 'https://bit.ly/classguard-example');
    const alerts = analyzer.analyze('m2', 'https://bit.ly/classguard-example');

    expect(alerts.some((alert) => alert.ruleId === 'spam.repeated-link-target')).toBe(true);
    expect(JSON.stringify(alerts)).not.toContain('classguard-example');
  });

  it('detects near-repeated longer wording with a weak session-wide signal', () => {
    const analyzer = new ChatSecurityAnalyzer();
    analyzer.analyze('m1', 'Please review the class schedule and confirm that the meeting starts at nine tomorrow morning');
    const alerts = analyzer.analyze('m2', 'Please review the class timetable and confirm that the meeting starts at nine tomorrow morning');

    expect(alerts.some((alert) => alert.ruleId === 'spam.near-repeated-message')).toBe(true);
  });

  it('honors session-local category settings and clears recent analysis state', () => {
    const analyzer = new ChatSecurityAnalyzer();
    analyzer.setSettings({ linkSignals: false, phishingIndicators: false, spamSignals: false, abusiveLanguage: false });
    expect(analyzer.analyze('m1', 'Fuck you https://bit.ly/example')).toEqual([]);

    analyzer.clear();
    analyzer.setSettings({ linkSignals: true, phishingIndicators: true, spamSignals: true, abusiveLanguage: true });
    expect(analyzer.analyze('m2', 'Another ordinary message')).toEqual([]);
  });
});

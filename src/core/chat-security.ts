import type {
  ChatAnalysisSettings,
  SecurityAlert,
  SecurityAlertCategory,
  SecuritySeverity,
} from './types';
import { DEFAULT_CHAT_ANALYSIS_SETTINGS } from './types';

const URL_PATTERN = /https?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[),.;!?\]}]+$/;
const SHORTENER_HOSTS = new Set(['bit.ly', 'tinyurl.com']);
const TRUSTED_BRAND_ROOTS = ['google.com', 'microsoft.com', 'apple.com', 'zoom.us'];
const BRAND_AUTH_WORDS = /(?:login|signin|account|verify|secure|security|support|update|password)/i;
const MAX_RECENT_MESSAGES = 120;
const MESSAGE_WINDOW_MS = 120_000;
const MAX_REPORTED_PATTERNS = 200;
const MAX_URLS_PER_MESSAGE = 20;
const MAX_ANALYZED_TEXT_LENGTH = 4_000;
const MAX_FINDINGS_PER_MESSAGE = 20;

interface RecentMessage {
  at: number;
  fingerprint: string;
  tokenFingerprints: Set<string>;
}

interface UrlSignal {
  ruleId: string;
  severity: SecuritySeverity;
  title: string;
  explanation: string;
  evidence: string[];
  strength: 'weak' | 'moderate';
  host: string;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeCandidate(candidate: string): string {
  return candidate.replace(TRAILING_PUNCTUATION, '');
}

function collectUrls(messageText: string, linkedHrefs: string[]): string[] {
  const candidates = [...(messageText.match(URL_PATTERN) ?? []), ...linkedHrefs];
  const urls = new Set<string>();

  for (const candidate of candidates.slice(0, MAX_URLS_PER_MESSAGE)) {
    const cleaned = normalizeCandidate(candidate.trim());
    const withProtocol = /^www\./i.test(cleaned) ? `https://${cleaned}` : cleaned;
    try {
      const parsed = new URL(withProtocol);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
      urls.add(parsed.href);
    } catch {
      // A malformed URL-like string is not sufficient evidence for an alert.
    }
  }

  return [...urls];
}

function isIpAddress(host: string): boolean {
  if (/^\[[\da-f:.]+\]$/i.test(host)) return true;
  const parts = host.split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isTrustedBrandHost(host: string, root: string): boolean {
  return host === root || host.endsWith(`.${root}`);
}

function getUrlSignals(urls: string[]): UrlSignal[] {
  const signals: UrlSignal[] = [];

  for (const rawUrl of urls) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      continue;
    }

    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (SHORTENER_HOSTS.has(host)) {
      signals.push({
        ruleId: 'link.shortener-host',
        severity: 'LOW',
        title: 'Link shortener observed',
        explanation: 'The URL uses a configured shortener, so its final destination is not visible here. This is a review signal, not a malware verdict.',
        evidence: [`Shortener host: ${host}`],
        strength: 'weak',
        host,
      });
    }

    if (isIpAddress(host)) {
      signals.push({
        ruleId: 'link.ip-address-host',
        severity: 'LOW',
        title: 'Link uses an IP address',
        explanation: 'The web destination is written as an IP address instead of a domain name. This can be legitimate, but is less common in ordinary meeting chat.',
        evidence: ['Destination host is an IP address'],
        strength: 'weak',
        host,
      });
    }

    if (host.split('.').some((label) => label.startsWith('xn--'))) {
      signals.push({
        ruleId: 'link.idn-host',
        severity: 'LOW',
        title: 'Internationalized domain name observed',
        explanation: 'The URL contains an encoded internationalized hostname. Similar-looking characters can be hard to distinguish; this alone does not indicate abuse.',
        evidence: ['Hostname contains an IDN label'],
        strength: 'weak',
        host,
      });
    }

    if (url.username || url.password) {
      signals.push({
        ruleId: 'link.embedded-credentials',
        severity: 'MEDIUM',
        title: 'URL contains user information before its host',
        explanation: 'This URL format can make the actual destination harder to notice. Do not enter credentials unless you independently trust the destination.',
        evidence: ['URL includes user information before the hostname'],
        strength: 'moderate',
        host,
      });
    }

    const hostLabels = host.split('.');
    const deceptiveBrand = TRUSTED_BRAND_ROOTS.find((root) => {
      const brand = root.split('.')[0];
      const hasBrandLikeLabel = hostLabels.some((label) => label.includes(brand));
      const hasTrustedSuffix = isTrustedBrandHost(host, root);
      const embedsBrandRoot = host.includes(`${root}.`) && !hasTrustedSuffix;
      return !hasTrustedSuffix && (embedsBrandRoot || (hasBrandLikeLabel && BRAND_AUTH_WORDS.test(host)));
    });
    if (deceptiveBrand) {
      const brand = deceptiveBrand.split('.')[0];
      signals.push({
        ruleId: 'link.possible-brand-lookalike',
        severity: 'MEDIUM',
        title: 'Possible brand-like hostname',
        explanation: 'The hostname combines a familiar brand-like label with a different domain. Check the exact address before opening it; this heuristic cannot confirm impersonation.',
        evidence: [`Brand-like hostname pattern: ${brand}`, `Observed host: ${host}`],
        strength: 'moderate',
        host,
      });
    }
  }

  return signals;
}

function normalizeMessage(message: string): string {
  return message.slice(0, MAX_ANALYZED_TEXT_LENGTH)
    .toLocaleLowerCase()
    .replace(URL_PATTERN, ' <link> ')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenHashes(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter(Boolean).map(stableHash));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function makeAlert(
  sourceId: string,
  category: SecurityAlertCategory,
  ruleId: string,
  severity: SecuritySeverity,
  title: string,
  explanation: string,
  evidence: string[],
  detectedAt: number,
  evidenceStrength: 'weak' | 'moderate' | 'strong',
  discriminator = '',
): SecurityAlert {
  const safeEvidence = evidence.map((item) => item.slice(0, 100)).slice(0, 4);
  return {
    id: `${sourceId}:${ruleId}${discriminator ? `:${stableHash(discriminator)}` : ''}`,
    sourceId,
    category,
    ruleId,
    severity,
    title,
    explanation,
    evidence: safeEvidence,
    detectedAt,
    evidenceStrength,
    attribution: 'unattributed',
  };
}

export class ChatSecurityAnalyzer {
  private settings: ChatAnalysisSettings = { ...DEFAULT_CHAT_ANALYSIS_SETTINGS };
  private readonly recentMessages: RecentMessage[] = [];
  private readonly recentTimes: number[] = [];
  private readonly recentSuspiciousLinkHashes = new Map<string, number>();
  private readonly reportedPatterns = new Set<string>();
  private burstAlertActive = false;

  setSettings(settings: ChatAnalysisSettings): void {
    this.settings = { ...settings };
  }

  clear(): void {
    this.recentMessages.length = 0;
    this.recentTimes.length = 0;
    this.recentSuspiciousLinkHashes.clear();
    this.reportedPatterns.clear();
    this.burstAlertActive = false;
  }

  analyze(
    sourceId: string,
    messageText: string,
    linkedHrefs: string[] = [],
    now = Date.now(),
  ): SecurityAlert[] {
    const alerts: SecurityAlert[] = [];
    const urls = collectUrls(messageText.slice(0, MAX_ANALYZED_TEXT_LENGTH), linkedHrefs.slice(0, MAX_URLS_PER_MESSAGE));
    const urlSignals = this.settings.linkSignals ? getUrlSignals(urls) : [];

    for (const signal of urlSignals) {
      alerts.push(makeAlert(
        sourceId,
        'LINK_SIGNAL',
        signal.ruleId,
        signal.severity,
        signal.title,
        signal.explanation,
        signal.evidence,
        now,
        signal.strength,
        signal.host,
      ));
    }

    const normalized = normalizeMessage(messageText);
    if (this.settings.phishingIndicators) {
      const requestsCredential = /\b(password|passcode|otp|one time code|one time password|verification code|recovery code|security code)\b/i.test(normalized);
      const asksForAction = /\b(send|share|reply|provide|enter|submit|confirm|verify|type|forward)\b/i.test(normalized);
      const pressureOrAuthority = /\b(urgent|immediately|right now|within \d+ minutes|security team|administrator|account (will be )?(locked|suspended|disabled)|verify your account|google support|meeting host)\b/i.test(normalized);
      const urgentLinkAction = urls.length > 0
        && /\b(urgent|immediately|right now|account (will be )?(locked|suspended|disabled))\b/i.test(normalized)
        && /\b(click|open|visit|verify|sign in|login)\b/i.test(normalized);

      if (requestsCredential && asksForAction && pressureOrAuthority) {
        alerts.push(makeAlert(
          sourceId,
          'PHISHING_INDICATOR',
          'phishing.credential-request-with-pressure',
          'MEDIUM',
          'Credential request with pressure cues',
          'The message combines credential-related wording, an action request, and urgency or authority language. This rule-based signal is not proof of phishing.',
          ['Credential-related wording', 'Action request', 'Urgency or authority cue'],
          now,
          'moderate',
        ));
      } else if (urgentLinkAction) {
        alerts.push(makeAlert(
          sourceId,
          'PHISHING_INDICATOR',
          'phishing.urgent-link-action',
          'MEDIUM',
          'Urgent link action requested',
          'The message combines an external link with urgency and a request to open or verify something. Check the destination independently.',
          ['External URL present', 'Urgency cue', 'Link action requested'],
          now,
          'moderate',
        ));
      }
    }

    if (this.settings.abusiveLanguage) {
      const directAbuse = /\b(fuck you|go to hell|kill yourself|behen ?chod|bhen ?chod|madar ?chod|chutiya|gandu|bhosd[iy]k[ea]?|teri maa ki)\b/i.test(normalized);
      if (directAbuse) {
        alerts.push(makeAlert(
          sourceId,
          'POSSIBLE_HARASSMENT',
          'abuse.directed-hostile-language',
          'MEDIUM',
          'Possible hostile or abusive language',
          'A configured directed-hostility pattern matched. Language rules can miss context, quotation, and local usage; review the message before drawing conclusions.',
          ['Directed-hostility language pattern matched', 'Rule-based review recommended'],
          now,
          'moderate',
        ));
      }
    }

    if (this.settings.spamSignals) {
      this.addRepeatedSuspiciousLinks(sourceId, urls, urlSignals, now, alerts);
      this.addSpamSignals(sourceId, normalized, now, alerts);
    }

    return alerts.slice(0, MAX_FINDINGS_PER_MESSAGE);
  }

  private addSpamSignals(sourceId: string, normalized: string, now: number, alerts: SecurityAlert[]): void {
    const fingerprint = stableHash(normalized);
    const tokens = tokenHashes(normalized);
    const recent = this.recentMessages.filter((entry) => now - entry.at <= MESSAGE_WINDOW_MS);
    const previousExact = recent.find((entry) => entry.fingerprint === fingerprint);
    const previousNear = tokens.size >= 4
      ? recent.find((entry) => entry.tokenFingerprints.size >= 4 && jaccard(tokens, entry.tokenFingerprints) >= 0.85)
      : undefined;
    const duplicate = previousExact ?? previousNear;
    const patternKey = duplicate ? `repeat:${duplicate.fingerprint}:${fingerprint}` : '';

    if (duplicate && !this.reportedPatterns.has(patternKey)) {
      this.rememberPattern(patternKey);
      alerts.push(makeAlert(
        sourceId,
        'CHAT_SPAM',
        previousExact ? 'spam.repeated-message' : 'spam.near-repeated-message',
        'LOW',
        previousExact ? 'Repeated chat text observed' : 'Similar chat text repeated',
        'A recent message has the same or very similar normalized wording. This is a session-wide pattern and is not attributed to a participant.',
        [previousExact ? 'Exact normalized text repeated' : 'Recent wording similarity exceeded the local threshold'],
        now,
        'weak',
      ));
    }

    this.recentMessages.push({ at: now, fingerprint, tokenFingerprints: tokens });
    this.recentMessages.splice(0, Math.max(0, this.recentMessages.length - MAX_RECENT_MESSAGES));

    this.recentTimes.push(now);
    while (this.recentTimes.length > 0 && now - this.recentTimes[0] > 10_000) this.recentTimes.shift();
    if (this.recentTimes.length >= 5 && !this.burstAlertActive) {
      this.burstAlertActive = true;
      alerts.push(makeAlert(
        sourceId,
        'CHAT_SPAM',
        'spam.session-message-burst',
        'MEDIUM',
        'Fast chat burst observed',
        'At least five messages arrived in ten seconds across the session. Sender attribution is unavailable, so no participant score was changed.',
        ['At least 5 messages in 10 seconds', 'Session-wide, unattributed signal'],
        now,
        'moderate',
      ));
    } else if (this.recentTimes.length < 5) {
      this.burstAlertActive = false;
    }
  }

  private addRepeatedSuspiciousLinks(
    sourceId: string,
    urls: string[],
    urlSignals: UrlSignal[],
    now: number,
    alerts: SecurityAlert[],
  ): void {
    if (urlSignals.length === 0) return;
    for (const [key, timestamp] of this.recentSuspiciousLinkHashes) {
      if (now - timestamp > MESSAGE_WINDOW_MS) this.recentSuspiciousLinkHashes.delete(key);
    }
    const signaledHosts = new Set(urlSignals.map((signal) => signal.host));
    for (const rawUrl of urls) {
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        continue;
      }
      const host = url.hostname.toLowerCase().replace(/\.$/, '');
      if (!signaledHosts.has(host)) continue;
      const fingerprint = stableHash(url.href);
      const patternKey = `suspicious-link:${fingerprint}`;
      if (this.recentSuspiciousLinkHashes.has(fingerprint) && !this.reportedPatterns.has(patternKey)) {
        this.rememberPattern(patternKey);
        alerts.push(makeAlert(
          sourceId,
          'CHAT_SPAM',
          'spam.repeated-link-target',
          'LOW',
          'Same link target repeated',
          'A URL with a review-worthy characteristic was observed more than once. This does not establish that the destination is malicious.',
          [`Repeated destination host: ${host}`, 'Same normalized URL appeared in this session'],
          now,
          'weak',
          fingerprint,
        ));
      }
      this.recentSuspiciousLinkHashes.set(fingerprint, now);
    }
    while (this.recentSuspiciousLinkHashes.size > MAX_RECENT_MESSAGES) {
      const oldest = this.recentSuspiciousLinkHashes.keys().next().value;
      if (!oldest) break;
      this.recentSuspiciousLinkHashes.delete(oldest);
    }
  }

  private rememberPattern(pattern: string): void {
    this.reportedPatterns.add(pattern);
    if (this.reportedPatterns.size > MAX_REPORTED_PATTERNS) {
      const oldest = this.reportedPatterns.values().next().value;
      if (oldest) this.reportedPatterns.delete(oldest);
    }
  }
}

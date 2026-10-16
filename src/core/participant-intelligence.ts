import type { SecurityAlert } from './types';
import type { ParticipantObservation } from '../adapters/meet/participant-detector';
import type { DisplayNamePair } from '../adapters/meet/participants';

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function safeName(name: string | undefined): string {
  return (name ?? 'Unknown display name').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function participantObservationToAlert(observation: ParticipantObservation): SecurityAlert {
  const sourceId = `participant-observation:${hash(observation.id)}`;
  const name = safeName(observation.currentName ?? observation.previousName);
  const previousName = safeName(observation.previousName);
  const currentName = safeName(observation.currentName);

  if (observation.kind === 'joined') {
    return {
      id: `${sourceId}:joined`,
      sourceId,
      category: 'PARTICIPANT_ACTIVITY',
      ruleId: 'participant.display-row-added',
      severity: 'INFO',
      title: 'Participant display row appeared',
      explanation: 'A participant row appeared in the observable Meet UI. This is a presence observation, not an identity or risk verdict.',
      evidence: [`Displayed name: ${name}`],
      detectedAt: observation.observedAt,
      evidenceStrength: 'weak',
      attribution: 'unattributed',
    };
  }

  if (observation.kind === 'left') {
    return {
      id: `${sourceId}:left`,
      sourceId,
      category: 'PARTICIPANT_ACTIVITY',
      ruleId: 'participant.display-row-removed',
      severity: 'INFO',
      title: 'Participant display row disappeared',
      explanation: 'A participant row disappeared from the observable Meet UI. Brief UI changes can also cause this observation.',
      evidence: [`Last displayed name: ${name}`],
      detectedAt: observation.observedAt,
      evidenceStrength: 'weak',
      attribution: 'unattributed',
    };
  }

  return {
    id: `${sourceId}:renamed`,
    sourceId,
    category: 'PARTICIPANT_ACTIVITY',
    ruleId: 'participant.display-name-changed',
    severity: 'INFO',
    title: 'Displayed name changed',
    explanation: 'The label on the same session-scoped DOM row changed. This does not prove that a person or account changed identity.',
    evidence: [`Previous label: ${previousName}`, `Current label: ${currentName}`],
    detectedAt: observation.observedAt,
    evidenceStrength: 'weak',
    attribution: 'unattributed',
  };
}

export function displayNamePairToAlert(pair: DisplayNamePair, detectedAt = Date.now()): SecurityAlert {
  const rows = [pair.left, pair.right].sort((left, right) => left.domKey.localeCompare(right.domKey));
  const sourceId = `participant-pair:${hash(rows.map((row) => `${row.domKey}:${row.participantName}`).join('|'))}`;
  const duplicate = pair.kind === 'duplicate';
  return {
    id: `${sourceId}:${pair.kind}`,
    sourceId,
    category: 'PARTICIPANT_ACTIVITY',
    ruleId: duplicate ? 'participant.duplicate-display-name' : 'participant.lookalike-display-name',
    severity: 'LOW',
    title: duplicate ? 'Duplicate display names observed' : 'Similar-looking display names observed',
    explanation: 'Names are weak display-label signals only. Similarity does not prove impersonation or that two rows belong to the same person.',
    evidence: [`Displayed labels: ${safeName(pair.left.participantName)} / ${safeName(pair.right.participantName)}`],
    detectedAt,
    evidenceStrength: 'weak',
    attribution: 'unattributed',
  };
}

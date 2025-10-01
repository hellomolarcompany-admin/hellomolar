import type { AppointmentReason } from '@prisma/client';
import { AppointmentFollowUpOutcome } from '@prisma/client';

import {
  EMERGENCY_DEFAULT_DURATION_MINUTES,
  type NonEmergencyReason,
  REASON_BASE_PRIORITY,
  REASON_DEFAULT_DURATION_MINUTES,
} from './constants';

export type SwellingLevel = 'none' | 'local' | 'spreading';
export type BleedingLevel = 'none' | 'persistent';
export type ToothInjuryLevel = 'none' | 'chip' | 'broken' | 'pulp';

export interface EmergencyTriageInputs {
  painLevel: number; // 0-10 scale
  swelling: SwellingLevel;
  fever: boolean;
  bleeding: BleedingLevel;
  toothInjury: ToothInjuryLevel;
  redFlags: {
    troubleSwallowingOrBreathing: boolean;
    severeFacialTrauma: boolean;
  };
}

export function calculateEmergencyTriageScore(inputs: EmergencyTriageInputs): number {
  let score = 0;

  if (inputs.painLevel >= 9) score += 3;
  else if (inputs.painLevel >= 7) score += 2;
  else if (inputs.painLevel >= 4) score += 1;

  if (inputs.swelling === 'local') score += 2;
  else if (inputs.swelling === 'spreading') score += 4;

  if (inputs.fever) score += 2;

  if (inputs.bleeding === 'persistent') score += 3;

  if (inputs.toothInjury === 'broken') score += 1;
  else if (inputs.toothInjury === 'pulp') score += 3;

  if (inputs.redFlags.troubleSwallowingOrBreathing) score += 5;
  if (inputs.redFlags.severeFacialTrauma) score += 5;

  return score;
}

export function calculateBasePriority(reasons: AppointmentReason[]): number {
  const filtered = reasons.filter((reason) => reason !== 'EMERGENCY');
  if (!filtered.length) return 0;
  return Math.max(...filtered.map((r) => REASON_BASE_PRIORITY[r as NonEmergencyReason] ?? 0));
}

export function calculateDefaultDuration(reasons: AppointmentReason[]): number {
  if (reasons.includes('EMERGENCY')) return EMERGENCY_DEFAULT_DURATION_MINUTES;
  const unique = Array.from(new Set(reasons.filter((r) => r !== 'EMERGENCY')));
  if (!unique.length) return EMERGENCY_DEFAULT_DURATION_MINUTES;
  return unique.reduce(
    (total, reason) => total + (REASON_DEFAULT_DURATION_MINUTES[reason as NonEmergencyReason] ?? 0),
    0,
  );
}

export function deriveEffectivePriority(params: {
  isEmergency: boolean;
  basePriority: number;
  triageScore: number;
  declinePenalty: number;
}): number {
  const { isEmergency, basePriority, triageScore, declinePenalty } = params;
  const base = isEmergency ? Math.max(basePriority, 2) : basePriority;
  const emergencyScore = isEmergency ? triageScore : 0;
  return Math.max(0, base + emergencyScore - Math.max(0, declinePenalty));
}

export function determinePenaltyDelta(outcome: AppointmentFollowUpOutcome): number {
  if (outcome === AppointmentFollowUpOutcome.DECLINED_OFFER) return 1;
  return 0;
}

export function shouldCountAsContact(outcome: AppointmentFollowUpOutcome): boolean {
  return (
    outcome === AppointmentFollowUpOutcome.WHATSAPP_SENT ||
    outcome === AppointmentFollowUpOutcome.WHATSAPP_CONFIRMED ||
    outcome === AppointmentFollowUpOutcome.CALLED_APPOINTMENT_MADE ||
    outcome === AppointmentFollowUpOutcome.CALLED_NO_ANSWER ||
    outcome === AppointmentFollowUpOutcome.DECLINED_OFFER
  );
}

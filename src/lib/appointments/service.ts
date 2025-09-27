import {
  type AppointmentReason,
  type AppointmentRequest,
  type AppointmentRequestFollowUp,
  AppointmentRequestStatus,
  LocaleCode,
  type PatientEvent,
  PatientEventStatus,
  PatientEventType,
  Prisma,
  type PrismaClient,
} from '@prisma/client';

import { modules } from '@/lib/modules';

import type { AvailabilityMatrix } from './constants';
import {
  calculateBasePriority,
  calculateDefaultDuration,
  calculateEmergencyTriageScore,
  deriveEffectivePriority,
  determinePenaltyDelta,
  type EmergencyTriageInputs,
} from './logic';
import type { AppointmentRequestCreateInput, FollowUpCreateInput } from './validation';

export interface AppointmentRequestCreateParams extends AppointmentRequestCreateInput {
  tenantId: string;
  staffId?: string | null;
}

export interface AppointmentRequestCreateResult {
  request: AppointmentRequest;
  event: PatientEvent;
  createdPatientId?: string;
}

function buildSummary(reasons: AppointmentReason[], isEmergency: boolean): string {
  const base = reasons.map((r) => r.replace(/_/g, ' ')).join(', ');
  const prefix = isEmergency ? 'Emergency request' : 'Appointment request';
  return `${prefix}${base ? `: ${base}` : ''}`;
}

function serializeAvailability(
  availability: AvailabilityMatrix | undefined,
): Prisma.InputJsonValue {
  if (!availability) return {};
  const entries = Object.entries(availability).filter(
    ([, slots]) => Array.isArray(slots) && slots.length > 0,
  );
  return Object.fromEntries(entries) as Prisma.JsonObject;
}

function serializeTriage(
  inputs: EmergencyTriageInputs | undefined,
): Prisma.InputJsonValue | undefined {
  if (!inputs) return undefined;
  return {
    painLevel: inputs.painLevel,
    swelling: inputs.swelling,
    fever: inputs.fever,
    bleeding: inputs.bleeding,
    toothInjury: inputs.toothInjury,
    redFlags: inputs.redFlags,
  } as Prisma.JsonObject;
}

async function emitOutbox(
  prisma: Pick<PrismaClient, 'outboxEvent'>,
  topic: string,
  payload: Prisma.JsonObject,
) {
  try {
    await prisma.outboxEvent.create({ data: { topic, payload } });
  } catch {
    // outbox optional for now
  }
}

export async function createAppointmentRequest(
  prisma: PrismaClient,
  input: AppointmentRequestCreateParams,
): Promise<AppointmentRequestCreateResult> {
  if (!modules.apprequest) {
    throw new Error('Appointment request module disabled');
  }

  const {
    patient,
    reasons,
    isEmergency,
    triage,
    availability,
    preferredProviderIds,
    notes,
    createdByStaffId,
    plannedDurationMinutes,
    tenantId,
    preferredLocale,
  } = input;
  const creatorId = createdByStaffId ?? input.staffId ?? undefined;

  const triageScore = isEmergency && triage ? calculateEmergencyTriageScore(triage) : 0;
  const adjustedTriageScore = isEmergency ? Math.max(1, triageScore) : triageScore;
  const basePriority = calculateBasePriority(reasons);
  const declinePenalty = 0;
  const effectivePriority = deriveEffectivePriority({
    isEmergency,
    basePriority,
    triageScore: adjustedTriageScore,
    declinePenalty,
  });

  const locale = (preferredLocale as LocaleCode) ?? LocaleCode.en;

  return await prisma.$transaction(async (tx) => {
    let patientId: string;
    let createdPatientId: string | undefined;

    if (patient.mode === 'existing') {
      patientId = patient.patientId;
      await tx.patient.update({
        where: { id: patient.patientId },
        data: { preferredLocale: locale },
      });
    } else {
      const created = await tx.patient.create({
        data: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
          phone: patient.phone,
          dob: patient.dob,
          preferredLocale: locale,
        },
      });
      patientId = created.id;
      createdPatientId = created.id;
    }

    const event = await tx.patientEvent.create({
      data: {
        patientId,
        occurredAt: new Date(),
        type: PatientEventType.APPOINTMENT_REQUEST,
        status: PatientEventStatus.OPEN,
        summary: buildSummary(reasons, isEmergency),
        payload: {
          reasons,
          isEmergency,
          triageScore: adjustedTriageScore,
          preferredLocale: locale,
        },
        createdByStaffId: creatorId,
      },
    });

    const request = await tx.appointmentRequest.create({
      data: {
        eventId: event.id,
        patientId,
        status: AppointmentRequestStatus.UNSCHEDULED,
        reasons,
        plannedDurationMinutes: plannedDurationMinutes ?? calculateDefaultDuration(reasons),
        isEmergency,
        basePriority,
        triageScore: adjustedTriageScore,
        declinePenalty,
        effectivePriority,
        triageInputs: serializeTriage(triage),
        preferredProviderIds: preferredProviderIds ?? [],
        availabilityMatrix: serializeAvailability(availability),
        notes,
        createdByStaffId: creatorId,
        preferredLocale: locale,
      },
    });

    await emitOutbox(tx, 'appointment.requested', {
      id: request.id,
      patientId,
      tenantId,
      reasons,
      isEmergency,
      basePriority,
      triageScore: adjustedTriageScore,
      effectivePriority,
      preferredLocale: locale,
    });

    return { request, event, createdPatientId };
  });
}

export interface FollowUpCreateParams extends FollowUpCreateInput {
  tenantId: string;
  request: AppointmentRequest;
}

export async function logFollowUp(
  prisma: PrismaClient,
  params: FollowUpCreateParams,
): Promise<{
  followUp: AppointmentRequestFollowUp;
  event?: PatientEvent;
  request: AppointmentRequest;
}> {
  if (!modules.apprequest) {
    throw new Error('Appointment request module disabled');
  }

  const { request, tenantId, outcome, channel, occurredAt, notes, staffId, recordEvent } = params;
  const penaltyDelta = determinePenaltyDelta(outcome);
  const affectsPriority = penaltyDelta > 0;

  return await prisma.$transaction(async (tx) => {
    let event: PatientEvent | undefined;
    if (recordEvent) {
      event = await tx.patientEvent.create({
        data: {
          patientId: request.patientId,
          occurredAt,
          type: PatientEventType.CONTACT,
          status: PatientEventStatus.RESOLVED,
          summary: `${channel.replace(/_/g, ' ')}: ${outcome.replace(/_/g, ' ')}`,
          payload: {
            requestId: request.id,
            channel,
            outcome,
            notes,
          },
          createdByStaffId: staffId,
        },
      });
    }

    const followUp = await tx.appointmentRequestFollowUp.create({
      data: {
        requestId: request.id,
        eventId: event?.id,
        occurredAt,
        channel,
        outcome,
        notes,
        affectsPriority,
        priorityDelta: penaltyDelta,
        staffId,
      },
    });

    const declinePenalty = request.declinePenalty + penaltyDelta;
    const effectivePriority = deriveEffectivePriority({
      isEmergency: request.isEmergency,
      basePriority: request.basePriority,
      triageScore: request.triageScore,
      declinePenalty,
    });

    const updatedRequest = await tx.appointmentRequest.update({
      where: { id: request.id },
      data: {
        declinePenalty,
        effectivePriority,
        lastContactAt: occurredAt,
      },
    });

    await emitOutbox(tx, 'appointment.followup', {
      id: followUp.id,
      requestId: request.id,
      tenantId,
      channel,
      outcome,
      affectsPriority,
      declinePenalty,
      effectivePriority,
    });

    return { followUp, event, request: updatedRequest };
  });
}

export async function updateRequestStatus(
  prisma: PrismaClient,
  requestId: string,
  tenantId: string,
  data: Partial<{
    status: AppointmentRequestStatus;
    plannedDurationMinutes: number;
    preferredProviderIds: string[];
    availability: Record<string, string[]>;
    notes?: string;
    reasons?: AppointmentReason[];
    triage?: EmergencyTriageInputs | undefined;
    preferredLocale?: LocaleCode;
  }>,
): Promise<AppointmentRequest> {
  if (!modules.apprequest) {
    throw new Error('Appointment request module disabled');
  }

  const existing = await prisma.appointmentRequest.findUnique({ where: { id: requestId } });
  if (!existing) {
    throw new Error('Appointment request not found');
  }

  const reasons = data.reasons ?? existing.reasons;
  const isEmergency = reasons.includes('EMERGENCY');
  const triageScore = isEmergency
    ? data.triage
      ? calculateEmergencyTriageScore(data.triage)
      : existing.triageScore
    : 0;
  const adjustedUpdateTriageScore = isEmergency ? Math.max(1, triageScore) : triageScore;
  const basePriority = calculateBasePriority(reasons);
  const plannedDuration = data.plannedDurationMinutes ?? existing.plannedDurationMinutes;
  const declinePenalty = existing.declinePenalty;
  const effectivePriority = deriveEffectivePriority({
    isEmergency,
    basePriority,
    triageScore,
    declinePenalty,
  });
  const triageInputsJson = isEmergency
    ? data.triage
      ? serializeTriage(data.triage)
      : ((existing.triageInputs as Prisma.InputJsonValue | null) ?? Prisma.JsonNull)
    : Prisma.JsonNull;
  const newPreferredLocale = data.preferredLocale ?? existing.preferredLocale ?? LocaleCode.en;

  const updated = await prisma.appointmentRequest.update({
    where: { id: requestId },
    data: {
      status: data.status ?? existing.status,
      plannedDurationMinutes: plannedDuration,
      preferredProviderIds: data.preferredProviderIds ?? existing.preferredProviderIds,
      availabilityMatrix: data.availability
        ? serializeAvailability(data.availability)
        : ((existing.availabilityMatrix as Prisma.InputJsonValue | null) ?? Prisma.JsonNull),
      notes: data.notes ?? existing.notes,
      reasons,
      basePriority,
      triageScore: adjustedUpdateTriageScore,
      effectivePriority,
      triageInputs: triageInputsJson,
      isEmergency,
      preferredLocale: newPreferredLocale,
    },
  });

  if (data.preferredLocale) {
    await prisma.patient.update({
      where: { id: existing.patientId },
      data: { preferredLocale: data.preferredLocale },
    });
  }

  await prisma.patientEvent.update({
    where: { id: existing.eventId },
    data: {
      summary: buildSummary(reasons, isEmergency),
      status:
        updated.status === AppointmentRequestStatus.UNSCHEDULED
          ? PatientEventStatus.OPEN
          : PatientEventStatus.RESOLVED,
      payload: {
        reasons,
        isEmergency,
        triageScore: adjustedUpdateTriageScore,
        status: updated.status,
        preferredLocale: newPreferredLocale,
      },
    },
  });

  await emitOutbox(prisma, 'appointment.updated', {
    id: updated.id,
    tenantId,
    status: updated.status,
    effectivePriority: updated.effectivePriority,
    preferredLocale: newPreferredLocale,
  });

  return updated;
}

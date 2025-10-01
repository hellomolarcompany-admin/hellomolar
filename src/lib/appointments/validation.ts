import {
  AppointmentContactChannel,
  AppointmentFollowUpOutcome,
  AppointmentReason,
  AppointmentRequestStatus,
} from '@prisma/client';
import { z } from 'zod';

import { locales } from '@/i18n/config';

import { TIMESLOTS, WEEKDAYS } from './constants';
import { calculateDefaultDuration } from './logic';

const localeEnum = z.enum(
  [...locales] as [typeof locales[number], ...typeof locales[number][]],
);

const weekDayEnum = z.enum(WEEKDAYS);
const timeSlotEnum = z.enum(TIMESLOTS.map((slot) => slot.id) as [string, ...string[]]);

export const availabilitySchema = z
  .record(weekDayEnum, z.array(timeSlotEnum).optional())
  .optional()
  .transform((value) => {
    if (!value) return {} as Record<string, string[]>;
    const normalized: Record<string, string[]> = {};
    for (const [day, slots] of Object.entries(value)) {
      if (slots && slots.length) {
        normalized[day] = Array.from(new Set(slots));
      }
    }
    return normalized;
  });

export const triageInputsSchema = z
  .object({
    painLevel: z
      .number({ required_error: 'Pain level is required.' })
      .min(0, 'Pain level cannot be negative.')
      .max(10, 'Pain level cannot exceed 10.'),
    swelling: z.enum(['none', 'local', 'spreading']),
    fever: z.boolean(),
    bleeding: z.enum(['none', 'persistent']),
    toothInjury: z.enum(['none', 'chip', 'broken', 'pulp']),
    redFlags: z.object({
      troubleSwallowingOrBreathing: z.boolean(),
      severeFacialTrauma: z.boolean(),
    }),
  })
  .optional();

export const patientSelectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('existing'),
    patientId: z.string().min(1, 'Select an existing patient.'),
    preferredLocale: localeEnum.optional(),
  }),
  z.object({
    mode: z.literal('new'),
    firstName: z.string().min(1, 'First name is required.'),
    lastName: z.string().min(1, 'Last name is required.'),
    email: z
      .string()
      .email('Provide a valid email.')
      .optional()
      .or(z.literal(''))
      .transform((value) => value || undefined),
    phone: z
      .string()
      .min(3, 'Provide a phone number.')
      .optional()
      .or(z.literal(''))
      .transform((value) => value || undefined),
    dob: z
      .string()
      .optional()
      .or(z.literal(''))
      .transform((value, ctx) => {
        if (!value) return undefined;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid date format for date of birth.',
            path: ['dob'],
          });
          return undefined;
        }
        return parsed;
      }),
    preferredLocale: localeEnum,
  }),
]);

const dateTransform = (value: string | undefined, ctx: z.RefinementCtx): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid date/time value.',
    });
    return undefined;
  }
  return parsed;
};

export const appointmentRequestCreateSchema = z
  .object({
    patient: patientSelectionSchema,
    reasons: z.array(z.nativeEnum(AppointmentReason)).nonempty('Select at least one reason.'),
    plannedDurationMinutes: z
      .number()
      .int()
      .min(5, 'Duration must be at least 5 minutes.')
      .max(8 * 60, 'Duration must be less than a full workday.')
      .optional(),
    preferredProviderIds: z
      .array(z.string())
      .optional()
      .transform((value) => Array.from(new Set(value ?? []))),
    availability: availabilitySchema,
    notes: z
      .string()
      .optional()
      .or(z.literal(''))
      .transform((value) => value?.trim() || undefined),
    triage: triageInputsSchema,
    createdByStaffId: z.string().optional(),
    preferredLocale: localeEnum,
  })
  .transform((raw) => {
    const isEmergency = raw.reasons.includes(AppointmentReason.EMERGENCY);
    const plannedDuration = raw.plannedDurationMinutes ?? calculateDefaultDuration(raw.reasons);
    return {
      ...raw,
      isEmergency,
      plannedDurationMinutes: plannedDuration,
      triage: isEmergency ? raw.triage : undefined,
    };
  })
  .superRefine((data, ctx) => {
    if (data.isEmergency && !data.triage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Emergency requests require triage details.',
        path: ['triage'],
      });
    }
  });

export const appointmentRequestUpdateSchema = z
  .object({
    reasons: z.array(z.nativeEnum(AppointmentReason)).optional(),
    status: z.nativeEnum(AppointmentRequestStatus).optional(),
    plannedDurationMinutes: z
      .number()
      .int()
      .min(5)
      .max(8 * 60)
      .optional(),
    preferredProviderIds: z
      .array(z.string())
      .optional()
      .transform((value) => Array.from(new Set(value ?? []))),
    availability: availabilitySchema,
    notes: z
      .string()
      .optional()
      .or(z.literal(''))
      .transform((value) => value?.trim() || undefined),
    preferredLocale: localeEnum.optional(),
  })
  .transform((raw) => {
    const plannedDurationMinutes =
      raw.plannedDurationMinutes && Number.isFinite(raw.plannedDurationMinutes)
        ? raw.plannedDurationMinutes
        : raw.reasons
          ? calculateDefaultDuration(raw.reasons)
          : undefined;
    return {
      ...raw,
      plannedDurationMinutes,
    };
  });

export const followUpCreateSchema = z.object({
  occurredAt: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value, ctx) => {
      if (!value) return new Date();
      const parsed = dateTransform(value, ctx);
      return parsed ?? new Date();
    }),
  channel: z.nativeEnum(AppointmentContactChannel),
  outcome: z.nativeEnum(AppointmentFollowUpOutcome),
  notes: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value?.trim() || undefined),
  staffId: z.string().optional(),
  recordEvent: z
    .string()
    .optional()
    .transform((value) => value === 'on' || value === 'true'),
});

export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type EmergencyTriageInput = z.infer<typeof triageInputsSchema>;
export type AppointmentRequestCreateInput = z.infer<typeof appointmentRequestCreateSchema>;
export type AppointmentRequestUpdateInput = z.infer<typeof appointmentRequestUpdateSchema>;
export type FollowUpCreateInput = z.infer<typeof followUpCreateSchema>;

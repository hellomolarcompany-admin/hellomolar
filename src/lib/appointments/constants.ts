import {
  AppointmentContactChannel,
  AppointmentFollowUpOutcome,
  type AppointmentReason,
} from '@prisma/client';

export const APPOINTMENT_REASONS: AppointmentReason[] = [
  'CHECKUP',
  'CLEANING',
  'FILLING',
  'EXTRACTION',
  'ROOT_CANAL',
  'EMERGENCY',
];

export type NonEmergencyReason = Exclude<AppointmentReason, 'EMERGENCY'>;

export const REASON_DEFAULT_DURATION_MINUTES: Record<NonEmergencyReason, number> = {
  CHECKUP: 15,
  CLEANING: 30,
  FILLING: 30,
  EXTRACTION: 30,
  ROOT_CANAL: 90,
};

export const EMERGENCY_DEFAULT_DURATION_MINUTES = 30;

export const REASON_BASE_PRIORITY: Record<NonEmergencyReason, number> = {
  CHECKUP: 0,
  CLEANING: 0,
  FILLING: 2,
  EXTRACTION: 2,
  ROOT_CANAL: 4,
};

export const APPOINTMENT_CONTACT_CHANNELS: AppointmentContactChannel[] = [
  AppointmentContactChannel.PHONE,
  AppointmentContactChannel.MAIL,
  AppointmentContactChannel.WHATSAPP,
  AppointmentContactChannel.FRONT_DESK,
];

export const APPOINTMENT_FOLLOW_UP_OUTCOMES: AppointmentFollowUpOutcome[] = [
  AppointmentFollowUpOutcome.WHATSAPP_SENT,
  AppointmentFollowUpOutcome.CALLED_NO_ANSWER,
  AppointmentFollowUpOutcome.CALLED_APPOINTMENT_MADE,
  AppointmentFollowUpOutcome.WHATSAPP_CONFIRMED,
  AppointmentFollowUpOutcome.DECLINED_OFFER,
];

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const TIMESLOTS = [
  { id: '08_10', label: '08:00 - 10:00' },
  { id: '10_12', label: '10:00 - 12:00' },
  { id: '12_14', label: '12:00 - 14:00' },
  { id: '14_16', label: '14:00 - 16:00' },
  { id: '16_PLUS', label: '16:00+' },
] as const;
export type TimeslotId = (typeof TIMESLOTS)[number]['id'];

export type AvailabilityMatrix = Partial<Record<Weekday, TimeslotId[]>>;

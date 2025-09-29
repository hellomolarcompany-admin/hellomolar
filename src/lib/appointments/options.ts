export const APPOINTMENT_REASON_OPTIONS = [
  { value: 'CHECKUP', label: 'Checkup' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'FILLING', label: 'Filling' },
  { value: 'EXTRACTION', label: 'Extraction' },
  { value: 'ROOT_CANAL', label: 'Root canal' },
  { value: 'EMERGENCY', label: 'Emergency' },
] as const;

export const FOLLOW_UP_OUTCOME_OPTIONS = [
  { value: 'WHATSAPP_SENT', label: 'WhatsApp sent' },
  { value: 'CALLED_NO_ANSWER', label: 'Called, no answer' },
  { value: 'CALLED_APPOINTMENT_MADE', label: 'Called, appointment made' },
  { value: 'WHATSAPP_CONFIRMED', label: 'WhatsApp confirmed' },
  { value: 'DECLINED_OFFER', label: 'Declined offer' },
] as const;

export const CONTACT_CHANNEL_OPTIONS = [
  { value: 'PHONE', label: 'Phone' },
  { value: 'MAIL', label: 'Mail' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'FRONT_DESK', label: 'Front desk' },
] as const;

export const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
};

export const TIMESLOT_LABELS: Record<string, string> = {
  '08_10': '08:00 - 10:00',
  '10_12': '10:00 - 12:00',
  '12_14': '12:00 - 14:00',
  '14_16': '14:00 - 16:00',
  '16_PLUS': '16:00+',
};

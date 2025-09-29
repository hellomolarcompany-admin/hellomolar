import type { Prisma } from '@prisma/client';

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function dayKeyFromDate(date: Date): string | null {
  const key = WEEKDAY_KEYS[date.getDay()];
  if (key === 'mon' || key === 'tue' || key === 'wed' || key === 'thu' || key === 'fri') {
    return key;
  }
  return null;
}

export function slotIdFromDate(date: Date): string {
  return slotIdFromTime(date.getHours(), date.getMinutes());
}

export function slotIdFromTime(hours: number, minutes: number = 0): string {
  const h = hours + minutes / 60;
  if (h < 10) return '08_10';
  if (h < 12) return '10_12';
  if (h < 14) return '12_14';
  if (h < 16) return '14_16';
  return '16_PLUS';
}

export function availabilityIncludes(
  availability: Prisma.JsonValue | null | undefined,
  dayKey: string | null,
  slotId: string,
): boolean {
  if (!availability || typeof availability !== 'object' || !dayKey) return false;
  const record = availability as Record<string, unknown>;
  const slots = record[dayKey];
  if (!Array.isArray(slots)) return false;
  return slots.some((slot) => slot === slotId);
}

export function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

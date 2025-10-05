import { Prisma } from '@prisma/client';

const DEFAULT_DECIMALS = 2;

export function decimalOrNull(value: string | null | undefined): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Prisma.Decimal(value);
}

export function decimalToString(
  value: Prisma.Decimal | null | undefined,
  precision: number = DEFAULT_DECIMALS,
): string | null {
  if (!value) return null;
  return value.toFixed(precision);
}

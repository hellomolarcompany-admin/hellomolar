import { Prisma, type PrismaClient, type TreatmentCode } from '@prisma/client';

import { decimalOrNull, decimalToString } from './money';
import {
  type TreatmentCodeCreateInput,
  type TreatmentCodeCsvRow,
  type TreatmentCodeUpdateInput,
} from './validation';

const DECIMAL_PLACES = 2;

type TenantPrisma = Pick<PrismaClient, '$transaction' | 'treatmentCode'>;

export class TreatmentCodeError extends Error {}
export class TreatmentCodeConflictError extends TreatmentCodeError {}
export class TreatmentCodeNotFoundError extends TreatmentCodeError {}
export class TreatmentCodeDependencyError extends TreatmentCodeError {}

export type TreatmentCodeDto = {
  id: string;
  code: string;
  description: string;
  category: string | null;
  priceUsd: string | null;
  priceEur: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TreatmentImportError = {
  line: number;
  message: string;
};

export type TreatmentImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: TreatmentImportError[];
};

function toDto(record: TreatmentCode): TreatmentCodeDto {
  return {
    id: record.id,
    code: record.code,
    description: record.description,
    category: record.category,
    priceUsd: decimalToString(record.priceUsd, DECIMAL_PLACES),
    priceEur: decimalToString(record.priceEur, DECIMAL_PLACES),
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapCreateData(input: TreatmentCodeCreateInput): Prisma.TreatmentCodeCreateInput {
  return {
    code: input.code,
    description: input.description,
    category: input.category,
    priceUsd: decimalOrNull(input.priceUsd),
    priceEur: decimalOrNull(input.priceEur),
    active: input.active,
  };
}

function mapUpdateData(input: TreatmentCodeUpdateInput): Prisma.TreatmentCodeUpdateInput {
  const data: Prisma.TreatmentCodeUpdateInput = {};
  if (input.code !== undefined) data.code = input.code;
  if (input.description !== undefined) data.description = input.description;
  if (input.category !== undefined) data.category = input.category;
  if (input.priceUsd !== undefined) data.priceUsd = decimalOrNull(input.priceUsd);
  if (input.priceEur !== undefined) data.priceEur = decimalOrNull(input.priceEur);
  if (input.active !== undefined) data.active = input.active;
  return data;
}

export async function listTreatmentCodes(
  prisma: TenantPrisma,
  options: { onlyActive?: boolean } = {},
): Promise<TreatmentCodeDto[]> {
  const rows = await prisma.treatmentCode.findMany({
    where: options.onlyActive ? { active: true } : undefined,
    orderBy: [{ code: 'asc' }],
  });
  return rows.map(toDto);
}

export async function getTreatmentCode(
  prisma: TenantPrisma,
  id: string,
): Promise<TreatmentCodeDto | null> {
  const record = await prisma.treatmentCode.findUnique({ where: { id } });
  return record ? toDto(record) : null;
}

export async function createTreatmentCode(
  prisma: TenantPrisma,
  input: TreatmentCodeCreateInput,
): Promise<TreatmentCodeDto> {
  try {
    const created = await prisma.treatmentCode.create({ data: mapCreateData(input) });
    return toDto(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new TreatmentCodeConflictError('A treatment code with this code already exists.');
    }
    throw error;
  }
}

export async function updateTreatmentCode(
  prisma: TenantPrisma,
  id: string,
  input: TreatmentCodeUpdateInput,
): Promise<TreatmentCodeDto> {
  try {
    const updated = await prisma.treatmentCode.update({
      where: { id },
      data: mapUpdateData(input),
    });
    return toDto(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new TreatmentCodeConflictError('A treatment code with this code already exists.');
      }
      if (error.code === 'P2025') {
        throw new TreatmentCodeNotFoundError('Treatment code not found.');
      }
    }
    throw error;
  }
}

export async function deleteTreatmentCode(prisma: TenantPrisma, id: string): Promise<void> {
  try {
    await prisma.treatmentCode.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new TreatmentCodeNotFoundError('Treatment code not found.');
      }
      if (error.code === 'P2003') {
        throw new TreatmentCodeDependencyError(
          'Treatment code is referenced by other records and cannot be deleted.',
        );
      }
    }
    throw error;
  }
}

export async function importTreatmentCodes(
  prisma: TenantPrisma,
  rows: Array<{ line: number; data: TreatmentCodeCsvRow }>,
): Promise<TreatmentImportSummary> {
  if (!rows.length) {
    return { created: 0, updated: 0, skipped: 0, errors: [] };
  }

  const errors: TreatmentImportError[] = [];
  const seen = new Set<string>();
  const normalized: Array<{ line: number; data: TreatmentCodeCsvRow }> = [];

  for (const row of rows) {
    const code = row.data.code;
    if (seen.has(code)) {
      errors.push({ line: row.line, message: `Duplicate code '${code}' in import file.` });
      continue;
    }
    seen.add(code);
    normalized.push(row);
  }

  if (!normalized.length) {
    return { created: 0, updated: 0, skipped: rows.length, errors };
  }

  const codes = normalized.map((entry) => entry.data.code);
  const existing = await prisma.treatmentCode.findMany({ where: { code: { in: codes } } });
  const lookup = new Map(existing.map((record) => [record.code, record.id]));

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const entry of normalized) {
      const { data } = entry;
      const exists = lookup.has(data.code);
      await tx.treatmentCode.upsert({
        where: { code: data.code },
        create: mapCreateData(data),
        update: mapUpdateData({
          description: data.description,
          category: data.category,
          priceUsd: data.priceUsd,
          priceEur: data.priceEur,
          active: data.active,
        }),
      });
      if (exists) updated++;
      else created++;
    }
  });

  const skipped = rows.length - normalized.length;
  return { created, updated, skipped, errors };
}

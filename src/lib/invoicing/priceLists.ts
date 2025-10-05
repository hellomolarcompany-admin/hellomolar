import {
  type PriceList,
  type PriceListEntry,
  Prisma,
  type PrismaClient,
  type TreatmentCode,
} from '@prisma/client';

import { decimalOrNull, decimalToString } from './money';
import { TreatmentCodeNotFoundError } from './treatments';
import {
  type AssignPatientPriceListInput,
  type PatientPriceOverrideUpsertInput,
  type PriceListCreateInput,
  type PriceListEntryCsvRow,
  type PriceListEntryUpsertInput,
  type PriceListUpdateInput,
} from './validation';

type TenantPrisma = Pick<
  PrismaClient,
  | '$transaction'
  | 'priceList'
  | 'priceListEntry'
  | 'patient'
  | 'patientPriceOverride'
  | 'treatmentCode'
  | 'invoice'
>;

const DECIMAL_PLACES = 2;

export class PriceListError extends Error {}
export class PriceListConflictError extends PriceListError {}
export class PriceListNotFoundError extends PriceListError {}
export class PriceListDependencyError extends PriceListError {}
export class PatientNotFoundError extends PriceListError {}

export type PriceListDto = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  active: boolean;
  entriesCount: number;
  patientCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PriceListEntryDto = {
  id: string;
  treatmentCodeId: string;
  treatmentCode: string;
  treatmentDescription: string;
  priceUsd: string | null;
  priceEur: string | null;
  updatedAt: string;
};

export type PriceListDetailDto = PriceListDto & {
  entries: PriceListEntryDto[];
};

export type PatientPriceOverrideDto = {
  treatmentCodeId: string;
  treatmentCode: string;
  treatmentDescription: string;
  priceUsd: string | null;
  priceEur: string | null;
  notes: string | null;
  updatedAt: string;
};

export type PatientPriceListAssignmentDto = {
  priceListId: string | null;
  priceListName: string | null;
};

export type PriceListEntryImportError = {
  line: number;
  message: string;
};

export type PriceListEntryImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: PriceListEntryImportError[];
};

type PriceListWithCounts = Prisma.PriceListGetPayload<{
  include: {
    _count: { select: { entries: true; patients: true } };
  };
}>;

const selectCounts = {
  _count: { select: { entries: true, patients: true } },
} satisfies Prisma.PriceListInclude;

function toDto(
  record: PriceListWithCounts | (PriceList & { _count?: { entries: number; patients: number } }),
): PriceListDto {
  const counts = record._count ?? { entries: 0, patients: 0 };
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    isDefault: record.isDefault,
    active: record.active,
    entriesCount: counts.entries,
    patientCount: counts.patients,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toEntryDto(entry: PriceListEntry & { treatment: TreatmentCode }): PriceListEntryDto {
  return {
    id: entry.id,
    treatmentCodeId: entry.treatmentCodeId,
    treatmentCode: entry.treatment.code,
    treatmentDescription: entry.treatment.description,
    priceUsd: decimalToString(entry.priceUsd, DECIMAL_PLACES),
    priceEur: decimalToString(entry.priceEur, DECIMAL_PLACES),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function toOverrideDto(
  override: Prisma.PatientPriceOverrideGetPayload<{
    include: { treatment: true };
  }>,
): PatientPriceOverrideDto {
  return {
    treatmentCodeId: override.treatmentCodeId,
    treatmentCode: override.treatment.code,
    treatmentDescription: override.treatment.description,
    priceUsd: decimalToString(override.priceUsd, DECIMAL_PLACES),
    priceEur: decimalToString(override.priceEur, DECIMAL_PLACES),
    notes: override.notes ?? null,
    updatedAt: override.updatedAt.toISOString(),
  };
}

async function ensurePriceList(prisma: TenantPrisma, id: string): Promise<PriceListWithCounts> {
  const record = await prisma.priceList.findUnique({ where: { id }, include: selectCounts });
  if (!record) throw new PriceListNotFoundError('Price list not found.');
  return record;
}

async function ensureTreatment(prisma: TenantPrisma, treatmentCodeId: string): Promise<void> {
  const exists = await prisma.treatmentCode.findUnique({ where: { id: treatmentCodeId } });
  if (!exists) throw new TreatmentCodeNotFoundError('Treatment code not found.');
}

async function ensurePatient(prisma: TenantPrisma, patientId: string) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new PatientNotFoundError('Patient not found.');
  return patient;
}

export async function listPriceLists(prisma: TenantPrisma): Promise<PriceListDto[]> {
  const records = await prisma.priceList.findMany({
    orderBy: [{ name: 'asc' }],
    include: selectCounts,
  });
  return records.map(toDto);
}

export async function getPriceList(
  prisma: TenantPrisma,
  id: string,
  options: { includeEntries?: boolean } = {},
): Promise<PriceListDto | PriceListDetailDto> {
  const priceList = await ensurePriceList(prisma, id);
  if (!options.includeEntries) {
    return toDto(priceList);
  }
  const entries = await prisma.priceListEntry.findMany({
    where: { priceListId: id },
    include: { treatment: true },
    orderBy: [{ treatment: { code: 'asc' } }],
  });
  return {
    ...toDto(priceList),
    entries: entries.map(toEntryDto),
  };
}

export async function createPriceList(
  prisma: TenantPrisma,
  input: PriceListCreateInput,
): Promise<PriceListDto> {
  try {
    const record = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.priceList.updateMany({ data: { isDefault: false }, where: { isDefault: true } });
      }
      return await tx.priceList.create({
        data: {
          name: input.name,
          description: input.description,
          isDefault: input.isDefault,
          active: input.active,
        },
        include: selectCounts,
      });
    });
    return toDto(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new PriceListConflictError('A price list with this name already exists.');
    }
    throw error;
  }
}

export async function updatePriceList(
  prisma: TenantPrisma,
  id: string,
  input: PriceListUpdateInput,
): Promise<PriceListDto> {
  await ensurePriceList(prisma, id);

  try {
    const record = await prisma.$transaction(async (tx) => {
      if (input.isDefault === true) {
        await tx.priceList.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      const updated = await tx.priceList.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
        include: selectCounts,
      });
      return updated;
    });
    return toDto(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new PriceListConflictError('A price list with this name already exists.');
    }
    throw error;
  }
}

export async function deletePriceList(prisma: TenantPrisma, id: string): Promise<void> {
  const record = await ensurePriceList(prisma, id);
  if (record.isDefault) {
    throw new PriceListDependencyError('Cannot delete the default price list.');
  }
  if (record._count.patients > 0) {
    throw new PriceListDependencyError('Price list is currently assigned to patients.');
  }
  const invoiceCount = await prisma.invoice.count({ where: { priceListId: id } });
  if (invoiceCount > 0) {
    throw new PriceListDependencyError('Price list has invoices associated with it.');
  }

  try {
    await prisma.priceListEntry.deleteMany({ where: { priceListId: id } });
    await prisma.priceList.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new PriceListDependencyError('Price list is referenced by other records.');
    }
    throw error;
  }
}

export async function listPriceListEntries(
  prisma: TenantPrisma,
  priceListId: string,
): Promise<PriceListEntryDto[]> {
  await ensurePriceList(prisma, priceListId);
  const entries = await prisma.priceListEntry.findMany({
    where: { priceListId },
    include: { treatment: true },
    orderBy: [{ treatment: { code: 'asc' } }],
  });
  return entries.map(toEntryDto);
}

export async function upsertPriceListEntry(
  prisma: TenantPrisma,
  priceListId: string,
  input: PriceListEntryUpsertInput,
): Promise<PriceListEntryDto> {
  await ensurePriceList(prisma, priceListId);
  await ensureTreatment(prisma, input.treatmentCodeId);

  const entry = await prisma.priceListEntry.upsert({
    where: {
      priceListId_treatmentCodeId: {
        priceListId,
        treatmentCodeId: input.treatmentCodeId,
      },
    },
    create: {
      priceListId,
      treatmentCodeId: input.treatmentCodeId,
      priceUsd: decimalOrNull(input.priceUsd),
      priceEur: decimalOrNull(input.priceEur),
    },
    update: {
      priceUsd: decimalOrNull(input.priceUsd),
      priceEur: decimalOrNull(input.priceEur),
    },
    include: { treatment: true },
  });

  return toEntryDto(entry);
}

export async function deletePriceListEntry(
  prisma: TenantPrisma,
  priceListId: string,
  treatmentCodeId: string,
): Promise<void> {
  await ensurePriceList(prisma, priceListId);
  await ensureTreatment(prisma, treatmentCodeId);

  try {
    await prisma.priceListEntry.delete({
      where: {
        priceListId_treatmentCodeId: {
          priceListId,
          treatmentCodeId,
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new PriceListNotFoundError('Price list entry not found.');
    }
    throw error;
  }
}

export async function listPatientOverrides(
  prisma: TenantPrisma,
  patientId: string,
): Promise<PatientPriceOverrideDto[]> {
  await ensurePatient(prisma, patientId);
  const overrides = await prisma.patientPriceOverride.findMany({
    where: { patientId },
    include: { treatment: true },
    orderBy: [{ treatment: { code: 'asc' } }],
  });
  return overrides.map(toOverrideDto);
}

export async function getPatientPriceList(
  prisma: TenantPrisma,
  patientId: string,
): Promise<PatientPriceListAssignmentDto> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { priceList: true },
  });
  if (!patient) throw new PatientNotFoundError('Patient not found.');
  return {
    priceListId: patient.priceListId ?? null,
    priceListName: patient.priceList?.name ?? null,
  };
}

export async function upsertPatientOverride(
  prisma: TenantPrisma,
  patientId: string,
  input: PatientPriceOverrideUpsertInput,
): Promise<PatientPriceOverrideDto> {
  await ensurePatient(prisma, patientId);
  await ensureTreatment(prisma, input.treatmentCodeId);

  const override = await prisma.patientPriceOverride.upsert({
    where: {
      patientId_treatmentCodeId: {
        patientId,
        treatmentCodeId: input.treatmentCodeId,
      },
    },
    create: {
      patientId,
      treatmentCodeId: input.treatmentCodeId,
      priceUsd: decimalOrNull(input.priceUsd),
      priceEur: decimalOrNull(input.priceEur),
      notes: input.notes ?? null,
    },
    update: {
      priceUsd: decimalOrNull(input.priceUsd),
      priceEur: decimalOrNull(input.priceEur),
      notes: input.notes ?? null,
    },
    include: { treatment: true },
  });

  return toOverrideDto(override);
}

export async function deletePatientOverride(
  prisma: TenantPrisma,
  patientId: string,
  treatmentCodeId: string,
): Promise<void> {
  await ensurePatient(prisma, patientId);
  await ensureTreatment(prisma, treatmentCodeId);

  try {
    await prisma.patientPriceOverride.delete({
      where: {
        patientId_treatmentCodeId: {
          patientId,
          treatmentCodeId,
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new PriceListDependencyError('Patient price override not found.');
    }
    throw error;
  }
}

export async function assignPatientPriceList(
  prisma: TenantPrisma,
  patientId: string,
  input: AssignPatientPriceListInput,
): Promise<void> {
  await ensurePatient(prisma, patientId);

  if (input.priceListId) {
    await ensurePriceList(prisma, input.priceListId);
  }

  try {
    await prisma.patient.update({
      where: { id: patientId },
      data: {
        priceListId: input.priceListId ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new PatientNotFoundError('Patient not found.');
    }
    throw error;
  }
}

export async function importPriceListEntries(
  prisma: TenantPrisma,
  priceListId: string,
  rows: Array<{ line: number; data: PriceListEntryCsvRow }>,
): Promise<PriceListEntryImportSummary> {
  await ensurePriceList(prisma, priceListId);

  if (!rows.length) {
    return { created: 0, updated: 0, skipped: 0, errors: [] };
  }

  const errors: PriceListEntryImportError[] = [];
  const unique = new Map<string, { line: number; data: PriceListEntryCsvRow }>();

  for (const row of rows) {
    const existing = unique.get(row.data.code);
    if (existing) {
      errors.push({
        line: row.line,
        message: `Duplicate code "${row.data.code}" (already provided on line ${existing.line}).`,
      });
      continue;
    }
    unique.set(row.data.code, row);
  }

  const codes = Array.from(unique.keys());
  const treatments = await prisma.treatmentCode.findMany({ where: { code: { in: codes } } });
  const treatmentMap = new Map(treatments.map((treatment) => [treatment.code, treatment.id]));

  const validRows: Array<{ line: number; treatmentCodeId: string; data: PriceListEntryCsvRow }> =
    [];
  for (const row of unique.values()) {
    const treatmentId = treatmentMap.get(row.data.code);
    if (!treatmentId) {
      errors.push({ line: row.line, message: `Unknown treatment code "${row.data.code}".` });
      continue;
    }
    if (!row.data.priceUsd && !row.data.priceEur) {
      errors.push({
        line: row.line,
        message: 'Provide at least one price (USD or EUR).',
      });
      continue;
    }
    validRows.push({ line: row.line, treatmentCodeId: treatmentId, data: row.data });
  }

  if (!validRows.length) {
    return { created: 0, updated: 0, skipped: rows.length, errors };
  }

  const existingEntries = await prisma.priceListEntry.findMany({
    where: {
      priceListId,
      treatmentCodeId: { in: validRows.map((row) => row.treatmentCodeId) },
    },
    select: { treatmentCodeId: true },
  });
  const existingSet = new Set(existingEntries.map((entry) => entry.treatmentCodeId));

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of validRows) {
      await tx.priceListEntry.upsert({
        where: {
          priceListId_treatmentCodeId: {
            priceListId,
            treatmentCodeId: row.treatmentCodeId,
          },
        },
        create: {
          priceListId,
          treatmentCodeId: row.treatmentCodeId,
          priceUsd: decimalOrNull(row.data.priceUsd),
          priceEur: decimalOrNull(row.data.priceEur),
        },
        update: {
          priceUsd: decimalOrNull(row.data.priceUsd),
          priceEur: decimalOrNull(row.data.priceEur),
        },
      });

      if (existingSet.has(row.treatmentCodeId)) updated++;
      else created++;
    }
  });

  const processedCodes = new Set(validRows.map((row) => row.data.code));
  const skipped = rows.length - processedCodes.size;

  return {
    created,
    updated,
    skipped,
    errors,
  };
}

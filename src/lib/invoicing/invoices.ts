import {
  CurrencyCode,
  type Invoice,
  InvoiceStatus,
  type Patient,
  type PriceList,
  Prisma,
  type PrismaClient,
} from '@prisma/client';

import { decimalToString } from './money';
import { PatientNotFoundError } from './priceLists';

export class InvoiceError extends Error {}
export class InvoiceConflictError extends InvoiceError {}
export class InvoiceNotFoundError extends InvoiceError {}

const DEFAULT_SEARCH_LIMIT = 20;

type TenantPrisma = Pick<
  PrismaClient,
  | 'patient'
  | 'priceList'
  | 'invoice'
  | 'invoiceLine'
  | 'invoicePayment'
  | 'priceListEntry'
  | 'patientPriceOverride'
>;

const ZERO = new Prisma.Decimal(0);

export type PatientSearchResult = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  priceListId: string | null;
  priceListName: string | null;
  priceListSource: 'patient' | 'default' | 'none';
  updatedAt: string;
};

export type PriceListResolution = {
  id: string | null;
  name: string | null;
  source: 'patient' | 'default' | 'none';
};

type PatientWithPriceList = Patient & { priceList: PriceList | null };

function formatFullName(patient: Patient): string {
  return `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || 'Unknown';
}

async function resolveDefaultPriceList(prisma: TenantPrisma): Promise<PriceList | null> {
  return await prisma.priceList.findFirst({
    where: { isDefault: true, active: true },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

async function ensurePatientWithPriceList(
  prisma: TenantPrisma,
  patientId: string,
): Promise<PatientWithPriceList> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { priceList: true },
  });
  if (!patient) throw new PatientNotFoundError('Patient not found.');
  return patient;
}

async function resolvePriceListForPatient(
  prisma: TenantPrisma,
  patient: PatientWithPriceList,
): Promise<PriceListResolution> {
  if (patient.priceList) {
    return {
      id: patient.priceList.id,
      name: patient.priceList.name,
      source: 'patient',
    };
  }
  const fallback = await resolveDefaultPriceList(prisma);
  if (fallback) {
    return { id: fallback.id, name: fallback.name, source: 'default' };
  }
  return { id: null, name: null, source: 'none' };
}

function toInvoiceDraftDto(
  invoice: Invoice,
  patient: Patient,
  resolution: PriceListResolution,
): InvoiceDraftDto {
  return {
    id: invoice.id,
    status: invoice.status,
    patientId: invoice.patientId,
    patientName: formatFullName(patient),
    currency: invoice.currency,
    priceListId: resolution.id,
    priceListName: resolution.name,
    priceListSource: resolution.source,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    subtotal: decimalToString(invoice.subtotal),
    total: decimalToString(invoice.total),
    balanceDue: decimalToString(invoice.balanceDue),
    roundingDelta: decimalToString(invoice.roundingDelta),
    roundingReason: invoice.roundingReason ?? null,
    finalizedAt: invoice.finalizedAt ? invoice.finalizedAt.toISOString() : null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

export type InvoiceDraftDto = {
  id: string;
  status: InvoiceStatus;
  patientId: string;
  patientName: string;
  currency: CurrencyCode;
  priceListId: string | null;
  priceListName: string | null;
  priceListSource: 'patient' | 'default' | 'none';
  issueDate: string;
  dueDate: string | null;
  subtotal: string | null;
  total: string | null;
  balanceDue: string | null;
  roundingDelta: string | null;
  roundingReason: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface InvoiceDraftCreateParams {
  patientId: string;
  currency?: CurrencyCode;
  dueDate?: Date | null;
}

export async function searchPatients(
  prisma: TenantPrisma,
  options: { query?: string; limit?: number } = {},
): Promise<PatientSearchResult[]> {
  const query = (options.query || '').trim();
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_SEARCH_LIMIT, 50));

  const where: Prisma.PatientWhereInput = {};
  if (query) {
    const like = { contains: query, mode: 'insensitive' as const };
    where.OR = [{ firstName: like }, { lastName: like }, { email: like }, { phone: like }];
  }

  const [patients, fallback] = await Promise.all([
    prisma.patient.findMany({
      where,
      take: limit,
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        priceList: true,
      },
    }),
    resolveDefaultPriceList(prisma),
  ]);

  return patients.map((patient) => {
    const priceList = patient.priceList ?? fallback;
    const source: 'patient' | 'default' | 'none' = patient.priceList
      ? 'patient'
      : priceList
        ? 'default'
        : 'none';
    return {
      id: patient.id,
      fullName: formatFullName(patient),
      email: patient.email || null,
      phone: patient.phone || null,
      priceListId: priceList?.id ?? null,
      priceListName: priceList?.name ?? null,
      priceListSource: source,
      updatedAt: patient.updatedAt.toISOString(),
    };
  });
}

export async function createInvoiceDraft(
  prisma: TenantPrisma,
  input: InvoiceDraftCreateParams,
): Promise<InvoiceDraftDto> {
  const patient = await ensurePatientWithPriceList(prisma, input.patientId);
  const resolution = await resolvePriceListForPatient(prisma, patient);

  try {
    const invoice = await prisma.invoice.create({
      data: {
        patientId: patient.id,
        priceListId: resolution.id,
        currency: input.currency ?? CurrencyCode.USD,
        dueDate: input.dueDate ?? undefined,
      },
    });

    const refreshed = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    return toInvoiceDraftDto(refreshed, patient, resolution);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new InvoiceConflictError('Invoice already exists.');
    }
    throw error;
  }
}

export async function getInvoiceDraft(prisma: TenantPrisma, id: string): Promise<InvoiceDraftDto> {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new InvoiceNotFoundError('Invoice not found.');
  const patient = await ensurePatientWithPriceList(prisma, invoice.patientId);
  const resolution = await resolvePriceListForPatient(prisma, patient);
  return toInvoiceDraftDto(invoice, patient, resolution);
}

export async function finalizeInvoiceDraft(
  prisma: TenantPrisma,
  id: string,
): Promise<InvoiceDraftDto> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { patient: { include: { priceList: true } } },
  });
  if (!invoice) throw new InvoiceNotFoundError('Invoice not found.');
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new InvoiceConflictError('Invoice is not editable in its current status.');
  }

  const lineCount = await prisma.invoiceLine.count({ where: { invoiceId: id } });
  if (lineCount === 0) {
    throw new InvoiceConflictError('Add at least one line before finalizing the invoice.');
  }

  const [lineAgg, paymentAgg] = await Promise.all([
    prisma.invoiceLine.aggregate({
      where: { invoiceId: id },
      _sum: { lineTotal: true },
    }),
    prisma.invoicePayment.aggregate({
      where: { invoiceId: id, status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  const subtotal = lineAgg._sum.lineTotal ?? ZERO;
  const roundingDelta = invoice.roundingDelta ?? ZERO;
  const total = subtotal.plus(roundingDelta);
  const payments = paymentAgg._sum.amount ?? ZERO;
  const balanceDue = total.minus(payments);

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: InvoiceStatus.FINAL,
      finalizedAt: new Date(),
      subtotal,
      total,
      balanceDue,
    },
    include: { patient: { include: { priceList: true } } },
  });

  const resolution = await resolvePriceListForPatient(prisma, updated.patient);
  return toInvoiceDraftDto(updated, updated.patient, resolution);
}

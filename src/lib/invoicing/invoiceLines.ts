import {
  CurrencyCode,
  type Invoice,
  type InvoiceLine,
  InvoiceStatus,
  type PriceList,
  Prisma,
  type PrismaClient,
  type StaffMember,
  type TreatmentCode,
} from '@prisma/client';

import {
  InvoiceConflictError,
  type InvoiceDraftDto,
  InvoiceError,
  InvoiceNotFoundError,
} from './invoices';
import { decimalToString } from './money';
import type {
  InvoiceLineCreatePayload,
  InvoiceLineUpdatePayload,
  InvoiceRoundingUpdatePayload,
} from './validation';

const ZERO = new Prisma.Decimal(0);

function optionalString(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

type TenantPrisma = Pick<
  PrismaClient,
  | 'invoice'
  | 'invoiceLine'
  | 'invoicePayment'
  | 'patientPriceOverride'
  | 'priceList'
  | 'priceListEntry'
  | 'treatmentCode'
>;

type InvoiceWithContext = Invoice & { patient: { priceList: PriceList | null } };

export type InvoiceLineDto = {
  id: string;
  invoiceId: string;
  treatmentCodeId: string | null;
  code: string;
  description: string;
  providerStaffId: string;
  providerName: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  lineTotal: string;
  currency: CurrencyCode;
  notes: string | null;
  lineOrder: number;
  pricingSource: 'override' | 'priceList' | 'treatment' | 'manual' | 'none';
  createdAt: string;
  updatedAt: string;
};

export class InvoiceLineError extends InvoiceError {}

function formatStaffName(staff?: Pick<StaffMember, 'firstName' | 'lastName'> | null): string {
  if (!staff) return 'Unknown provider';
  const first = staff.firstName ?? '';
  const last = staff.lastName ?? '';
  const full = `${first} ${last}`.trim();
  return full || 'Unknown provider';
}

function toDto(
  line: InvoiceLine & {
    provider?: Pick<StaffMember, 'id' | 'firstName' | 'lastName'> | null;
  },
  pricingSource: InvoiceLineDto['pricingSource'],
): InvoiceLineDto {
  return {
    id: line.id,
    invoiceId: line.invoiceId,
    treatmentCodeId: line.treatmentCodeId ?? null,
    code: line.code,
    description: line.description,
    providerStaffId: line.provider?.id ?? '',
    providerName: formatStaffName(line.provider),
    quantity: decimalToString(line.quantity) ?? '0.00',
    unitPrice: decimalToString(line.unitPrice) ?? '0.00',
    discountAmount: decimalToString(line.discountAmount) ?? '0.00',
    lineTotal: decimalToString(line.lineTotal) ?? '0.00',
    currency: line.currency,
    notes: line.notes ?? null,
    lineOrder: line.lineOrder,
    pricingSource,
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  };
}

function currencyField(currency: CurrencyCode): 'priceUsd' | 'priceEur' {
  return currency === CurrencyCode.EUR ? 'priceEur' : 'priceUsd';
}

function determinePriceListSource(
  invoice: Invoice,
  patient: { priceListId: string | null },
): 'patient' | 'default' | 'none' {
  if (invoice.priceListId && patient.priceListId === invoice.priceListId) return 'patient';
  if (invoice.priceListId) return 'default';
  return 'none';
}

async function ensureInvoiceDraft(prisma: TenantPrisma, id: string): Promise<InvoiceWithContext> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      patient: { include: { priceList: true } },
    },
  });
  if (!invoice) throw new InvoiceNotFoundError('Invoice not found.');
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new InvoiceConflictError('Invoice is not editable in its current status.');
  }
  return invoice;
}

async function resolveTreatment(
  prisma: TenantPrisma,
  treatmentCodeId: string,
): Promise<TreatmentCode> {
  const treatment = await prisma.treatmentCode.findUnique({ where: { id: treatmentCodeId } });
  if (!treatment) {
    throw new InvoiceLineError('Selected treatment code could not be found.');
  }
  if (!treatment.active) {
    throw new InvoiceLineError('Selected treatment code is inactive.');
  }
  return treatment;
}

type PricingResolution = {
  amount: Prisma.Decimal | null;
  source: InvoiceLineDto['pricingSource'];
  treatment: TreatmentCode | null;
};

async function resolveUnitPrice(
  prisma: TenantPrisma,
  invoice: InvoiceWithContext,
  treatmentCodeId: string | undefined,
): Promise<PricingResolution> {
  if (!treatmentCodeId) {
    return { amount: null, source: 'manual', treatment: null };
  }

  const treatment = await resolveTreatment(prisma, treatmentCodeId);
  const currencyKey = currencyField(invoice.currency);

  const override = await prisma.patientPriceOverride.findUnique({
    where: {
      patientId_treatmentCodeId: {
        patientId: invoice.patientId,
        treatmentCodeId,
      },
    },
  });
  if (override) {
    const price = override[currencyKey];
    if (price) {
      return { amount: price, source: 'override', treatment };
    }
  }

  if (invoice.priceListId) {
    const entry = await prisma.priceListEntry.findUnique({
      where: {
        priceListId_treatmentCodeId: {
          priceListId: invoice.priceListId,
          treatmentCodeId,
        },
      },
    });
    const price = entry?.[currencyKey];
    if (price) {
      return { amount: price, source: 'priceList', treatment };
    }
  }

  const fallback = treatment[currencyKey];
  if (fallback) {
    return { amount: fallback, source: 'treatment', treatment };
  }

  return { amount: null, source: 'none', treatment };
}

function calculateLineTotals(
  unitPrice: Prisma.Decimal,
  quantity: Prisma.Decimal,
  discount: Prisma.Decimal,
): {
  unitPrice: Prisma.Decimal;
  quantity: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
} {
  const price = unitPrice ?? ZERO;
  const qty = quantity ?? new Prisma.Decimal(1);
  const discountAmount = discount ?? ZERO;

  const gross = price.times(qty);
  const net = gross.minus(discountAmount);
  const total = net.lessThan(ZERO) ? ZERO : net;
  return {
    unitPrice: price,
    quantity: qty,
    discount: discountAmount,
    total,
  };
}

async function recalcInvoiceTotals(
  prisma: TenantPrisma,
  invoiceId: string,
): Promise<InvoiceDraftDto> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { patient: { include: { priceList: true } } },
  });
  if (!invoice) throw new InvoiceNotFoundError('Invoice not found.');

  const [lineAgg, paymentAgg] = await Promise.all([
    prisma.invoiceLine.aggregate({
      where: { invoiceId },
      _sum: { lineTotal: true },
    }),
    prisma.invoicePayment.aggregate({
      where: { invoiceId, status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  const subtotal = lineAgg._sum.lineTotal ?? ZERO;
  const roundingDelta = invoice.roundingDelta ?? ZERO;
  const total = subtotal.plus(roundingDelta);
  const payments = paymentAgg._sum.amount ?? ZERO;
  const balanceDue = total.minus(payments);

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal,
      total,
      balanceDue,
    },
    include: { patient: { include: { priceList: true } } },
  });

  return {
    id: updated.id,
    status: updated.status,
    patientId: updated.patientId,
    patientName: `${updated.patient.firstName ?? ''} ${updated.patient.lastName ?? ''}`.trim(),
    currency: updated.currency,
    priceListId: updated.priceListId,
    priceListName: updated.patient.priceList?.name ?? null,
    priceListSource: determinePriceListSource(updated, updated.patient),
    issueDate: updated.issueDate.toISOString(),
    dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
    subtotal: decimalToString(updated.subtotal),
    total: decimalToString(updated.total),
    balanceDue: decimalToString(updated.balanceDue),
    roundingDelta: decimalToString(updated.roundingDelta),
    roundingReason: updated.roundingReason ?? null,
    finalizedAt: updated.finalizedAt ? updated.finalizedAt.toISOString() : null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function listInvoiceLines(
  prisma: TenantPrisma,
  invoiceId: string,
): Promise<InvoiceLineDto[]> {
  const exists = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true },
  });
  if (!exists) throw new InvoiceNotFoundError('Invoice not found.');
  const lines = await prisma.invoiceLine.findMany({
    where: { invoiceId },
    orderBy: [{ lineOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return lines.map((line) => toDto(line, line.treatmentCodeId ? 'priceList' : 'manual'));
}

export type InvoiceLinePreviewDto = {
  code: string;
  description: string;
  unitPrice: string | null;
  pricingSource: InvoiceLineDto['pricingSource'];
};

export async function previewInvoiceLine(
  prisma: TenantPrisma,
  invoiceId: string,
  treatmentCodeId: string,
): Promise<InvoiceLinePreviewDto> {
  const invoice = await ensureInvoiceDraft(prisma, invoiceId);
  if (!treatmentCodeId) {
    throw new InvoiceLineError('Select a treatment code to preview pricing.');
  }

  const pricing = await resolveUnitPrice(prisma, invoice, treatmentCodeId);
  const treatment = pricing.treatment;
  if (!treatment) {
    throw new InvoiceLineError('Selected treatment could not be found.');
  }

  return {
    code: treatment.code,
    description: treatment.description,
    unitPrice: pricing.amount ? pricing.amount.toFixed(2) : null,
    pricingSource: pricing.source,
  };
}

function nextOrder<T extends { lineOrder: number }>(lines: T[]): number {
  if (!lines.length) return 1;
  const max = lines.reduce((acc, line) => Math.max(acc, line.lineOrder), 0);
  return max + 1;
}

export async function createInvoiceLine(
  prisma: TenantPrisma,
  invoiceId: string,
  input: InvoiceLineCreatePayload,
): Promise<{ line: InvoiceLineDto; invoice: InvoiceDraftDto }> {
  const invoice = await ensureInvoiceDraft(prisma, invoiceId);
  const treatmentCodeId = optionalString(input.treatmentCodeId);
  const pricing = await resolveUnitPrice(prisma, invoice, treatmentCodeId);

  const unitPriceDecimal =
    input.unitPrice !== undefined ? new Prisma.Decimal(input.unitPrice) : (pricing.amount ?? ZERO);
  const pricingSource: InvoiceLineDto['pricingSource'] =
    input.unitPrice !== undefined ? 'manual' : pricing.source;
  if (unitPriceDecimal.equals(ZERO) && input.unitPrice === undefined && pricing.amount === null) {
    throw new InvoiceLineError('No price available for the selected treatment in this currency.');
  }

  const quantityDecimal = new Prisma.Decimal(input.quantity ?? 1);
  const discountDecimal = new Prisma.Decimal(input.discountAmount ?? 0);
  const totals = calculateLineTotals(unitPriceDecimal, quantityDecimal, discountDecimal);

  const overrideCode = optionalString(input.code);
  const overrideDescription = optionalString(input.description);

  if (!treatmentCodeId && (!overrideCode || !overrideDescription)) {
    throw new InvoiceLineError('Provide a code and description for manual invoice lines.');
  }

  const existingLines = await prisma.invoiceLine.findMany({
    where: { invoiceId },
    select: { lineOrder: true },
  });

  const line = await prisma.invoiceLine.create({
    data: {
      invoiceId,
      treatmentCodeId: treatmentCodeId ?? null,
      providerStaffId: input.providerStaffId,
      code: overrideCode ?? (pricing.treatment ? pricing.treatment.code : 'ITEM'),
      description:
        overrideDescription ??
        (pricing.treatment ? pricing.treatment.description : 'Custom line item'),
      quantity: totals.quantity,
      unitPrice: totals.unitPrice,
      discountAmount: totals.discount,
      lineTotal: totals.total,
      currency: input.currency ?? invoice.currency,
      notes: input.notes ?? null,
      lineOrder: nextOrder(existingLines),
    },
    include: { provider: { select: { id: true, firstName: true, lastName: true } } },
  });

  const invoiceSummary = await recalcInvoiceTotals(prisma, invoiceId);
  return { line: toDto(line, pricingSource), invoice: invoiceSummary };
}

export async function updateInvoiceLine(
  prisma: TenantPrisma,
  invoiceId: string,
  lineId: string,
  input: InvoiceLineUpdatePayload,
): Promise<{ line: InvoiceLineDto; invoice: InvoiceDraftDto }> {
  await ensureInvoiceDraft(prisma, invoiceId);
  const line = await prisma.invoiceLine.findUnique({ where: { id: lineId } });
  if (!line || line.invoiceId !== invoiceId) {
    throw new InvoiceLineError('Invoice line not found.');
  }

  const unitPriceDecimal =
    input.unitPrice !== undefined ? new Prisma.Decimal(input.unitPrice) : line.unitPrice;
  const quantityDecimal =
    input.quantity !== undefined ? new Prisma.Decimal(input.quantity) : line.quantity;
  const discountDecimal =
    input.discountAmount !== undefined
      ? new Prisma.Decimal(input.discountAmount)
      : line.discountAmount;

  const totals = calculateLineTotals(unitPriceDecimal, quantityDecimal, discountDecimal);

  const data: Prisma.InvoiceLineUpdateInput = {
    quantity: totals.quantity,
    unitPrice: totals.unitPrice,
    discountAmount: totals.discount,
    lineTotal: totals.total,
    notes: input.notes ?? line.notes,
  };
  if (input.providerStaffId) {
    data.provider = { connect: { id: input.providerStaffId } };
  }

  const updated = await prisma.invoiceLine.update({
    where: { id: lineId },
    data,
    include: { provider: { select: { id: true, firstName: true, lastName: true } } },
  });

  const invoiceSummary = await recalcInvoiceTotals(prisma, invoiceId);
  const source: InvoiceLineDto['pricingSource'] =
    updated.treatmentCodeId && input.unitPrice === undefined ? 'priceList' : 'manual';
  return { line: toDto(updated, source), invoice: invoiceSummary };
}

export async function deleteInvoiceLine(
  prisma: TenantPrisma,
  invoiceId: string,
  lineId: string,
): Promise<InvoiceDraftDto> {
  await ensureInvoiceDraft(prisma, invoiceId);
  const line = await prisma.invoiceLine.findUnique({ where: { id: lineId } });
  if (!line || line.invoiceId !== invoiceId) {
    throw new InvoiceLineError('Invoice line not found.');
  }

  await prisma.invoiceLine.delete({ where: { id: lineId } });
  return recalcInvoiceTotals(prisma, invoiceId);
}

export async function updateInvoiceRounding(
  prisma: TenantPrisma,
  invoiceId: string,
  input: InvoiceRoundingUpdatePayload,
): Promise<InvoiceDraftDto> {
  const invoice = await ensureInvoiceDraft(prisma, invoiceId);

  const [lineAgg, paymentAgg] = await Promise.all([
    prisma.invoiceLine.aggregate({
      where: { invoiceId },
      _sum: { lineTotal: true },
    }),
    prisma.invoicePayment.aggregate({
      where: { invoiceId, status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  const subtotal = lineAgg._sum.lineTotal ?? ZERO;
  let roundingDelta = invoice.roundingDelta ?? ZERO;

  if (input.mode === 'manual') {
    roundingDelta = new Prisma.Decimal(input.roundingDelta ?? 0);
  } else {
    const roundTo = new Prisma.Decimal(input.roundTo ?? 1);
    if (roundTo.lessThanOrEqualTo(ZERO)) {
      throw new InvoiceLineError('Invalid rounding increment.');
    }
    const nearest = subtotal.dividedBy(roundTo).toDecimalPlaces(0).times(roundTo);
    roundingDelta = nearest.minus(subtotal);
  }

  roundingDelta = new Prisma.Decimal(roundingDelta.toFixed(2));

  const total = new Prisma.Decimal(subtotal.plus(roundingDelta).toFixed(2));
  const payments = paymentAgg._sum.amount ?? ZERO;
  const balanceDue = new Prisma.Decimal(total.minus(payments).toFixed(2));

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      roundingDelta,
      roundingReason: input.reason ?? null,
      subtotal,
      total,
      balanceDue,
    },
    include: { patient: { include: { priceList: true } } },
  });

  return {
    id: updated.id,
    status: updated.status,
    patientId: updated.patientId,
    patientName: `${updated.patient.firstName ?? ''} ${updated.patient.lastName ?? ''}`.trim(),
    currency: updated.currency,
    priceListId: updated.priceListId,
    priceListName: updated.patient.priceList?.name ?? null,
    priceListSource: determinePriceListSource(updated, updated.patient),
    issueDate: updated.issueDate.toISOString(),
    dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
    subtotal: decimalToString(updated.subtotal),
    total: decimalToString(updated.total),
    balanceDue: decimalToString(updated.balanceDue),
    roundingDelta: decimalToString(updated.roundingDelta),
    roundingReason: updated.roundingReason ?? null,
    finalizedAt: updated.finalizedAt ? updated.finalizedAt.toISOString() : null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

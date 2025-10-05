import {
  CurrencyCode,
  type InvoicePayment,
  InvoicePaymentStatus,
  InvoiceStatus,
  type PaymentMethod,
  PaymentMethodCategory,
  Prisma,
  type PrismaClient,
} from '@prisma/client';

import { InvoiceConflictError, InvoiceNotFoundError, getInvoiceDraft } from './invoices';
import { decimalToString } from './money';

const ZERO = new Prisma.Decimal(0);

export type InvoicePaymentDto = {
  id: string;
  invoiceId: string;
  paymentMethodId: string;
  methodName: string;
  methodCategory: PaymentMethodCategory;
  status: InvoicePaymentStatus;
  amount: string;
  currency: CurrencyCode;
  sequence: number;
  paidAt: string | null;
  dueAt: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoicePaymentCreateInput = {
  paymentMethodId: string;
  amount: string | number;
  reference?: string | null;
  notes?: string | null;
  dueAt?: Date | null;
};

function toDto(payment: InvoicePayment & { method: PaymentMethod }): InvoicePaymentDto {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    paymentMethodId: payment.paymentMethodId,
    methodName: payment.method.name,
    methodCategory: payment.method.category,
    status: payment.status,
    amount: decimalToString(payment.amount) ?? '0.00',
    currency: payment.currency,
    sequence: payment.sequence,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    dueAt: payment.dueAt ? payment.dueAt.toISOString() : null,
    reference: payment.reference ?? null,
    notes: payment.notes ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

export async function listInvoicePayments(
  prisma: PrismaClient,
  invoiceId: string,
): Promise<InvoicePaymentDto[]> {
  const exists = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true },
  });
  if (!exists) throw new InvoiceNotFoundError('Invoice not found.');

  const payments = await prisma.invoicePayment.findMany({
    where: { invoiceId },
    orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    include: { method: true },
  });
  return payments.map(toDto);
}

function parseAmount(value: string | number): Prisma.Decimal {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new InvoiceConflictError('Invalid payment amount.');
    return new Prisma.Decimal(value);
  }
  const trimmed = value.trim();
  if (!trimmed) throw new InvoiceConflictError('Payment amount is required.');
  if (!/^[-+]?\d+(?:[.,]\d{1,2})?$/.test(trimmed)) {
    throw new InvoiceConflictError('Payment amounts must use up to 2 decimal places.');
  }
  return new Prisma.Decimal(trimmed.replace(',', '.'));
}

export async function addInvoicePayments(
  prisma: PrismaClient,
  invoiceId: string,
  inputs: InvoicePaymentCreateInput[],
): Promise<{
  invoice: Awaited<ReturnType<typeof getInvoiceDraft>>;
  payments: InvoicePaymentDto[];
}> {
  if (!inputs.length) {
    const invoice = await getInvoiceDraft(prisma, invoiceId);
    const payments = await listInvoicePayments(prisma, invoiceId);
    return { invoice, payments };
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new InvoiceNotFoundError('Invoice not found.');
  if (invoice.status !== InvoiceStatus.FINAL && invoice.status !== InvoiceStatus.PAID) {
    throw new InvoiceConflictError('Payments can only be recorded for finalized invoices.');
  }

  const methodIds = [...new Set(inputs.map((input) => input.paymentMethodId))];
  const methods = await prisma.paymentMethod.findMany({
    where: { id: { in: methodIds }, active: true },
  });
  const methodMap = new Map(methods.map((method) => [method.id, method]));
  if (methodMap.size !== methodIds.length) {
    throw new InvoiceConflictError('One or more payment methods are invalid.');
  }

  const parsed = inputs.map((input) => {
    const amount = parseAmount(input.amount);
    if (amount.lessThanOrEqualTo(ZERO)) {
      throw new InvoiceConflictError('Payment amounts must be greater than zero.');
    }
    return {
      paymentMethodId: input.paymentMethodId,
      amount,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      dueAt: input.dueAt ?? null,
    };
  });

  await prisma.$transaction(async (tx) => {
    const currentMax = await tx.invoicePayment.aggregate({
      where: { invoiceId },
      _max: { sequence: true },
    });
    let sequence = currentMax._max.sequence ?? 0;

    for (const item of parsed) {
      const method = methodMap.get(item.paymentMethodId)!;
      const status =
        method.category === PaymentMethodCategory.CUSTOMER_ACCOUNT
          ? InvoicePaymentStatus.PENDING
          : InvoicePaymentStatus.COMPLETED;
      const paidAt = status === InvoicePaymentStatus.COMPLETED ? new Date() : undefined;
      const dueAt =
        method.category === PaymentMethodCategory.CUSTOMER_ACCOUNT
          ? (item.dueAt ?? new Date())
          : null;

      if (method.requiresReference && !item.reference) {
        throw new InvoiceConflictError(`Reference is required for ${method.name} payments.`);
      }

      sequence += 1;

      await tx.invoicePayment.create({
        data: {
          invoiceId,
          paymentMethodId: item.paymentMethodId,
          amount: item.amount,
          currency: invoice.currency,
          status,
          sequence,
          paidAt,
          dueAt,
          reference: item.reference,
          notes: item.notes,
        },
      });
    }

    const completedAgg = await tx.invoicePayment.aggregate({
      where: { invoiceId, status: InvoicePaymentStatus.COMPLETED },
      _sum: { amount: true },
    });
    const completedTotal = completedAgg._sum.amount ?? ZERO;
    let balanceDue = new Prisma.Decimal(invoice.total).minus(completedTotal);
    if (balanceDue.lessThan(ZERO)) {
      balanceDue = ZERO;
    }

    let nextStatus = invoice.status;
    let paidAt: Date | null = invoice.paidAt;
    if (balanceDue.lessThanOrEqualTo(ZERO)) {
      nextStatus = InvoiceStatus.PAID;
      paidAt = paidAt ?? new Date();
    } else if (invoice.status === InvoiceStatus.PAID) {
      nextStatus = InvoiceStatus.FINAL;
      paidAt = null;
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        balanceDue,
        status: nextStatus,
        paidAt,
      },
    });
  });

  const updatedInvoice = await getInvoiceDraft(prisma, invoiceId);
  const payments = await listInvoicePayments(prisma, invoiceId);
  return { invoice: updatedInvoice, payments };
}

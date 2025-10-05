'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import type { InvoicePaymentDto } from '@/lib/invoicing/payments';
import { cn } from '@/ui/utils';

type PaymentMethodOption = {
  id: string;
  name: string;
  requiresReference: boolean;
  category: 'STANDARD' | 'CUSTOMER_ACCOUNT';
};

type PaymentRow = {
  methodId: string;
  amount: string;
  reference: string;
  notes: string;
  dueAt: string;
};

interface Props {
  invoiceId: string;
  csrf: string;
  currency: string;
  status: string;
  balanceDue: string | null;
  payments: InvoicePaymentDto[];
  paymentMethods: PaymentMethodOption[];
}

function formatAmount(value: string | null, currency: string): string {
  const number = Number(value ?? '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

export default function InvoicePaymentsPanel({
  invoiceId,
  csrf,
  currency,
  status,
  balanceDue,
  payments,
  paymentMethods,
}: Props) {
  const router = useRouter();
  const hasMethods = paymentMethods.length > 0;
  const canRecordPayments = status !== 'DRAFT' && status !== 'VOID' && hasMethods;
  const outstanding = useMemo(() => Number(balanceDue ?? '0'), [balanceDue]);

  const defaultRow = (): PaymentRow => ({
    methodId: paymentMethods[0]?.id ?? '',
    amount: outstanding > 0 ? outstanding.toFixed(2) : '',
    reference: '',
    notes: '',
    dueAt: '',
  });

  const [rows, setRows] = useState<PaymentRow[]>([defaultRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function updateRow(index: number, changes: Partial<PaymentRow>) {
    setRows((current) => current.map((row, idx) => (idx === index ? { ...row, ...changes } : row)));
  }

  function addRow() {
    setRows((current) => [...current, defaultRow()]);
  }

  function removeRow(index: number) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((_, idx) => idx !== index),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRecordPayments) return;

    const sanitized = rows
      .map((row) => ({
        methodId: row.methodId,
        amount: row.amount.trim(),
        reference: row.reference.trim(),
        notes: row.notes.trim(),
        dueAt: row.dueAt.trim(),
      }))
      .filter((row) => row.methodId && row.amount);

    if (sanitized.length === 0) {
      setFeedback('Provide at least one payment line.');
      return;
    }

    const payload = {
      csrf,
      payments: sanitized.map((row) => ({
        paymentMethodId: row.methodId,
        amount: row.amount,
        reference: row.reference || undefined,
        notes: row.notes || undefined,
        dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : undefined,
      })),
    };

    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch(`/admin/invoicing/drafts/${invoiceId}/payments`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setFeedback(data?.message ?? 'Unable to record payments.');
        return;
      }
      setRows([defaultRow()]);
      router.refresh();
    } catch (error) {
      console.error('Failed to record payments', error);
      setFeedback('Unexpected error while recording payments.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderStatusBadge(payment: InvoicePaymentDto) {
    const isPending = payment.status === 'PENDING';
    const label = isPending
      ? 'Pending'
      : payment.status === 'CANCELLED'
        ? 'Cancelled'
        : 'Completed';
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
          isPending
            ? 'bg-amber-100 text-amber-700'
            : payment.status === 'CANCELLED'
              ? 'bg-rose-100 text-rose-700'
              : 'bg-emerald-100 text-emerald-700',
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Payments</h2>
          <p className="text-sm text-slate-600">
            Record tenders after finalizing the invoice. Split payments and partial payments are
            supported.
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-slate-900">
            Balance due: {formatAmount(balanceDue, currency)}
          </p>
          <p className="text-xs text-slate-500">Status: {status}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3 py-2 text-slate-700">
                      {payment.methodName}
                      {payment.methodCategory === 'CUSTOMER_ACCOUNT' ? (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                          Account
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {formatAmount(payment.amount, payment.currency)}
                    </td>
                    <td className="px-3 py-2">{renderStatusBadge(payment)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{payment.reference ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {payment.dueAt ? new Date(payment.dueAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{payment.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!hasMethods ? (
        <p className="mt-4 text-sm text-rose-600">
          No payment methods are configured. Add payment methods in the admin panel to capture
          payments.
        </p>
      ) : canRecordPayments ? (
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-3">
            {rows.map((row, index) => {
              const method = paymentMethods.find((option) => option.id === row.methodId);
              return (
                <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <label
                        className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                        htmlFor={`method-${index}`}
                      >
                        Method
                      </label>
                      <select
                        id={`method-${index}`}
                        value={row.methodId}
                        onChange={(event) => updateRow(index, { methodId: event.target.value })}
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="" disabled>
                          Select method
                        </option>
                        {paymentMethods.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                        htmlFor={`amount-${index}`}
                      >
                        Amount ({currency})
                      </label>
                      <input
                        id={`amount-${index}`}
                        value={row.amount}
                        onChange={(event) => updateRow(index, { amount: event.target.value })}
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                        htmlFor={`reference-${index}`}
                      >
                        Reference
                      </label>
                      <input
                        id={`reference-${index}`}
                        value={row.reference}
                        onChange={(event) => updateRow(index, { reference: event.target.value })}
                        type="text"
                        placeholder={method?.requiresReference ? 'Required' : 'Optional'}
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                        htmlFor={`due-${index}`}
                      >
                        Due date
                      </label>
                      <input
                        id={`due-${index}`}
                        value={row.dueAt}
                        onChange={(event) => updateRow(index, { dueAt: event.target.value })}
                        type="date"
                        disabled={method?.category !== 'CUSTOMER_ACCOUNT'}
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label
                      className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                      htmlFor={`notes-${index}`}
                    >
                      Notes
                    </label>
                    <textarea
                      id={`notes-${index}`}
                      value={row.notes}
                      onChange={(event) => updateRow(index, { notes: event.target.value })}
                      rows={2}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  {rows.length > 1 ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Remove line
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Add another method
            </button>
            <span className="text-xs text-slate-500">
              Suggested total: {formatAmount(balanceDue, currency)}
            </span>
          </div>

          {feedback ? <p className="text-xs text-rose-600">{feedback}</p> : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Recording…' : 'Record payments'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Finalize the invoice before recording payments.
        </p>
      )}
    </section>
  );
}

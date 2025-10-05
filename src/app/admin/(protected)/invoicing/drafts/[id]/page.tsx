import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { listInvoiceLines } from '@/lib/invoicing/invoiceLines';
import { getInvoiceDraft } from '@/lib/invoicing/invoices';
import { listInvoicePayments } from '@/lib/invoicing/payments';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

import InvoiceLineAddForm from './InvoiceLineAddForm';
import InvoicePaymentsPanel from './InvoicePaymentsPanel';

function formatMoney(value: string | null, currency: string): string {
  const amount = Number(value ?? '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function DraftPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  if (!modules.invoicing) {
    notFound();
  }
  const session = await getSession();
  if (!session) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <p className="text-sm">Unauthorized.</p>
      </main>
    );
  }
  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-4xl p-4 text-sm">
        <p>Tenant not found.</p>
      </main>
    );
  }

  const { id } = await props.params;
  const sp = (await props.searchParams) || {};
  const flash = sp.flash ?? '';
  const err = sp.err ?? '';
  const highlightLine = sp.line ?? '';
  const createdFlag = sp.created ?? '';
  const cookieStore = await cookies();
  const cookieCsrf = cookieStore.get('ADMIN_CSRF')?.value || '';

  const [invoice, lines, payments, paymentMethods, providerList, treatmentList] = await Promise.all(
    [
      getInvoiceDraft(tenant.prisma, id).catch(() => null),
      listInvoiceLines(tenant.prisma, id).catch(() => []),
      listInvoicePayments(tenant.prisma, id).catch(() => []),
      tenant.prisma.paymentMethod
        .findMany({
          where: { active: true },
          orderBy: [{ name: 'asc' }],
          select: { id: true, name: true, requiresReference: true, category: true },
        })
        .catch(() => []),
      tenant.prisma.staffMember
        .findMany({
          where: {
            active: true,
            role: { in: ['DENTIST', 'HYGIENIST', 'DENTAL_ASSISTANT'] },
          },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
          select: { id: true, firstName: true, lastName: true, role: true },
        })
        .catch(() => []),
      tenant.prisma.treatmentCode
        .findMany({
          where: { active: true },
          orderBy: [{ code: 'asc' }],
          take: 50,
          select: { id: true, code: true, description: true },
        })
        .catch(() => []),
    ],
  );

  const providers = providerList as Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  }>;

  const treatments = treatmentList as Array<{
    id: string;
    code: string;
    description: string;
  }>;

  if (!invoice) {
    return (
      <main className="mx-auto max-w-4xl p-4 text-sm">
        <p>Invoice draft not found.</p>
        <div className="mt-4">
          <Link className="text-slate-600 underline" href="/admin/invoicing">
            Back to invoicing
          </Link>
        </div>
      </main>
    );
  }

  const messages: Record<string, string> = {
    'line-created': 'Line added successfully.',
    'line-updated': 'Line updated successfully.',
    'line-deleted': 'Line removed from invoice.',
    'rounding-updated': 'Rounding adjustment saved.',
    'invoice-finalized': 'Invoice finalized successfully.',
    'payments-recorded': 'Payments recorded successfully.',
  };

  const errorMessages: Record<string, string> = {
    'line-validation': 'Please fix the highlighted line inputs and try again.',
    'line-csrf': 'Session expired. Refresh the page and try again.',
    'line-server': 'Unable to process the line update right now.',
    'line-logic': 'Unable to use automatic pricing for this treatment and currency.',
    'line-conflict': 'The invoice cannot be edited in its current state.',
    invoice: 'The invoice draft was not found.',
    'rounding-validation': 'Provide a valid rounding adjustment.',
    'rounding-csrf': 'Session expired. Refresh the page and try again.',
    'rounding-server': 'Unable to update rounding at this time.',
    'rounding-conflict': 'Rounding cannot be updated for this invoice status.',
    'finalize-payload': 'Unable to process the finalize request.',
    'finalize-csrf': 'Session expired. Refresh the page and try again.',
    'finalize-conflict': 'Invoice cannot be finalized in its current state.',
    'finalize-server': 'Unable to finalize the invoice right now.',
    'payments-validation': 'Please review the payment details and try again.',
    'payments-csrf': 'Session expired. Refresh the page and try again.',
    'payments-conflict': 'Payments could not be recorded in the current invoice state.',
    'payments-server': 'Unable to record payments right now.',
  };

  const roundingMode =
    Math.abs(parseFloat(invoice.roundingDelta ?? '0')) < 0.0001 ? 'None' : 'Custom';
  const isDraft = invoice.status === 'DRAFT';
  const finalizedAt = invoice.finalizedAt ? new Date(invoice.finalizedAt) : null;
  const finalizedLabel = finalizedAt
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
        finalizedAt,
      )
    : null;

  const providerLabel = (provider: {
    firstName: string | null;
    lastName: string | null;
    role: string;
  }) => {
    const first = provider.firstName ?? '';
    const last = provider.lastName ?? '';
    const full = `${first} ${last}`.trim();
    const roleRaw = provider.role.replace(/_/g, ' ').toLowerCase();
    const role = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1);
    return full ? `${full} (${role})` : `Unknown (${role})`;
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{isDraft ? 'Invoice draft' : 'Invoice'}</h1>
          <div className="mt-1 space-y-1 text-slate-600">
            <p>Invoice ID {invoice.id}</p>
            {!isDraft && finalizedLabel ? (
              <p className="text-xs text-emerald-700">Finalized on {finalizedLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {isDraft ? (
            <form method="post" action={`/admin/invoicing/drafts/${invoice.id}/finalize`}>
              <input type="hidden" name="csrf" value={cookieCsrf} />
              <button
                type="submit"
                className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                Finalize invoice
              </button>
            </form>
          ) : (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold text-emerald-700">
              Finalized
            </span>
          )}
          <Link className="text-slate-600 underline" href="/admin/invoicing">
            Back to patient search
          </Link>
        </div>
      </div>

      {createdFlag === '1' || flash || err ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm shadow-sm ${
            createdFlag === '1' || flash
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {createdFlag === '1'
            ? 'Draft created. Add your first line item below.'
            : flash
              ? messages[flash]
              : errorMessages[err]}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Patient</h2>
          <p className="mt-1 text-slate-700">{invoice.patientName}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Pricing</h2>
          <p className="mt-1 text-slate-700">
            {invoice.priceListName ?? 'No price list'}
            <span className="ml-1 text-xs text-slate-400">({invoice.priceListSource})</span>
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Totals</h2>
          <dl className="mt-1 space-y-1 text-slate-700">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatMoney(invoice.subtotal, invoice.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Rounding</dt>
              <dd>{formatMoney(invoice.roundingDelta, invoice.currency)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(invoice.total, invoice.currency)}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Rounding</h2>
          <p className="mt-1 text-slate-700">{roundingMode}</p>
          {invoice.roundingReason ? (
            <p className="mt-1 text-xs text-slate-500">{invoice.roundingReason}</p>
          ) : null}
        </div>
      </section>

      {isDraft ? (
        <InvoiceLineAddForm
          invoiceId={invoice.id}
          csrf={cookieCsrf}
          currency={invoice.currency}
          treatments={treatments}
          providers={providers}
        />
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Invoice lines</h2>
        <div className="mt-3 space-y-4">
          {lines.length === 0 ? (
            <p className="text-sm text-slate-500">No line items yet.</p>
          ) : (
            lines.map((line) => (
              <div
                key={line.id}
                className={`rounded border px-4 py-3 ${highlightLine === line.id ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-slate-50'}`}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {line.code} — {line.description}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Quantity {line.quantity} × {formatMoney(line.unitPrice, invoice.currency)}
                      {Number(line.discountAmount) > 0 &&
                        ` minus ${formatMoney(line.discountAmount, invoice.currency)} discount`}
                    </p>
                    {line.notes ? (
                      <p className="text-xs text-slate-500">Note: {line.notes}</p>
                    ) : null}
                    <p className="text-xs text-slate-500">
                      Provider: {line.providerName || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatMoney(line.lineTotal, invoice.currency)}
                  </div>
                </div>
                {isDraft ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                    <form
                      method="post"
                      action={`/admin/invoicing/drafts/${invoice.id}/lines/${line.id}`}
                      className="md:col-span-4 grid gap-3 md:grid-cols-4"
                    >
                      <input type="hidden" name="csrf" value={cookieCsrf} />
                      <input type="hidden" name="_action" value="update" />
                      <div>
                        <label
                          className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                          htmlFor={`provider-${line.id}`}
                        >
                          Provider
                        </label>
                        <select
                          id={`provider-${line.id}`}
                          name="providerStaffId"
                          defaultValue={line.providerStaffId}
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                          disabled={providers.length === 0}
                        >
                          {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {providerLabel(provider)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                          htmlFor={`qty-${line.id}`}
                        >
                          Quantity
                        </label>
                        <input
                          id={`qty-${line.id}`}
                          name="quantity"
                          defaultValue={line.quantity}
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                          htmlFor={`unit-${line.id}`}
                        >
                          Unit price
                        </label>
                        <input
                          id={`unit-${line.id}`}
                          name="unitPrice"
                          defaultValue={line.unitPrice}
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                          htmlFor={`discount-${line.id}`}
                        >
                          Discount
                        </label>
                        <input
                          id={`discount-${line.id}`}
                          name="discountAmount"
                          defaultValue={line.discountAmount}
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                          htmlFor={`notes-${line.id}`}
                        >
                          Notes
                        </label>
                        <input
                          id={`notes-${line.id}`}
                          name="notes"
                          defaultValue={line.notes ?? ''}
                          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-4 flex justify-end gap-2">
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          Update line
                        </button>
                      </div>
                    </form>
                    <form
                      method="post"
                      action={`/admin/invoicing/drafts/${invoice.id}/lines/${line.id}`}
                      className="flex justify-end"
                    >
                      <input type="hidden" name="csrf" value={cookieCsrf} />
                      <input type="hidden" name="_action" value="delete" />
                      <button
                        type="submit"
                        className="inline-flex items-center rounded-full border border-rose-200 px-4 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Rounding adjustment</h2>
        {isDraft ? (
          <form
            className="mt-3 grid gap-3 md:grid-cols-2"
            method="post"
            action={`/admin/invoicing/drafts/${invoice.id}/rounding`}
          >
            <input type="hidden" name="csrf" value={cookieCsrf} />
            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                htmlFor="mode"
              >
                Mode
              </label>
              <select
                id="mode"
                name="mode"
                defaultValue="manual"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="manual">Manual amount</option>
                <option value="nearest">Round to nearest</option>
              </select>
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                htmlFor="roundingDelta"
              >
                Manual adjustment ({invoice.currency})
              </label>
              <input
                id="roundingDelta"
                name="roundingDelta"
                type="number"
                step="0.01"
                defaultValue={invoice.roundingDelta ?? '0'}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                htmlFor="roundTo"
              >
                Nearest increment ({invoice.currency})
              </label>
              <input
                id="roundTo"
                name="roundTo"
                type="number"
                step="0.01"
                defaultValue="1"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label
                className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                htmlFor="reason"
              >
                Reason (optional)
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={2}
                defaultValue={invoice.roundingReason ?? ''}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Save rounding
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>Mode: {roundingMode}</p>
            <p>Adjustment: {formatMoney(invoice.roundingDelta, invoice.currency)}</p>
            {invoice.roundingReason ? (
              <p className="text-xs text-slate-500">Reason: {invoice.roundingReason}</p>
            ) : null}
            <p className="text-xs text-slate-500">Rounding is locked for finalized invoices.</p>
          </div>
        )}
      </section>

      <InvoicePaymentsPanel
        invoiceId={invoice.id}
        csrf={cookieCsrf}
        currency={invoice.currency}
        status={invoice.status}
        balanceDue={invoice.balanceDue}
        payments={payments}
        paymentMethods={paymentMethods}
      />
    </main>
  );
}

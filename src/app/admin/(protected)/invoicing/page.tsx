import { cookies } from 'next/headers';
import Link from 'next/link';

import { searchPatients } from '@/lib/invoicing/invoices';
import { getTenantClient } from '@/lib/tenant';
import { cn } from '@/ui/utils';

export const dynamic = 'force-dynamic';

function bannerClasses(kind: 'success' | 'error'): string {
  return cn(
    'rounded-lg border px-4 py-3 text-sm shadow-sm',
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-rose-200 bg-rose-50 text-rose-800',
  );
}

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <p className="text-slate-600">Tenant not found.</p>
      </div>
    );
  }

  const store = await cookies();
  const csrf = store.get('ADMIN_CSRF')?.value || '';

  const sp = (await props.searchParams) || {};
  const q = (sp.q ?? '').trim();
  const created = (sp.created ?? '').trim();
  const err = (sp.err ?? '').trim();

  const [patients, drafts] = await Promise.all([
    searchPatients(tenant.prisma, {
      query: q,
      limit: 25,
    }),
    tenant.prisma.invoice.findMany({
      where: { status: 'DRAFT' },
      orderBy: [{ updatedAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        total: true,
        currency: true,
        patient: {
          select: { firstName: true, lastName: true },
        },
      },
    }),
  ]);

  const errMessages: Record<string, string> = {
    payload: 'The submitted form was invalid. Try again.',
    csrf: 'Your session expired. Refresh the page and try again.',
    validation: 'Please select a patient before creating an invoice.',
    patient: 'Selected patient could not be found.',
    conflict: 'An invoice draft for this patient could not be created right now.',
    server: 'Something went wrong while creating the invoice draft. Please try again.',
  };

  const successMessage = created ? `Invoice draft ${created} created successfully.` : '';

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Start a draft invoice</h2>
        <p className="mt-1 text-slate-600">
          Search for a patient to begin a draft invoice. Pricing is pre-filled using the
          patient&apos;s assigned price list or the practice default.
        </p>

        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center" role="search">
          <div className="flex w-full flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-300/60">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search patients by name, email, or phone"
              aria-label="Search patients"
              className="flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {successMessage && <div className={bannerClasses('success')}>{successMessage}</div>}
        {err && errMessages[err] && (
          <div className={bannerClasses('error')}>{errMessages[err]}</div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-white">
            <tr>
              <th className="px-4 py-3 text-left">Patient</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Price list</th>
              <th className="px-4 py-3 text-left">Last update</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  {q ? 'No patients matched your search.' : 'No patients found yet.'}
                </td>
              </tr>
            ) : (
              patients.map((patient) => (
                <tr key={patient.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{patient.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex flex-col text-xs sm:text-sm">
                      {patient.email && <span>{patient.email}</span>}
                      {patient.phone && <span>{patient.phone}</span>}
                      {!patient.email && !patient.phone && (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col text-xs sm:text-sm">
                      <span>{patient.priceListName ?? 'No price list'}</span>
                      <span className="text-xs text-slate-400">
                        {patient.priceListSource === 'patient'
                          ? 'Assigned to patient'
                          : patient.priceListSource === 'default'
                            ? 'Using default'
                            : 'Pricing requires manual selection'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(patient.updatedAt))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/invoicing/patients/${patient.id}/pricing`}
                        className="inline-flex items-center rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        Manage pricing
                      </Link>
                      <form method="post" action="/admin/invoicing/drafts" className="flex">
                        <input type="hidden" name="csrf" value={csrf} />
                        <input type="hidden" name="patientId" value={patient.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          Create draft
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Recent drafts</h2>
        {drafts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No draft invoices yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-col gap-1 rounded border border-slate-200 px-3 py-2 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {draft.patient.firstName} {draft.patient.lastName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Updated{' '}
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(draft.updatedAt))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: draft.currency,
                      minimumFractionDigits: 2,
                    }).format(Number(draft.total.toString()))}
                  </span>
                  <Link
                    className="inline-flex items-center rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    href={`/admin/invoicing/drafts/${draft.id}`}
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

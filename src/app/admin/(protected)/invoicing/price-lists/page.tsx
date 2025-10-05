import { cookies } from 'next/headers';
import Link from 'next/link';

import { listPriceLists } from '@/lib/invoicing/priceLists';
import { getTenantClient } from '@/lib/tenant';

import NewPriceListDialog from '../components/NewPriceListDialog';

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export default async function PriceListsPage() {
  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <p className="text-slate-600">Tenant not found.</p>
      </div>
    );
  }

  const cookieStore = await cookies();
  const csrf = cookieStore.get('ADMIN_CSRF')?.value || '';
  const lists = await listPriceLists(tenant.prisma);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Price lists</h2>
          <p className="text-sm text-slate-600">
            Configure price lists and assign them to patients. These values seed invoice line
            pricing.
          </p>
        </div>
        <NewPriceListDialog csrf={csrf} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-white">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-center">Default</th>
              <th className="px-4 py-3 text-center">Active</th>
              <th className="px-4 py-3 text-right">Entries</th>
              <th className="px-4 py-3 text-right">Patients</th>
              <th className="px-4 py-3 text-right">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lists.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No price lists yet. Create your first list to start configuring pricing.
                </td>
              </tr>
            ) : (
              lists.map((list) => (
                <tr key={list.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{list.name}</div>
                    {list.description ? (
                      <div className="text-xs text-slate-500">{list.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={
                        list.isDefault
                          ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700'
                          : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500'
                      }
                    >
                      {list.isDefault ? 'Default' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={
                        list.active
                          ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700'
                          : 'rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700'
                      }
                    >
                      {list.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formatCount(list.entriesCount)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formatCount(list.patientCount)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(list.updatedAt))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      className="inline-flex items-center rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      href={`/admin/invoicing/price-lists/${list.id}`}
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

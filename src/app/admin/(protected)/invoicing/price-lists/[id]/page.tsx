import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { getPriceList } from '@/lib/invoicing/priceLists';
import { getTenantClient } from '@/lib/tenant';

import PriceListEntriesPanel from '../../components/PriceListEntriesPanel';
import PriceListSettingsForm from '../../components/PriceListSettingsForm';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default async function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Tenant not found.
      </div>
    );
  }

  const { id } = await params;
  let priceList: Awaited<ReturnType<typeof getPriceList>>;
  try {
    priceList = await getPriceList(tenant.prisma, id, { includeEntries: true });
  } catch {
    notFound();
  }

  if (!('entries' in priceList)) {
    notFound();
  }

  const cookieStore = await cookies();
  const csrf = cookieStore.get('ADMIN_CSRF')?.value || '';

  const treatments = await tenant.prisma.treatmentCode.findMany({
    where: { active: true },
    orderBy: [{ code: 'asc' }],
    select: { id: true, code: true, description: true },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-slate-900">Price list details</h2>
          <PriceListSettingsForm csrf={csrf} list={priceList} />
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold uppercase text-slate-500">Entries</span>
            <span className="text-sm font-semibold text-slate-900">{priceList.entriesCount}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold uppercase text-slate-500">Patients</span>
            <span className="text-sm font-semibold text-slate-900">{priceList.patientCount}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold uppercase text-slate-500">Updated</span>
            <span className="text-sm font-semibold text-slate-900">
              {formatDate(priceList.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      <PriceListEntriesPanel
        csrf={csrf}
        priceListId={priceList.id}
        entries={priceList.entries}
        treatments={treatments}
      />
    </div>
  );
}

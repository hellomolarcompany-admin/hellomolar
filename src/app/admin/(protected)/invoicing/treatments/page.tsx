import { cookies } from 'next/headers';

import { listTreatmentCodes } from '@/lib/invoicing/treatments';
import { getTenantClient } from '@/lib/tenant';

import TreatmentManager from '../components/TreatmentManager';

export const dynamic = 'force-dynamic';

export default async function TreatmentsPage() {
  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Tenant not found.
      </div>
    );
  }

  const cookieStore = await cookies();
  const csrf = cookieStore.get('ADMIN_CSRF')?.value || '';
  const treatments = await listTreatmentCodes(tenant.prisma, {});

  return <TreatmentManager csrf={csrf} treatments={treatments} />;
}

import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { getPatientPriceList, listPatientOverrides } from '@/lib/invoicing/priceLists';
import { listTreatmentCodes } from '@/lib/invoicing/treatments';
import { getTenantClient } from '@/lib/tenant';

import PatientPricingManager from '../../../components/PatientPricingManager';

interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

export default async function PatientPricingPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Tenant not found.
      </div>
    );
  }

  const { patientId } = await params;
  const patientRecord = await tenant.prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });
  if (!patientRecord) {
    notFound();
  }

  const cookieStore = await cookies();
  const csrf = cookieStore.get('ADMIN_CSRF')?.value || '';
  const [assignment, overrides, priceLists, treatments] = await Promise.all([
    getPatientPriceList(tenant.prisma, patientId),
    listPatientOverrides(tenant.prisma, patientId),
    tenant.prisma.priceList.findMany({
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, isDefault: true, active: true },
    }),
    listTreatmentCodes(tenant.prisma, {}),
  ]);

  const patient: PatientSummary = patientRecord;

  return (
    <PatientPricingManager
      csrf={csrf}
      patient={patient}
      assignment={assignment}
      priceLists={priceLists}
      overrides={overrides}
      treatments={treatments}
    />
  );
}

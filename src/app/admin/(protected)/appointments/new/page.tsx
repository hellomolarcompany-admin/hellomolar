import { notFound } from 'next/navigation';

import { locales } from '@/i18n/config';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

import NewAppointmentForm from '../components/NewAppointmentForm';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!modules.apprequest) {
    notFound();
  }

  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <p className="text-sm">Tenant not found.</p>
      </main>
    );
  }
  const prisma = tenant.prisma;

  const [staffMembers, patients] = await Promise.all([
    prisma.staffMember.findMany({
      where: { active: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, role: true },
    }),
    prisma.patient.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        preferredLocale: true,
      },
    }),
  ]);

  const staff = staffMembers.map((member) => ({
    id: member.id,
    name: `${member.firstName} ${member.lastName}`.trim(),
    role: member.role.replace(/_/g, ' ').toLowerCase(),
  }));
  const localeLabels: Record<string, string> = {
    en: 'English',
    nl: 'Nederlands',
    es: 'Español',
    pap: 'Papiamentu',
  };
  const localeOptions = locales.map((code) => ({
    value: code,
    label: localeLabels[code] || code.toUpperCase(),
  }));
  const patientOptions = patients.map((patient) => ({
    id: patient.id,
    name: `${patient.firstName} ${patient.lastName}`.trim(),
    contact: patient.phone || patient.email,
    preferredLocale: patient.preferredLocale || null,
  }));

  return (
    <main className="mx-auto max-w-4xl p-4">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold">Log appointment request</h1>
        <p className="text-sm text-gray-600">
          Capture patient details, preferred providers, and urgency indicators so the front desk
          team can follow up.
        </p>
      </div>

      <NewAppointmentForm staff={staff} patients={patientOptions} locales={localeOptions} />
    </main>
  );
}

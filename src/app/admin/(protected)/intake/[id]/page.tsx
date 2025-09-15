import Link from 'next/link';

import CsrfField from '@/components/CsrfField';
import { getTenantClient } from '@/lib/tenant';

import DeleteConfirm from './DeleteConfirm';

export const dynamic = 'force-dynamic';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <p className="text-sm">Tenant not found.</p>
      </main>
    );
  }
  const rec = await tenant.prisma.intakeSubmission.findUnique({ where: { id } });
  if (!rec) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <p className="text-sm">Not found.</p>
        <Link className="mt-4 inline-block underline" href="/admin/intake">
          Back to list
        </Link>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Registration Details</h1>
        <Link className="text-sm underline" href="/admin/intake">
          Back to list
        </Link>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">ID:</span> {rec.id}
        </div>
        <div>
          <span className="font-medium">Created:</span> {rec.createdAt.toISOString()}
        </div>
        <div>
          <span className="font-medium">Name:</span> {rec.fullName}
        </div>
        <div>
          <span className="font-medium">DOB:</span> {rec.dob.toISOString().slice(0, 10)}
        </div>
        <div>
          <span className="font-medium">Resident Type:</span> {rec.residentType}
        </div>
        <div>
          <span className="font-medium">Address:</span> {rec.address ?? '—'}
        </div>
        <div>
          <span className="font-medium">Country:</span> {rec.country ?? '—'}
        </div>
        <div>
          <span className="font-medium">Email:</span> {rec.email ?? '—'}
        </div>
        <div>
          <span className="font-medium">Phone:</span> {rec.phone ?? '—'}
        </div>
        <div>
          <span className="font-medium">Complications:</span> {rec.hadComplications ? 'Yes' : 'No'}
        </div>
        <div>
          <span className="font-medium">Privacy Accepted:</span>{' '}
          {rec.privacyAccepted ? 'Yes' : 'No'}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <form method="POST" action={`/admin/intake/${rec.id}/decrypt`} target="_blank">
          <CsrfField />
          <button className="rounded border px-3 py-1" type="submit">
            View original payload
          </button>
        </form>
        {rec.patientId ? (
          <button
            type="button"
            className="cursor-not-allowed rounded border px-3 py-1 text-gray-400"
            disabled
            title="Patient already linked"
          >
            Patient exists
          </button>
        ) : (
          <form method="POST" action={`/admin/intake/${rec.id}/link-patient`}>
            <CsrfField />
            <button className="rounded border px-3 py-1" type="submit">
              Create/Link patient
            </button>
          </form>
        )}
        <DeleteConfirm id={rec.id} />
      </div>
    </main>
  );
}

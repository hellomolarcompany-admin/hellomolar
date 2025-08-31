import Link from 'next/link';

import { setCsrfToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const rec = await prisma.intakeSubmission.findUnique({ where: { id } });
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
  const csrf = setCsrfToken();
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
          <input type="hidden" name="csrf" value={csrf} />
          <button className="rounded border px-3 py-1" type="submit">
            View original payload
          </button>
        </form>
        <form method="POST" action={`/admin/intake/${rec.id}/delete`}>
          <input type="hidden" name="csrf" value={csrf} />
          <button className="rounded border border-red-400 px-3 py-1 text-red-700" type="submit">
            Delete
          </button>
        </form>
      </div>
    </main>
  );
}

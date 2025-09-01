import Link from 'next/link';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const name = email.slice(0, at);
  const domain = email.slice(at);
  const shown = name.slice(0, 1);
  return `${shown}${name.length > 1 ? '***' : ''}${domain}`;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\s+/g, '');
  if (clean.length <= 4) return phone;
  const tail = clean.slice(-4);
  return `***${tail}`;
}

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export default async function Page(props: {
  searchParams?: Promise<{ page?: string; q?: string }>;
}) {
  const take = 20;
  const sp = (await props.searchParams) || {};
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const skip = (page - 1) * take;
  const q = (sp.q ?? '').trim();

  // Basic query with optional search on name/email/phone
  const where = q
    ? {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.intakeSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        createdAt: true,
        fullName: true,
        dob: true,
        residentType: true,
        country: true,
        email: true,
        phone: true,
        hadComplications: true,
        privacyAccepted: true,
      },
    }),
    prisma.intakeSubmission.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Intake Registrations</h1>
        <Link className="text-sm underline" href="/">
          Home
        </Link>
      </div>

      <form className="mb-4 flex items-center gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name, email or phone"
          className="w-full max-w-md rounded-md border p-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-black px-3 py-2 text-sm text-white">
          Search
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="border px-3 py-2">Date</th>
              <th className="border px-3 py-2">Name</th>
              <th className="border px-3 py-2">Age</th>
              <th className="border px-3 py-2">Type</th>
              <th className="border px-3 py-2">Country</th>
              <th className="border px-3 py-2">Email</th>
              <th className="border px-3 py-2">Phone</th>
              <th className="border px-3 py-2">Complications</th>
              <th className="border px-3 py-2">Privacy OK</th>
              <th className="border px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                <td className="border px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="border px-3 py-2">{r.fullName}</td>
                <td className="border px-3 py-2">{ageFromDob(r.dob) ?? '—'}</td>
                <td className="border px-3 py-2">{r.residentType}</td>
                <td className="border px-3 py-2">{r.country ?? '—'}</td>
                <td className="border px-3 py-2">{maskEmail(r.email) ?? '—'}</td>
                <td className="border px-3 py-2">{maskPhone(r.phone) ?? '—'}</td>
                <td className="border px-3 py-2">{r.hadComplications ? 'Yes' : 'No'}</td>
                <td className="border px-3 py-2">{r.privacyAccepted ? 'Yes' : 'No'}</td>
                <td className="border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Link className="text-blue-600 underline" href={`/admin/intake/${r.id}`}>
                      View
                    </Link>
                    <button
                      type="button"
                      className="cursor-not-allowed text-gray-400"
                      title="Delete (coming soon)"
                      disabled
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span>
          Page {page} of {totalPages} • {total} total
        </span>
        <div className="flex items-center gap-2">
          <Link
            className={`rounded border px-3 py-1 ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
            href={{ pathname: '/admin/intake', query: { q, page: String(page - 1) } }}
          >
            Prev
          </Link>
          <Link
            className={`rounded border px-3 py-1 ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
            href={{ pathname: '/admin/intake', query: { q, page: String(page + 1) } }}
          >
            Next
          </Link>
        </div>
      </div>
    </main>
  );
}

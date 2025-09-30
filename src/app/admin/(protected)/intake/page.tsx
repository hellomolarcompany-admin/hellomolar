import Link from 'next/link';

import { getTenantClient } from '@/lib/tenant';
import { cn } from '@/ui/utils';

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

function formatResidentType(value: string | null): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function badgeClasses(variant: 'neutral' | 'positive' | 'warning'): string {
  const base =
    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset';
  switch (variant) {
    case 'positive':
      return cn(base, 'bg-emerald-50 text-emerald-700 ring-emerald-100');
    case 'warning':
      return cn(base, 'bg-amber-50 text-amber-700 ring-amber-100');
    default:
      return cn(base, 'bg-slate-100 text-slate-700 ring-slate-200');
  }
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

  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-6xl p-4">
        <p className="text-sm">Tenant not found.</p>
      </main>
    );
  }
  const prisma = tenant.prisma;

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
        isSpam: true,
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

      <form className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex w-full flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 shadow-sm backdrop-blur focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-400/40">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search name, email or phone"
            aria-label="Search intake submissions"
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-center">Age</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Country</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Complications</th>
                <th className="px-4 py-3 text-left">Privacy OK</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows
                .filter((r) => !r.isSpam)
                .map((r) => (
                  <tr key={r.id} className="bg-white transition hover:bg-slate-50/80">
                    <td className="px-4 py-3 align-top text-slate-600">
                      <div className="font-medium text-slate-800">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(r.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-800">
                      <div className="text-base font-semibold">{r.fullName}</div>
                      <div className="text-xs text-slate-500">{maskEmail(r.email) ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">
                      {ageFromDob(r.dob) ?? '—'}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <span className={badgeClasses('neutral')}>
                        {formatResidentType(r.residentType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{r.country ?? '—'}</td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <span className="font-medium">{maskEmail(r.email) ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {maskPhone(r.phone) ?? '—'}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={badgeClasses(r.hadComplications ? 'warning' : 'positive')}>
                        {r.hadComplications ? 'Needs review' : 'No issues'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={badgeClasses(r.privacyAccepted ? 'positive' : 'warning')}>
                        {r.privacyAccepted ? 'Accepted' : 'Missing'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                          href={`/admin/intake/${r.id}`}
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          className="inline-flex cursor-not-allowed items-center rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold text-slate-400"
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

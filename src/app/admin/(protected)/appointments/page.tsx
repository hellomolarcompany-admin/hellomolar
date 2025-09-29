import { AppointmentRequestStatus, Prisma } from '@prisma/client';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { locales } from '@/i18n/config';
import {
  availabilityIncludes,
  dayKeyFromDate,
  parseIsoDate,
  slotIdFromDate,
} from '@/lib/appointments/scheduling';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

import FindAppointmentModal from './components/FindAppointmentModal';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null | undefined): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(value);
  } catch {
    return value.toISOString();
  }
}

function formatReasons(reasons: string[]): string {
  if (!reasons.length) return '—';
  return reasons
    .map((reason) => reason.replace(/_/g, ' ').toLowerCase())
    .map((label) => label.replace(/(^|\s)\w/g, (m) => m.toUpperCase()))
    .join(', ');
}

function statusLabel(status: AppointmentRequestStatus): string {
  switch (status) {
    case 'SCHEDULED':
      return 'Scheduled';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Unscheduled';
  }
}

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  if (!modules.apprequest) {
    notFound();
  }

  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-6xl p-4">
        <p className="text-sm">Tenant not found.</p>
      </main>
    );
  }
  const prisma = tenant.prisma;

  const sp = (await props.searchParams) || {};
  const take = 20;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const skip = (page - 1) * take;
  const q = (sp.q ?? '').trim();
  const statusFilter = (sp.status ?? 'all').toUpperCase();

  const where: Prisma.AppointmentRequestWhereInput = {};
  if (statusFilter && statusFilter !== 'ALL' && statusFilter in AppointmentRequestStatus) {
    where.status = statusFilter as AppointmentRequestStatus;
  } else {
    where.status = 'UNSCHEDULED';
  }
  if (q) {
    const like = { contains: q, mode: 'insensitive' as const };
    where.OR = [
      { patient: { firstName: like } },
      { patient: { lastName: like } },
      { patient: { email: like } },
      { patient: { phone: like } },
      { notes: like },
    ];
  }

  const [rows, total, unscheduledCount, scheduledCount, cancelledCount, staffMembers] =
    await Promise.all([
      prisma.appointmentRequest.findMany({
        where,
        orderBy: [{ isEmergency: 'desc' }, { effectivePriority: 'desc' }, { createdAt: 'asc' }],
        skip,
        take,
        include: {
          patient: true,
        },
      }),
    prisma.appointmentRequest.count({ where }),
    prisma.appointmentRequest.count({ where: { status: 'UNSCHEDULED' } }),
      prisma.appointmentRequest.count({ where: { status: 'SCHEDULED' } }),
      prisma.appointmentRequest.count({ where: { status: 'CANCELLED' } }),
      prisma.staffMember.findMany({
        where: { active: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, role: true },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / take));
  const preview = sp.preview ? parseIsoDate(sp.preview) : null;
  const now = preview ?? new Date();
  const dayKey = dayKeyFromDate(now);
  const slotId = slotIdFromDate(now);
  const baseLocaleLabels: Record<string, string> = {
    en: 'English',
    nl: 'Nederlands',
    es: 'Español',
    pap: 'Papiamentu',
  };
  const localeLabels: Record<string, string> = {};
  for (const code of locales) {
    localeLabels[code] = baseLocaleLabels[code] || code.toUpperCase();
  }

  const sortedRows = [...rows].sort((a, b) => {
    const aMatch = availabilityIncludes(a.availabilityMatrix, dayKey, slotId);
    const bMatch = availabilityIncludes(b.availabilityMatrix, dayKey, slotId);
    if (aMatch !== bMatch) return aMatch ? -1 : 1;
    if (a.effectivePriority !== b.effectivePriority) {
      return b.effectivePriority - a.effectivePriority;
    }
    if (a.isEmergency !== b.isEmergency) return a.isEmergency ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Appointment requests</h1>
          <p className="text-sm text-gray-600">
            Track patient requests, priorities, and follow-up tasks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FindAppointmentModal
            staff={staffMembers.map((member) => ({
              id: member.id,
              name: `${member.firstName} ${member.lastName}`.trim(),
              role: member.role.toLowerCase().replace(/_/g, ' '),
            }))}
          />
          <Link
            className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm font-medium text-white"
            href="/admin/appointments/new"
          >
            Log appointment request
          </Link>
        </div>
      </div>

      <section className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded bg-gray-100 px-3 py-1">Unscheduled: {unscheduledCount}</span>
        <span className="rounded bg-gray-100 px-3 py-1">Scheduled: {scheduledCount}</span>
        <span className="rounded bg-gray-100 px-3 py-1">Cancelled: {cancelledCount}</span>
      </section>

      <form
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        action="/admin/appointments"
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Patient name, email, phone, or notes"
            className="w-full rounded border border-gray-300 p-2 text-sm"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium uppercase tracking-wide"
            htmlFor="status"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusFilter.toLowerCase()}
            className="rounded border border-gray-300 p-2 text-sm"
          >
            <option value="all">All</option>
            <option value="unscheduled">Unscheduled</option>
            <option value="scheduled">Scheduled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Apply
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr className="text-left">
              <th className="border px-3 py-2">Created</th>
              <th className="border px-3 py-2">Patient</th>
              <th className="border px-3 py-2">Reasons</th>
              <th className="border px-3 py-2">Priority</th>
              <th className="border px-3 py-2">Status</th>
              <th className="border px-3 py-2">Last contact</th>
              <th className="border px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                <td className="border px-3 py-2">{formatDate(row.createdAt)}</td>
                <td className="border px-3 py-2">
                  <div className="font-medium text-gray-900">
                    {[row.patient?.firstName, row.patient?.lastName].filter(Boolean).join(' ') ||
                      'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {row.patient?.phone || row.patient?.email || '—'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Language: {localeLabels[row.preferredLocale] || row.preferredLocale}
                  </div>
                </td>
                <td className="border px-3 py-2">{formatReasons(row.reasons)}</td>
                <td className="border px-3 py-2">
                  <div className="font-semibold text-gray-900">{row.effectivePriority}</div>
                  {row.isEmergency && <div className="text-xs text-red-600">Emergency</div>}
                </td>
                <td className="border px-3 py-2">{statusLabel(row.status)}</td>
                <td className="border px-3 py-2">{formatDate(row.lastContactAt)}</td>
                <td className="border px-3 py-2">
                  <Link className="text-blue-600 underline" href={`/admin/appointments/${row.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="border px-3 py-6 text-center text-sm text-gray-500" colSpan={7}>
                  No appointment requests found.
                </td>
              </tr>
            )}
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
            href={{
              pathname: '/admin/appointments',
              query: { q, status: statusFilter.toLowerCase(), page: String(page - 1) },
            }}
          >
            Prev
          </Link>
          <Link
            className={`rounded border px-3 py-1 ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
            href={{
              pathname: '/admin/appointments',
              query: { q, status: statusFilter.toLowerCase(), page: String(page + 1) },
            }}
          >
            Next
          </Link>
        </div>
      </div>
    </main>
  );
}

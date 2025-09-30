import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppointmentRequestStatus, Prisma } from '@prisma/client';

import { locales } from '@/i18n/config';
import {
  availabilityIncludes,
  dayKeyFromDate,
  parseIsoDate,
  slotIdFromDate,
} from '@/lib/appointments/scheduling';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';
import { cn } from '@/ui/utils';

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

function formatReasons(reasons: string[]): string[] {
  return reasons
    .map((reason) => reason.replace(/_/g, ' ').toLowerCase())
    .map((label) => label.replace(/(^|\s)\w/g, (m) => m.toUpperCase()));
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

function badgeClasses(
  variant: 'neutral' | 'positive' | 'warning' | 'danger',
  opts?: { subtle?: boolean },
): string {
  const base =
    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset';
  if (variant === 'positive') return cn(base, 'bg-emerald-50 text-emerald-700 ring-emerald-100');
  if (variant === 'warning') return cn(base, 'bg-amber-50 text-amber-700 ring-amber-100');
  if (variant === 'danger')
    return cn(base, 'bg-rose-50 text-rose-700 ring-rose-100', opts?.subtle && 'bg-rose-100/60');
  return cn(base, 'bg-slate-100 text-slate-700 ring-slate-200');
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
  const statusFilterRaw = (sp.status ?? 'unscheduled').toLowerCase();
  const allowedStatuses = new Set(['all', 'unscheduled', 'scheduled', 'cancelled']);
  const statusFilter = allowedStatuses.has(statusFilterRaw) ? statusFilterRaw : 'unscheduled';

  const where: Prisma.AppointmentRequestWhereInput = {};
  if (statusFilter !== 'all' && statusFilter.toUpperCase() in AppointmentRequestStatus) {
    where.status = statusFilter.toUpperCase() as AppointmentRequestStatus;
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

  const filters = [
    {
      key: 'unscheduled',
      label: 'Unscheduled',
      count: unscheduledCount,
      accent: 'from-amber-400 via-amber-500 to-amber-600',
    },
    {
      key: 'scheduled',
      label: 'Scheduled',
      count: scheduledCount,
      accent: 'from-emerald-400 via-emerald-500 to-emerald-600',
    },
    {
      key: 'cancelled',
      label: 'Cancelled',
      count: cancelledCount,
      accent: 'from-slate-400 via-slate-500 to-slate-600',
    },
    {
      key: 'all',
      label: 'All',
      count: unscheduledCount + scheduledCount + cancelledCount,
      accent: 'from-sky-400 via-sky-500 to-sky-600',
    },
  ] as const;

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

      <section className="mb-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {filters.map((filter) => {
          const active = statusFilter === filter.key;
          const displayCount = active ? total : filter.count;
          return (
            <Link
              key={filter.key}
              href={{
                pathname: '/admin/appointments',
                query: { q, status: filter.key, page: '1' },
              }}
              className={cn(
                'relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                active && 'ring-2 ring-offset-2 ring-slate-900 shadow-lg',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r opacity-0 transition',
                  filter.accent,
                  active && 'opacity-100',
                )}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {filter.label}
                </p>
                <span
                  className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                    active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700',
                  )}
                >
                  {displayCount}
                </span>
              </div>
              <p
                className={cn(
                  'mt-2 text-2xl font-semibold',
                  active ? 'text-slate-900' : 'text-slate-800',
                )}
              >
                {displayCount}
              </p>
              <p className="text-xs text-slate-500">
                Click to view {filter.label.toLowerCase()} requests
              </p>
            </Link>
          );
        })}
      </section>

      <form className="mb-5" action="/admin/appointments">
        <input type="hidden" name="status" value={statusFilter} />
        <div className="flex w-full flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 shadow-sm backdrop-blur focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-400/40">
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Patient name, email, phone, or notes"
            aria-label="Search appointment requests"
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
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Reasons</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last contact</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.map((row) => {
                const reasons = formatReasons(row.reasons);
                const statusVariant =
                  row.status === 'SCHEDULED'
                    ? 'positive'
                    : row.status === 'CANCELLED'
                      ? 'neutral'
                      : 'warning';
                return (
                  <tr key={row.id} className="bg-white transition hover:bg-slate-50/80">
                    <td className="px-4 py-3 align-top text-slate-600">
                      <div className="font-medium text-slate-800">{formatDate(row.createdAt)}</div>
                      {row.isEmergency && (
                        <div className="mt-2">
                          <span className={badgeClasses('danger')}>Emergency</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-800">
                      <div className="text-base font-semibold">
                        {[row.patient?.firstName, row.patient?.lastName]
                          .filter(Boolean)
                          .join(' ') || 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.patient?.phone || row.patient?.email || '—'}
                      </div>
                      <div className="text-xs text-slate-500">
                        Language: {localeLabels[row.preferredLocale] || row.preferredLocale || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {reasons.length ? (
                        <div className="flex flex-wrap gap-2">
                          {reasons.map((reason) => (
                            <span
                              key={reason}
                              className={badgeClasses('neutral', { subtle: true })}
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <span className={badgeClasses(row.isEmergency ? 'danger' : 'neutral')}>
                        Priority {row.effectivePriority}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <span className={badgeClasses(statusVariant)}>{statusLabel(row.status)}</span>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {formatDate(row.lastContactAt)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                        href={`/admin/appointments/${row.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={7}>
                    No appointment requests found.
                  </td>
                </tr>
              )}
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

import {
  AppointmentContactChannel,
  AppointmentFollowUpOutcome,
  AppointmentRequestStatus,
} from '@prisma/client';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import CsrfField from '@/components/CsrfField';
import { locales } from '@/i18n/config';
import {
  CONTACT_CHANNEL_OPTIONS,
  FOLLOW_UP_OUTCOME_OPTIONS,
  TIMESLOT_LABELS,
  WEEKDAY_LABELS,
} from '@/lib/appointments/options';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

function formatDateTime(value: Date | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: opts.dateStyle ?? 'medium',
      timeStyle: opts.timeStyle ?? 'short',
    }).format(value);
  } catch {
    return value.toISOString();
  }
}

function formatReason(reason: string): string {
  return reason
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/(^|\s)\w/g, (m) => m.toUpperCase());
}

function statusBadge(status: AppointmentRequestStatus) {
  switch (status) {
    case 'SCHEDULED':
      return (
        <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
          Scheduled
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
          Cancelled
        </span>
      );
    default:
      return (
        <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          Unscheduled
        </span>
      );
  }
}

function availabilityFromJson(record: unknown): Record<string, string[]> {
  if (!record || typeof record !== 'object') return {};
  const output: Record<string, string[]> = {};
  for (const [day, slots] of Object.entries(record as Record<string, unknown>)) {
    if (Array.isArray(slots)) {
      output[day] = slots.filter((slot): slot is string => typeof slot === 'string');
    }
  }
  return output;
}

type TriageJson = {
  painLevel?: number;
  swelling?: string;
  fever?: boolean;
  bleeding?: string;
  toothInjury?: string;
  redFlags?: {
    troubleSwallowingOrBreathing?: boolean;
    severeFacialTrauma?: boolean;
  };
};

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  if (!modules.apprequest) {
    notFound();
  }

  const { id } = await props.params;
  const sp = (await props.searchParams) || {};
  const prefillLink = sp.prefillLink ? decodeURIComponent(sp.prefillLink) : undefined;
  const prefillMessage = sp.prefillMessage ? decodeURIComponent(sp.prefillMessage) : undefined;
  const tenant = await getTenantClient();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-5xl p-4">
        <p className="text-sm">Tenant not found.</p>
      </main>
    );
  }
  const prisma = tenant.prisma;

  const request = await prisma.appointmentRequest.findUnique({
    where: { id },
    include: {
      patient: true,
      followUps: {
        orderBy: { occurredAt: 'desc' },
        include: { staff: true },
      },
      event: true,
    },
  });

  if (!request) {
    return (
      <main className="mx-auto max-w-5xl p-4">
        <p className="text-sm">Appointment request not found.</p>
        <Link className="mt-4 inline-block underline" href="/admin/appointments">
          Back to list
        </Link>
      </main>
    );
  }

  const staffMembers = await prisma.staffMember.findMany({
    where: { active: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  const preferredProviders = staffMembers.filter((member) =>
    request.preferredProviderIds.includes(member.id),
  );
  const availability = availabilityFromJson(request.availabilityMatrix);
  const triage: TriageJson | null =
    request.isEmergency && request.triageInputs && typeof request.triageInputs === 'object'
      ? (request.triageInputs as TriageJson)
      : null;
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

  return (
    <main className="mx-auto max-w-5xl p-4 space-y-8">
      {prefillLink && (
        <section className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <h2 className="mb-2 font-semibold">Share intake link</h2>
          <p className="break-all">{prefillLink}</p>
          {prefillMessage && (
            <div className="mt-3">
              <label className="mb-1 block text-xs uppercase tracking-wide">Template message</label>
              <textarea
                readOnly
                rows={4}
                className="w-full rounded border border-blue-200 bg-white p-2 text-sm"
                value={prefillMessage}
              />
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Appointment request</h1>
          <p className="text-sm text-gray-600">
            Created {formatDateTime(request.createdAt)} • ID {request.id}
          </p>
        </div>
        <Link className="text-sm underline" href="/admin/appointments">
          Back to list
        </Link>
      </div>

      <section className="grid gap-4 rounded border border-gray-200 p-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Patient
          </h2>
          <div className="space-y-1 text-sm">
            <div className="font-medium text-gray-900">
              {[request.patient.firstName, request.patient.lastName].filter(Boolean).join(' ') ||
                'Unknown'}
            </div>
            <div>{request.patient.phone || '—'}</div>
            <div>{request.patient.email || '—'}</div>
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Status
          </h2>
          <div className="flex items-center gap-3 text-sm">
            {statusBadge(request.status)}
            <span className="text-gray-600">Priority: {request.effectivePriority}</span>
            {request.isEmergency && (
              <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                Emergency
              </span>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Base priority {request.isEmergency ? Math.max(2, request.basePriority) : request.basePriority} − penalties{' '}
            {request.declinePenalty} + triage {request.triageScore}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded border border-gray-200 p-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Details
          </h2>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Reasons</dt>
              <dd>{request.reasons.map(formatReason).join(', ')}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Planned duration</dt>
              <dd>{request.plannedDurationMinutes} minutes</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Preferred language</dt>
              <dd>{localeLabels[request.preferredLocale] || request.preferredLocale}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Preferred providers</dt>
              <dd>
                {preferredProviders.length ? (
                  <ul className="list-disc pl-4">
                    {preferredProviders.map((member) => (
                      <li key={member.id}>
                        {member.firstName} {member.lastName} •{' '}
                        {member.role.toLowerCase().replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span>—</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Availability
          </h2>
          <div className="overflow-x-auto text-sm">
            <table className="min-w-full border text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-1 text-left">Day</th>
                  {Object.entries(TIMESLOT_LABELS).map(([slotId, label]) => (
                    <th key={slotId} className="border px-2 py-1 text-center">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(WEEKDAY_LABELS).map(([dayId, dayLabel]) => (
                  <tr key={dayId}>
                    <td className="border px-2 py-1 font-medium">{dayLabel}</td>
                    {Object.keys(TIMESLOT_LABELS).map((slotId) => (
                      <td key={slotId} className="border px-2 py-1 text-center">
                        {availability[dayId]?.includes(slotId) ? '✔︎' : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {request.isEmergency && triage && (
        <section className="rounded border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600">
            Emergency triage
          </h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide">Pain level</dt>
              <dd>{triage.painLevel ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Swelling</dt>
              <dd>{triage.swelling ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Fever</dt>
              <dd>{triage.fever ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Bleeding</dt>
              <dd>{triage.bleeding ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Tooth injury</dt>
              <dd>{triage.toothInjury ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide">Red flags</dt>
              <dd>
                {(triage.redFlags?.troubleSwallowingOrBreathing
                  ? 'Trouble swallowing/breathing; '
                  : '') + (triage.redFlags?.severeFacialTrauma ? 'Severe facial trauma' : '') ||
                  'None'}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="rounded border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Update request
        </h2>
        <form
          method="POST"
          action={`/admin/appointments/${request.id}/update`}
          className="grid gap-4 md:grid-cols-2"
        >
          <CsrfField />
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
              defaultValue={request.status}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            >
              <option value="UNSCHEDULED">Unscheduled</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium uppercase tracking-wide"
              htmlFor="planned_duration"
            >
              Planned duration (minutes)
            </label>
            <input
              id="planned_duration"
              name="planned_duration"
              type="number"
              min={5}
              defaultValue={request.plannedDurationMinutes}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label
              className="mb-1 block text-xs font-medium uppercase tracking-wide"
              htmlFor="preferred_provider_ids"
            >
              Preferred providers
            </label>
            <select
              id="preferred_provider_ids"
              name="preferred_provider_ids"
              multiple
              defaultValue={request.preferredProviderIds}
              className="h-32 w-full rounded border border-gray-300 p-2 text-sm"
            >
              {staffMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName} •{' '}
                  {member.role.toLowerCase().replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium uppercase tracking-wide"
              htmlFor="preferred_locale"
            >
              Preferred language
            </label>
            <select
              id="preferred_locale"
              name="preferred_locale"
              defaultValue={request.preferredLocale}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            >
              {localeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label
              className="mb-1 block text-xs font-medium uppercase tracking-wide"
              htmlFor="notes"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={request.notes ?? ''}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide">
              Availability
            </label>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border px-2 py-1 text-left">Day</th>
                    {Object.entries(TIMESLOT_LABELS).map(([slotId, label]) => (
                      <th key={slotId} className="border px-2 py-1 text-center">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(WEEKDAY_LABELS).map(([dayId, dayLabel]) => (
                    <tr key={dayId}>
                      <td className="border px-2 py-1 font-medium">{dayLabel}</td>
                      {Object.keys(TIMESLOT_LABELS).map((slotId) => (
                        <td key={slotId} className="border px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            name={`availability_${dayId}`}
                            value={slotId}
                            defaultChecked={availability[dayId]?.includes(slotId)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Log follow-up
        </h2>
        <form
          method="POST"
          action={`/admin/appointments/${request.id}/follow-up`}
          className="grid gap-4 md:grid-cols-2"
        >
          <CsrfField />
          <div>
            <label
              className="mb-1 block text-xs font-medium uppercase tracking-wide"
              htmlFor="follow_channel"
            >
              Channel
            </label>
            <select
              id="follow_channel"
              name="channel"
              className="w-full rounded border border-gray-300 p-2 text-sm"
              defaultValue={AppointmentContactChannel.PHONE}
            >
              {CONTACT_CHANNEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium uppercase tracking-wide"
              htmlFor="follow_outcome"
            >
              Outcome
            </label>
            <select
              id="follow_outcome"
              name="outcome"
              className="w-full rounded border border-gray-300 p-2 text-sm"
              defaultValue={AppointmentFollowUpOutcome.WHATSAPP_SENT}
            >
              {FOLLOW_UP_OUTCOME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium uppercase tracking-wide"
              htmlFor="follow_time"
            >
              Contact time
            </label>
            <input
              id="follow_time"
              name="occurred_at"
              type="datetime-local"
              className="w-full rounded border border-gray-300 p-2 text-sm"
              defaultValue={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium uppercase tracking-wide"
              htmlFor="follow_notes"
            >
              Notes
            </label>
            <textarea
              id="follow_notes"
              name="notes"
              rows={3}
              className="w-full rounded border border-gray-300 p-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input id="record_event" name="record_event" type="checkbox" defaultChecked />
            <label htmlFor="record_event">Add to patient timeline</label>
          </div>
          <div className="md:col-span-2 flex items-center justify-end">
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Log follow-up
            </button>
          </div>
        </form>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            History
          </h3>
          <div className="space-y-3 text-sm">
            {request.followUps.length ? (
              request.followUps.map((follow) => (
                <div key={follow.id} className="rounded border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-gray-900">
                      {formatDateTime(follow.occurredAt)}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs uppercase tracking-wide">
                      {follow.channel.toLowerCase().replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                      {follow.outcome.toLowerCase().replace(/_/g, ' ')}
                    </span>
                  </div>
                  {follow.notes && <p className="mt-2 text-sm text-gray-700">{follow.notes}</p>}
                  {follow.staff && (
                    <p className="mt-1 text-xs text-gray-500">
                      Logged by {follow.staff.firstName} {follow.staff.lastName}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No follow-up attempts yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Request intake link
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Generate a 24-hour intake link prefilled with the patient&apos;s details and send it via
          WhatsApp or email.
        </p>
        <form
          method="POST"
          action={`/admin/appointments/${request.id}/prefill-link`}
          className="flex items-center gap-3"
        >
          <CsrfField />
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Generate link
          </button>
          <span className="text-xs text-gray-500">
            The link will be displayed after generation.
          </span>
        </form>
      </section>
    </main>
  );
}

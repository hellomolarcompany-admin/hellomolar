'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Suggestion = {
  id: string;
  patientName: string;
  patientContact?: string | null;
  reasons: string[];
  effectivePriority: number;
  isEmergency: boolean;
  availabilityMatch: boolean;
  preferredMatch: boolean;
  preferredProviders: string[];
  preferredLocale: string;
};

type StaffOption = {
  id: string;
  name: string;
  role: string;
};

function toTitle(label: string): string {
  return label
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/(^|\s)\w/g, (match) => match.toUpperCase());
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = date.getMinutes() >= 30 ? '30' : '00';
  return `${hours}:${minutes}`;
}

interface Props {
  staff: StaffOption[];
}

export default function FindAppointmentModal({ staff }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(() => formatDateInput(new Date()));
  const [time, setTime] = useState<string>(() => defaultTime(new Date()));
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [csrf, setCsrf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Suggestion[]>([]);
  const localeLabels: Record<string, string> = {
    en: 'English',
    nl: 'Nederlands',
    es: 'Español',
    pap: 'Papiamentu',
  };

  useEffect(() => {
    const fromCookie = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith('ADMIN_CSRF='))
      ?.split('=')[1];
    if (fromCookie) {
      setCsrf(fromCookie);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/admin/csrf', { method: 'GET', cache: 'no-store' });
        const data = (await res.json()) as { ok?: boolean; csrf?: string };
        if (data?.ok && data?.csrf) setCsrf(data.csrf);
      } catch {
        // ignore
      }
    })();
  }, []);

  const disableSubmit = useMemo(() => !date || !time || !csrf, [date, time, csrf]);

  const toggleProvider = (id: string) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  };

  const onOpen = () => {
    setOpen(true);
    setError(null);
    setResults([]);
  };

  const onClose = () => {
    setOpen(false);
    setError(null);
    setResults([]);
    setSelectedProviders((prev) => prev);
  };

  const fetchMatches = async () => {
    if (disableSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/admin/appointments/find', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ date, time, csrf, providers: selectedProviders }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as {
        ok: boolean;
        matches?: Suggestion[];
        message?: string;
      };
      if (!data.ok) {
        throw new Error(data.message || 'Unable to fetch suggestions');
      }
      setResults(data.matches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm"
        onClick={onOpen}
      >
        Find appointment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-md bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Find patients for a slot</h2>
                <p className="text-xs text-gray-500">
                  Choose a free slot and get prioritized patients who can make that time.
                </p>
              </div>
              <button className="text-sm text-gray-500" type="button" onClick={onClose}>
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Date
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Time
                </span>
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
                  step={1800}
                />
              </label>
            </div>

            {staff.length > 0 && (
              <div className="mt-4">
                <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Preferred providers (optional)
                </span>
                <div className="grid max-h-40 gap-2 overflow-y-auto rounded border border-gray-200 p-3 text-sm">
                  {staff.map((member) => (
                    <label key={member.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        value={member.id}
                        checked={selectedProviders.includes(member.id)}
                        onChange={() => toggleProvider(member.id)}
                      />
                      <span>
                        <span className="font-medium text-gray-900">{member.name}</span>{' '}
                        <span className="text-xs text-gray-500">({member.role})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-3">
              <button type="button" className="rounded border px-3 py-1 text-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={fetchMatches}
                disabled={disableSubmit || loading}
              >
                {loading ? 'Searching…' : 'Get appointments'}
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            {results.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                  Suggested patients ({results.length})
                </h3>
                <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
                  {results.map((match) => (
                    <li key={match.id} className="rounded border border-gray-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-gray-900">{match.patientName}</div>
                          {match.patientContact && (
                            <div className="text-xs text-gray-500">{match.patientContact}</div>
                          )}
                        </div>
                        <Link
                          href={`/admin/appointments/${match.id}`}
                          className="rounded border border-blue-500 px-2 py-1 text-xs text-blue-600"
                        >
                          View details
                        </Link>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-gray-700">
                          Priority: {match.effectivePriority}
                        </span>
                        {match.isEmergency && (
                          <span className="rounded bg-red-100 px-2 py-1 text-red-600">
                            Emergency
                          </span>
                        )}
                        {match.availabilityMatch ? (
                          <span className="rounded bg-green-100 px-2 py-1 text-green-700">
                            Availability match
                          </span>
                        ) : (
                          <span className="rounded bg-amber-100 px-2 py-1 text-amber-700">
                            Emergency candidate
                          </span>
                        )}
                        {match.preferredMatch && (
                          <span className="rounded bg-blue-100 px-2 py-1 text-blue-700">
                            Preferred provider
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Reasons: {match.reasons.map(toTitle).join(', ')}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Language: {localeLabels[match.preferredLocale] || match.preferredLocale}
                      </div>
                      {match.preferredProviders.length > 0 && (
                        <div className="mt-1 text-xs text-gray-500">
                          Prefers: {match.preferredProviders.join(', ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!loading && !error && results.length === 0 && (
              <p className="mt-4 text-sm text-gray-500">
                No suggestions yet. Select a date & time and click “Get appointments”.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

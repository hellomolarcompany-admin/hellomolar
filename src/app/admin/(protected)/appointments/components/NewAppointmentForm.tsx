'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

import CsrfField from '@/components/CsrfField';
import {
  APPOINTMENT_REASON_OPTIONS,
  TIMESLOT_LABELS,
  WEEKDAY_LABELS,
} from '@/lib/appointments/options';

const DEFAULT_DURATIONS: Record<string, number> = {
  CHECKUP: 15,
  CLEANING: 30,
  FILLING: 30,
  EXTRACTION: 30,
  ROOT_CANAL: 90,
  EMERGENCY: 30,
};

function computeDefaultDuration(reasons: string[]): number {
  if (reasons.includes('EMERGENCY')) return DEFAULT_DURATIONS.EMERGENCY;
  const unique = Array.from(new Set(reasons));
  if (!unique.length) return DEFAULT_DURATIONS.CHECKUP;
  return unique.reduce((total, reason) => total + (DEFAULT_DURATIONS[reason] ?? 0), 0);
}

type StaffOption = {
  id: string;
  name: string;
  role: string;
};

type PatientOption = {
  id: string;
  name: string;
  contact?: string | null;
  preferredLocale?: string | null;
};

type LocaleOption = {
  value: string;
  label: string;
};

type Props = {
  staff: StaffOption[];
  patients: PatientOption[];
  locales: LocaleOption[];
};

export default function NewAppointmentForm({ staff, patients, locales }: Props) {
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedReasons, setSelectedReasons] = useState<string[]>(['CHECKUP']);
  const [durationDirty, setDurationDirty] = useState(false);
  const [preferredLocale, setPreferredLocale] = useState<string>('en');
  const availabilityTableRef = useRef<HTMLTableElement | null>(null);

  const isEmergency = selectedReasons.includes('EMERGENCY');
  const suggestedDuration = useMemo(
    () => computeDefaultDuration(selectedReasons),
    [selectedReasons],
  );
  const [duration, setDuration] = useState<number>(suggestedDuration);

  const patientLocale = (id: string): string => {
    const found = patients.find((p) => p.id === id);
    return found?.preferredLocale || 'en';
  };

  const handleSelectDay = (dayId: string) => {
    const table = availabilityTableRef.current;
    if (!table) return;
    const inputs = table.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][name="availability_${dayId}"]`,
    );
    const shouldCheck = Array.from(inputs).some((input) => !input.checked);
    inputs.forEach((input) => {
      input.checked = shouldCheck;
    });
  };

  const handleSelectTimeslot = (slotId: string) => {
    const table = availabilityTableRef.current;
    if (!table) return;
    const inputs = table.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][value="${slotId}"]`,
    );
    const shouldCheck = Array.from(inputs).some((input) => !input.checked);
    inputs.forEach((input) => {
      input.checked = shouldCheck;
    });
  };

  const handleSelectEntireWeek = () => {
    const table = availabilityTableRef.current;
    if (!table) return;
    const inputs = table.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name^="availability_"]');
    const shouldCheck = Array.from(inputs).some((input) => !input.checked);
    inputs.forEach((input) => {
      input.checked = shouldCheck;
    });
  };

  const handleReasonChange = (value: string, checked: boolean) => {
    setSelectedReasons((prev) => {
      let next: string[];
      if (checked) {
        next = prev.includes(value) ? prev : [...prev, value];
      } else {
        next = prev.filter((reason) => reason !== value);
      }
      if (!next.length) next = ['CHECKUP'];
      if (!durationDirty) setDuration(computeDefaultDuration(next));
      return next;
    });
  };

  return (
    <form method="POST" action="/admin/appointments/new/create" className="space-y-6">
      <CsrfField />

      <fieldset className="rounded border border-gray-200 p-4">
        <legend className="px-2 text-sm font-medium">Patient</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="patient_mode"
              value="new"
              checked={mode === 'new'}
              onChange={() => {
                setMode('new');
                setPreferredLocale('en');
              }}
            />
            New patient
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="patient_mode"
              value="existing"
              checked={mode === 'existing'}
              onChange={() => {
                setMode('existing');
                setPreferredLocale('en');
              }}
            />
            Existing patient
          </label>
        </div>

        {mode === 'existing' ? (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="patient_id">
              Select patient
            </label>
            <select
              id="patient_id"
              name="patient_id"
              className="w-full rounded border border-gray-300 p-2 text-sm"
              required
              onChange={(event) => setPreferredLocale(patientLocale(event.target.value))}
            >
              <option value="">Select…</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                  {patient.contact ? ` • ${patient.contact}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="first_name">
                First name
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                required
                className="w-full rounded border border-gray-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="last_name">
                Last name
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                required
                className="w-full rounded border border-gray-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" className="w-full rounded border border-gray-300 p-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="phone">
                Phone
              </label>
              <input id="phone" name="phone" type="tel" className="w-full rounded border border-gray-300 p-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="dob">
                Date of birth
              </label>
              <input id="dob" name="dob" type="date" className="w-full rounded border border-gray-300 p-2 text-sm" />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4">
        <legend className="px-2 text-sm font-medium">Communication</legend>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="preferred_locale">
            Preferred language
          </label>
          <select
            id="preferred_locale"
            name="preferred_locale"
            className="w-full rounded border border-gray-300 p-2 text-sm"
            value={preferredLocale}
            onChange={(event) => setPreferredLocale(event.target.value)}
          >
            {locales.map((locale) => (
              <option key={locale.value} value={locale.value}>
                {locale.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="rounded border border-gray-200 p-4">
        <legend className="px-2 text-sm font-medium">Appointment details</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-600">Reasons</p>
            <div className="grid gap-2">
              {APPOINTMENT_REASON_OPTIONS.map((reason) => (
                <label key={reason.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="reasons"
                    value={reason.value}
                    checked={selectedReasons.includes(reason.value)}
                    onChange={(event) => handleReasonChange(reason.value, event.target.checked)}
                  />
                  {reason.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="planned_duration">
                Planned duration (minutes)
              </label>
              <input
                id="planned_duration"
                name="planned_duration"
                type="number"
                min={5}
                className="w-full rounded border border-gray-300 p-2 text-sm"
                value={duration}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setDurationDirty(true);
                  setDuration(Number.isFinite(next) ? Math.max(5, next) : suggestedDuration);
                }}
              />
              <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                <span>Suggested: {suggestedDuration} minutes</span>
                <button
                  type="button"
                  className="text-blue-600"
                  onClick={() => {
                    setDurationDirty(false);
                    setDuration(suggestedDuration);
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="preferred_staff">
                Preferred provider(s)
              </label>
              <select
                id="preferred_staff"
                name="preferred_provider_ids"
                multiple
                className="h-32 w-full rounded border border-gray-300 p-2 text-sm"
              >
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} • {member.role}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Hold Ctrl/Cmd to select multiple providers.</p>
            </div>
          </div>
        </div>

       <div className="mt-4 space-y-3">
         <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-gray-500">
           <span>Quick select:</span>
           <button
             type="button"
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              onClick={handleSelectEntireWeek}
            >
              Entire week
            </button>
            {Object.entries(WEEKDAY_LABELS).map(([dayId, dayLabel]) => (
              <button
                key={dayId}
                type="button"
                className="rounded border border-gray-300 px-2 py-1 text-xs"
                onClick={() => handleSelectDay(dayId)}
              >
                {dayLabel}
              </button>
            ))}
            {Object.entries(TIMESLOT_LABELS).map(([slotId, label]) => (
              <button
                key={slotId}
                type="button"
                className="rounded border border-gray-300 px-2 py-1 text-xs"
                onClick={() => handleSelectTimeslot(slotId)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-xs" ref={availabilityTableRef}>
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-2 text-left">Day</th>
                  {Object.entries(TIMESLOT_LABELS).map(([slotId, label]) => (
                    <th key={slotId} className="border px-2 py-2 text-center">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(WEEKDAY_LABELS).map(([dayId, dayLabel]) => (
                  <tr key={dayId}>
                    <td className="border px-2 py-2 font-medium">
                      {dayLabel}
                      <button
                        type="button"
                        className="ml-2 text-xs text-blue-600"
                        onClick={() => handleSelectDay(dayId)}
                      >
                        Select day
                      </button>
                    </td>
                    {Object.keys(TIMESLOT_LABELS).map((slotId) => (
                      <td key={slotId} className="border px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          name={`availability_${dayId}`}
                          value={slotId}
                          className="availability-slot"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isEmergency && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="pain_level">
                Pain level (0-10)
              </label>
              <input
                id="pain_level"
                name="triage_pain_level"
                type="number"
                min={0}
                max={10}
                defaultValue={0}
                className="w-full rounded border border-gray-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="swelling">
                Swelling
              </label>
              <select
                id="swelling"
                name="triage_swelling"
                className="w-full rounded border border-gray-300 p-2 text-sm"
                defaultValue="none"
              >
                <option value="none">None</option>
                <option value="local">Local (gum/cheek)</option>
                <option value="spreading">Spreading (eye, jaw, throat)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input id="fever" name="triage_fever" type="checkbox" />
              <label className="text-sm" htmlFor="fever">
                Fever ≥38°C / 100.4°F
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="bleeding">
                Bleeding
              </label>
              <select
                id="bleeding"
                name="triage_bleeding"
                className="w-full rounded border border-gray-300 p-2 text-sm"
                defaultValue="none"
              >
                <option value="none">No / stops easily</option>
                <option value="persistent">Persistent (&gt;15 minutes)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="tooth_injury">
                Tooth injury
              </label>
              <select
                id="tooth_injury"
                name="triage_tooth_injury"
                className="w-full rounded border border-gray-300 p-2 text-sm"
                defaultValue="none"
              >
                <option value="none">None</option>
                <option value="chip">Small chip (no pain)</option>
                <option value="broken">Broken tooth, painful</option>
                <option value="pulp">Pulp exposed / knocked out</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wide">Red flags</label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="triage_redflag_swallow" /> Trouble swallowing/breathing
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="triage_redflag_trauma" /> Severe facial trauma
              </label>
            </div>
          </div>
        )}
      </fieldset>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide" htmlFor="notes">
          Internal notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className="w-full rounded border border-gray-300 p-2 text-sm"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link className="rounded border px-4 py-2 text-sm" href="/admin/appointments">
          Cancel
        </Link>
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
          Save request
        </button>
      </div>
    </form>
  );
}

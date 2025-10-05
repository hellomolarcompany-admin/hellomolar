'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import type { PatientPriceOverrideDto } from '@/lib/invoicing/priceLists';
import type { TreatmentCodeDto } from '@/lib/invoicing/treatments';

interface Props {
  csrf: string;
  patientId: string;
  overrides: PatientPriceOverrideDto[];
  treatments: TreatmentCodeDto[];
}

export default function PatientOverridesPanel({ csrf, patientId, overrides, treatments }: Props) {
  const router = useRouter();
  const [treatmentId, setTreatmentId] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [priceEur, setPriceEur] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!treatmentId) {
      setError('Select a treatment to override.');
      return;
    }
    if (!priceUsd && !priceEur) {
      setError('Provide at least one price.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/admin/invoicing/patients/${patientId}/overrides`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf,
          treatmentCodeId: treatmentId,
          priceUsd: priceUsd || undefined,
          priceEur: priceEur || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ message: 'Unable to save override.' }));
        setError(payload?.message || 'Unable to save override.');
        return;
      }
      setTreatmentId('');
      setPriceUsd('');
      setPriceEur('');
      setNotes('');
      router.refresh();
    } catch {
      setError('Unexpected error while saving override.');
    } finally {
      setSaving(false);
    }
  }

  async function removeOverride(treatmentCodeId: string) {
    if (!confirm('Remove this override?')) return;
    setRemovingId(treatmentCodeId);
    setError(null);
    try {
      const response = await fetch(
        `/admin/invoicing/patients/${patientId}/overrides/${treatmentCodeId}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csrf }),
        },
      );
      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ message: 'Unable to remove override.' }));
        setError(payload?.message || 'Unable to remove override.');
        return;
      }
      router.refresh();
    } catch {
      setError('Unexpected error while removing override.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Patient overrides</h2>
          <p className="text-sm text-slate-600">
            Override default pricing for this patient. Leave a price blank to keep the default.
          </p>
        </div>
      </div>

      <form
        className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-4"
        onSubmit={handleSubmit}
      >
        <div className="md:col-span-2">
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="override-treatment"
          >
            Treatment
          </label>
          <select
            id="override-treatment"
            value={treatmentId}
            onChange={(event) => setTreatmentId(event.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
          >
            <option value="">Select treatment</option>
            {treatments.map((treatment) => (
              <option key={treatment.id} value={treatment.id}>
                {treatment.code} — {treatment.description}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="override-price-usd"
          >
            Price USD
          </label>
          <input
            id="override-price-usd"
            type="number"
            step="0.01"
            min="0"
            value={priceUsd}
            onChange={(event) => setPriceUsd(event.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="override-price-eur"
          >
            Price EUR
          </label>
          <input
            id="override-price-eur"
            type="number"
            step="0.01"
            min="0"
            value={priceEur}
            onChange={(event) => setPriceEur(event.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
          />
        </div>
        <div className="md:col-span-4">
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="override-notes"
          >
            Notes
          </label>
          <textarea
            id="override-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
          />
        </div>
        {error ? <div className="md:col-span-4 text-xs text-rose-600">{error}</div> : null}
        <div className="md:col-span-4 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save override'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-white">
            <tr>
              <th className="px-4 py-3 text-left">Treatment</th>
              <th className="px-4 py-3 text-right">USD</th>
              <th className="px-4 py-3 text-right">EUR</th>
              <th className="px-4 py-3 text-left">Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {overrides.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No overrides yet.
                </td>
              </tr>
            ) : (
              overrides.map((override) => (
                <tr key={override.treatmentCodeId} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {override.treatmentCode} — {override.treatmentDescription}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {override.priceUsd ? `$${Number(override.priceUsd).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {override.priceEur ? `€${Number(override.priceEur).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{override.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeOverride(override.treatmentCodeId)}
                      className="inline-flex items-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={removingId === override.treatmentCodeId}
                    >
                      {removingId === override.treatmentCodeId ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

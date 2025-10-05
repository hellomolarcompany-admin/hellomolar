'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import PriceListCsvImport from './PriceListCsvImport';

interface EntryDto {
  id: string;
  treatmentCodeId: string;
  treatmentCode: string;
  treatmentDescription: string;
  priceUsd: string | null;
  priceEur: string | null;
  updatedAt: string;
}

interface TreatmentOption {
  id: string;
  code: string;
  description: string;
}

interface Props {
  csrf: string;
  priceListId: string;
  entries: EntryDto[];
  treatments: TreatmentOption[];
}

export default function PriceListEntriesPanel({ csrf, priceListId, entries, treatments }: Props) {
  const router = useRouter();
  const [treatmentCodeId, setTreatmentCodeId] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [priceEur, setPriceEur] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAddEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!treatmentCodeId) {
      setError('Select a treatment code to add.');
      return;
    }
    if (!priceUsd && !priceEur) {
      setError('Provide at least one price (USD or EUR).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/admin/api/invoicing/price-lists/${priceListId}/entries`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf,
          treatmentCodeId,
          priceUsd: priceUsd || undefined,
          priceEur: priceEur || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'Unable to add entry.' }));
        setError(payload?.message || 'Unable to add entry.');
        return;
      }
      setTreatmentCodeId('');
      setPriceUsd('');
      setPriceEur('');
      router.refresh();
    } catch {
      setError('Unexpected error while adding entry.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(entryId: string, treatmentId: string) {
    if (!confirm('Remove this entry from the price list?')) return;
    setRemovingId(entryId);
    setError(null);
    try {
      const response = await fetch(
        `/admin/api/invoicing/price-lists/${priceListId}/entries/${treatmentId}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csrf }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'Unable to remove entry.' }));
        setError(payload?.message || 'Unable to remove entry.');
        return;
      }
      router.refresh();
    } catch {
      setError('Unexpected error while removing entry.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Price list entries</h2>
          <p className="text-sm text-slate-600">
            Add treatment-specific pricing or import from CSV.
          </p>
        </div>
        <PriceListCsvImport
          csrf={csrf}
          priceListId={priceListId}
          onComplete={() => router.refresh()}
        />
      </div>

      <form
        className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-4"
        onSubmit={handleAddEntry}
      >
        <div className="md:col-span-2">
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="entry-treatment"
          >
            Treatment code
          </label>
          <select
            id="entry-treatment"
            value={treatmentCodeId}
            onChange={(event) => setTreatmentCodeId(event.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
          >
            <option value="">Select treatment</option>
            {treatments.map((option) => (
              <option key={option.id} value={option.id}>
                {option.code} — {option.description}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="entry-price-usd"
          >
            Price USD
          </label>
          <input
            id="entry-price-usd"
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
            htmlFor="entry-price-eur"
          >
            Price EUR
          </label>
          <input
            id="entry-price-eur"
            type="number"
            step="0.01"
            min="0"
            value={priceEur}
            onChange={(event) => setPriceEur(event.target.value)}
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
            {saving ? 'Adding…' : 'Add entry'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-white">
            <tr>
              <th className="px-4 py-2 text-left">Treatment</th>
              <th className="px-4 py-2 text-right">USD</th>
              <th className="px-4 py-2 text-right">EUR</th>
              <th className="px-4 py-2 text-right">Updated</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                  No entries yet.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {entry.treatmentCode} — {entry.treatmentDescription}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {entry.priceUsd ? `$${Number(entry.priceUsd).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {entry.priceEur ? `€${Number(entry.priceEur).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(entry.updatedAt))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(entry.id, entry.treatmentCodeId)}
                      className="inline-flex items-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={removingId === entry.id}
                    >
                      {removingId === entry.id ? 'Removing…' : 'Remove'}
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

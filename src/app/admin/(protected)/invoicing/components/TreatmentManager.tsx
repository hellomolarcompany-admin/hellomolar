'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import type { TreatmentCodeDto } from '@/lib/invoicing/treatments';

import TreatmentCsvImport from './TreatmentCsvImport';
import TreatmentDialog from './TreatmentDialog';

interface Props {
  csrf: string;
  treatments: TreatmentCodeDto[];
}

type Filter = 'all' | 'active' | 'inactive';

type DialogState = { mode: 'create' } | { mode: 'edit'; treatment: TreatmentCodeDto } | null;

export default function TreatmentManager({ csrf, treatments }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'active') return treatments.filter((item) => item.active);
    if (filter === 'inactive') return treatments.filter((item) => !item.active);
    return treatments;
  }, [filter, treatments]);

  async function toggleActive(treatment: TreatmentCodeDto) {
    setPendingId(treatment.id);
    setError(null);
    try {
      const response = await fetch(`/admin/api/invoicing/treatments/${treatment.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf, active: !treatment.active }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'Failed to update.' }));
        setError(payload?.message || 'Failed to update treatment.');
        return;
      }
      router.refresh();
    } catch {
      setError('Unexpected error while updating treatment.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Treatment codes</h2>
          <p className="text-sm text-slate-600">
            Maintain the codes and default pricing used across patients and price lists.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TreatmentCsvImport csrf={csrf} onComplete={() => router.refresh()} />
          <button
            type="button"
            onClick={() => setDialog({ mode: 'create' })}
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            New treatment
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(['all', 'active', 'inactive'] as Filter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1 font-semibold transition ${
              filter === value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            {value === 'all' ? 'All' : value === 'active' ? 'Active' : 'Inactive'}
          </button>
        ))}
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-white">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">USD</th>
              <th className="px-4 py-3 text-right">EUR</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  {filter === 'inactive'
                    ? 'No inactive treatments.'
                    : filter === 'active'
                      ? 'No active treatments.'
                      : 'No treatments yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((treatment) => (
                <tr key={treatment.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-semibold text-slate-900">{treatment.code}</td>
                  <td className="px-4 py-3 text-slate-700">{treatment.description}</td>
                  <td className="px-4 py-3 text-slate-500">{treatment.category ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {treatment.priceUsd ? `$${Number(treatment.priceUsd).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {treatment.priceEur ? `€${Number(treatment.priceEur).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={
                        treatment.active
                          ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700'
                          : 'rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700'
                      }
                    >
                      {treatment.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDialog({ mode: 'edit', treatment })}
                        className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(treatment)}
                        className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={pendingId === treatment.id}
                      >
                        {pendingId === treatment.id
                          ? 'Saving…'
                          : treatment.active
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dialog ? (
        <TreatmentDialog
          csrf={csrf}
          mode={dialog.mode}
          treatment={dialog.mode === 'edit' ? dialog.treatment : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

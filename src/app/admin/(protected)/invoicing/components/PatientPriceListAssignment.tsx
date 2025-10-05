'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

interface PriceListOption {
  id: string;
  name: string;
  isDefault: boolean;
  active: boolean;
}

interface Assignment {
  priceListId: string | null;
  priceListName: string | null;
}

interface Props {
  csrf: string;
  patientId: string;
  priceLists: PriceListOption[];
  assignment: Assignment;
}

export default function PatientPriceListAssignment({
  csrf,
  patientId,
  priceLists,
  assignment,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState<string>(assignment.priceListId ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/admin/invoicing/patients/${patientId}/price-list`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf, priceListId: value || null }),
      });
      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ message: 'Failed to update assignment.' }));
        setMessage(payload?.message || 'Failed to update assignment.');
        return;
      }
      router.refresh();
    } catch {
      setMessage('Unexpected error while updating price list assignment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div>
        <label
          className="mb-1 block text-xs font-semibold uppercase text-slate-500"
          htmlFor="patient-price-list"
        >
          Price list
        </label>
        <select
          id="patient-price-list"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
        >
          <option value="">Use practice default</option>
          {priceLists.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.isDefault ? ' (default)' : ''}
              {!option.active ? ' (inactive)' : ''}
            </option>
          ))}
        </select>
      </div>
      {message ? <p className="text-xs text-rose-600">{message}</p> : null}
      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save assignment'}
        </button>
      </div>
    </form>
  );
}

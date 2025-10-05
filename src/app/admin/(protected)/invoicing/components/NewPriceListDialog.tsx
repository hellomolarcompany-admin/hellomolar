'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

interface Props {
  csrf: string;
}

export default function NewPriceListDialog({ csrf }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setIsDefault(false);
    setActive(true);
    setError(null);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/admin/api/invoicing/price-lists', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          isDefault,
          active,
          csrf,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'Request failed.' }));
        setError(payload?.message || 'Unable to create the price list.');
        return;
      }

      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setError('Unexpected error while creating the price list.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        New price list
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="price-list-name"
          >
            Name
          </label>
          <input
            id="price-list-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/50"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="price-list-description"
          >
            Description <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="price-list-description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/50"
          />
        </div>
        <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(event) => setIsDefault(event.target.checked)}
            />
            Make default
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Active
          </label>
        </div>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Create list'}
          </button>
        </div>
      </form>
    </div>
  );
}

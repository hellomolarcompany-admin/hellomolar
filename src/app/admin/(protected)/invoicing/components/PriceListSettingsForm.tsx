'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import type { PriceListDto } from '@/lib/invoicing/priceLists';

interface Props {
  csrf: string;
  list: PriceListDto;
}

export default function PriceListSettingsForm({ csrf, list }: Props) {
  const router = useRouter();
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? '');
  const [isDefault, setIsDefault] = useState(list.isDefault);
  const [active, setActive] = useState(list.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/admin/api/invoicing/price-lists/${list.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf,
          name: name.trim(),
          description: description.trim() || null,
          isDefault,
          active,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'Request failed.' }));
        setError(payload?.message || 'Unable to update price list.');
        return;
      }

      router.refresh();
    } catch {
      setError('Unexpected error while saving changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this price list? This action cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/admin/api/invoicing/price-lists/${list.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'Request failed.' }));
        setError(payload?.message || 'Unable to delete price list.');
        return;
      }

      router.push('/admin/invoicing/price-lists');
      router.refresh();
    } catch {
      setError('Unexpected error while deleting price list.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
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
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="price-list-description"
          >
            Description
          </label>
          <textarea
            id="price-list-description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(event) => setIsDefault(event.target.checked)}
            />
            Default
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
            type="submit"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Danger zone</p>
            <p className="text-xs text-rose-600">
              Deleting a price list is permanent and not allowed if patients or invoices depend on
              it.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center rounded-full border border-rose-300 px-4 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

import type { TreatmentCodeDto } from '@/lib/invoicing/treatments';

interface Props {
  csrf: string;
  mode: 'create' | 'edit';
  treatment?: TreatmentCodeDto;
  onClose(): void;
  onSaved(): void;
}

function getPortal(): HTMLElement {
  if (typeof document === 'undefined')
    return { appendChild() {}, removeChild() {} } as unknown as HTMLElement;
  let node = document.getElementById('modal-root');
  if (!node) {
    node = document.createElement('div');
    node.id = 'modal-root';
    document.body.appendChild(node);
  }
  return node;
}

export default function TreatmentDialog({ csrf, mode, treatment, onClose, onSaved }: Props) {
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState(treatment?.code ?? '');
  const [description, setDescription] = useState(treatment?.description ?? '');
  const [category, setCategory] = useState(treatment?.category ?? '');
  const [priceUsd, setPriceUsd] = useState(treatment?.priceUsd ?? '');
  const [priceEur, setPriceEur] = useState(treatment?.priceEur ?? '');
  const [active, setActive] = useState(treatment?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      csrf,
      code: code.trim().toUpperCase(),
      description: description.trim(),
      category: category.trim() || undefined,
      priceUsd: priceUsd || undefined,
      priceEur: priceEur || undefined,
      active,
    };

    try {
      const endpoint =
        mode === 'create'
          ? '/admin/api/invoicing/treatments'
          : `/admin/api/invoicing/treatments/${treatment?.id}`;
      const response = await fetch(endpoint, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: 'Request failed.' }));
        setError(body?.message || 'Unable to save treatment.');
        return;
      }
      onSaved();
    } catch {
      setError('Unexpected error while saving treatment.');
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  const portal = getPortal();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">
          {mode === 'create' ? 'New treatment code' : `Edit ${treatment?.code}`}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Define the treatment code and default pricing used across price lists and invoices.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                htmlFor="treatment-code"
              >
                Code
              </label>
              <input
                id="treatment-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                htmlFor="treatment-category"
              >
                Category
              </label>
              <input
                id="treatment-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
                placeholder="Optional grouping"
              />
            </div>
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-semibold uppercase text-slate-500"
              htmlFor="treatment-description"
            >
              Description
            </label>
            <textarea
              id="treatment-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              rows={2}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                htmlFor="treatment-price-usd"
              >
                Price USD
              </label>
              <input
                id="treatment-price-usd"
                value={priceUsd}
                onChange={(event) => setPriceUsd(event.target.value)}
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                htmlFor="treatment-price-eur"
              >
                Price EUR
              </label>
              <input
                id="treatment-price-eur"
                value={priceEur}
                onChange={(event) => setPriceEur(event.target.value)}
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300/60"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Active
          </label>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Saving…' : mode === 'create' ? 'Create treatment' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    portal,
  );
}

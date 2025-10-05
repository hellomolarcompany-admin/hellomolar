'use client';

import { useEffect, useMemo, useState } from 'react';

type TreatmentOption = {
  id: string;
  code: string;
  description: string;
};

type ProviderOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

interface Props {
  invoiceId: string;
  csrf: string;
  currency: string;
  treatments: TreatmentOption[];
  providers: ProviderOption[];
}

function providerLabel(provider: ProviderOption): string {
  const first = provider.firstName ?? '';
  const last = provider.lastName ?? '';
  const full = `${first} ${last}`.trim();
  const roleRaw = provider.role.replace(/_/g, ' ').toLowerCase();
  const role = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1);
  return full ? `${full} (${role})` : `Unknown (${role})`;
}

export default function InvoiceLineAddForm({
  invoiceId,
  csrf,
  currency,
  treatments,
  providers,
}: Props) {
  const hasProviders = providers.length > 0;
  const [treatmentId, setTreatmentId] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '');
  const [unitPrice, setUnitPrice] = useState('');

  const treatmentMap = useMemo(
    () => new Map(treatments.map((option) => [option.id, option])),
    [treatments],
  );

  useEffect(() => {
    const selected = treatmentMap.get(treatmentId);
    if (selected) {
      setCode(selected.code);
      setDescription(selected.description);
      // fall back to empty before quote resolves
      setUnitPrice('');
    } else {
      setCode('');
      setDescription('');
      setUnitPrice('');
    }
  }, [treatmentId, treatmentMap]);

  useEffect(() => {
    if (hasProviders) {
      setProviderId((current) => current || providers[0]!.id);
    } else {
      setProviderId('');
    }
  }, [hasProviders, providers]);

  useEffect(() => {
    if (!treatmentId) return;

    const controller = new AbortController();
    async function loadPreview() {
      try {
        const response = await fetch(
          `/admin/invoicing/drafts/${invoiceId}/lines/quote?treatmentCodeId=${encodeURIComponent(treatmentId)}`,
          {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          ok: boolean;
          preview?: { code: string; description: string; unitPrice: string | null };
        };
        if (!payload?.ok || !payload.preview) return;
        setCode(payload.preview.code);
        setDescription(payload.preview.description);
        setUnitPrice(payload.preview.unitPrice ?? '');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    loadPreview();
    return () => controller.abort();
  }, [invoiceId, treatmentId]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Add line</h2>
      <form
        className="mt-3 grid gap-3 md:grid-cols-2"
        method="post"
        action={`/admin/invoicing/drafts/${invoiceId}/lines`}
      >
        <input type="hidden" name="csrf" value={csrf} />
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="treatment"
          >
            Treatment code
          </label>
          <select
            id="treatment"
            name="treatmentCodeId"
            value={treatmentId}
            onChange={(event) => setTreatmentId(event.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Manual line</option>
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
            htmlFor="provider"
          >
            Provider
          </label>
          <select
            id="provider"
            name="providerStaffId"
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
            required
            disabled={!hasProviders}
          >
            <option value="" disabled>
              {hasProviders ? 'Select provider' : 'No providers available'}
            </option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {providerLabel(provider)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="code"
          >
            Code
          </label>
          <input
            id="code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="e.g. MANUAL"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="description"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            placeholder="Describe the treatment or adjustment"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="quantity"
          >
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="0.01"
            defaultValue="1"
            min="0.01"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="unitPrice"
          >
            Unit price ({currency})
          </label>
          <input
            id="unitPrice"
            name="unitPrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="Auto"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="discountAmount"
          >
            Discount ({currency})
          </label>
          <input
            id="discountAmount"
            name="discountAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label
            className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            htmlFor="notes"
          >
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        {!hasProviders ? (
          <div className="md:col-span-2 text-xs text-rose-600">
            No clinical staff members are active. Activate a dentist, hygienist, or dental assistant
            to assign as provider.
          </div>
        ) : null}
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-500"
            disabled={!hasProviders}
          >
            Add line
          </button>
        </div>
      </form>
    </section>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

import { type ParsedPriceListCsv, parsePriceListEntryCsv } from '@/lib/invoicing/priceListCsv';
import { cn } from '@/ui/utils';

interface Props {
  csrf: string;
  priceListId: string;
  onComplete(): void;
}

interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
}

interface ImportError {
  line: number;
  message: string;
}

type PreviewLine = {
  line: number;
  code: string;
  priceUsd: string | null | undefined;
  priceEur: string | null | undefined;
  errors: string[];
};

export default function PriceListCsvImport({ csrf, priceListId, onComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<ParsedPriceListCsv | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [serverSummary, setServerSummary] = useState<ImportSummary | null>(null);
  const [serverErrors, setServerErrors] = useState<ImportError[]>([]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const errorMap = useMemo(() => {
    const map = new Map<number, string[]>();
    preview?.errors.forEach((err) => {
      if (!map.has(err.line)) {
        map.set(err.line, [err.message]);
      } else {
        map.get(err.line)!.push(err.message);
      }
    });
    return map;
  }, [preview]);

  const previewLines: PreviewLine[] = useMemo(() => {
    if (!preview) return [];

    const entryByLine = new Map<number, PreviewLine>();
    preview.entries.forEach((entry) => {
      entryByLine.set(entry.line, {
        line: entry.line,
        code: entry.data.code,
        priceUsd: entry.data.priceUsd,
        priceEur: entry.data.priceEur,
        errors: [],
      });
    });

    const allLines = new Set<number>([
      ...preview.entries.map((entry) => entry.line),
      ...preview.errors.map((err) => err.line),
    ]);

    return Array.from(allLines)
      .sort((a, b) => a - b)
      .map((line) => {
        const existing = entryByLine.get(line);
        const errs = errorMap.get(line) ?? [];
        return (
          existing ?? {
            line,
            code: '',
            priceUsd: undefined,
            priceEur: undefined,
            errors: errs,
          }
        );
      })
      .map((row) => ({
        ...row,
        errors: errorMap.get(row.line) ?? row.errors,
      }));
  }, [preview, errorMap]);

  const validRows = useMemo(() => {
    if (!preview) return [];
    return preview.entries.filter((entry) => !errorMap.has(entry.line));
  }, [preview, errorMap]);

  function resetInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function resetState() {
    setPreview(null);
    setMessage(null);
    setServerSummary(null);
    setServerErrors([]);
    setUploading(false);
    resetInput();
  }

  function closeModal() {
    setIsOpen(false);
    resetState();
  }

  function handleButtonClick() {
    resetInput();
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) {
      resetState();
      return;
    }
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setMessage('Please choose a .csv file.');
      resetState();
      return;
    }

    try {
      const text = await selected.text();
      const parsed = parsePriceListEntryCsv(text);
      setPreview(parsed);
      setMessage(null);
      setServerSummary(null);
      setServerErrors([]);
      setIsOpen(true);
    } catch {
      setMessage('Failed to read the selected file.');
      resetState();
    }
  }

  async function handleImport() {
    if (!preview) {
      setMessage('Choose a CSV file before importing.');
      return;
    }

    if (validRows.length === 0) {
      setMessage('No valid rows to import yet.');
      return;
    }

    setUploading(true);
    setMessage(null);
    setServerSummary(null);
    setServerErrors([]);

    try {
      const formData = new FormData();
      const csvLines = ['code,price_usd,price_eur'];
      validRows.forEach((entry) => {
        const { code, priceUsd, priceEur } = entry.data;
        const values = [code ?? '', priceUsd ?? '', priceEur ?? ''].map((value) => {
          const safe = String(value ?? '').replace(/"/g, '""');
          return `"${safe}"`;
        });
        csvLines.push(values.join(','));
      });

      formData.append('csv', csvLines.join('\n'));
      formData.append('csrf', csrf);

      const response = await fetch(
        `/admin/api/invoicing/price-lists/${priceListId}/entries/import`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        },
      );

      const payload = await response.json().catch(() => ({ ok: false, message: 'Import failed.' }));

      const success = response.ok && payload?.ok;

      if (success) {
        onComplete();
        closeModal();
        return;
      }

      setMessage(payload?.message || 'Import failed.');
      setServerSummary(payload?.summary ?? null);
      setServerErrors(Array.isArray(payload?.errors) ? payload.errors : []);
    } catch {
      setMessage('Unexpected error while uploading CSV.');
    } finally {
      setUploading(false);
    }
  }

  if (!mounted) {
    return (
      <button
        type="button"
        onClick={handleButtonClick}
        className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        Import CSV
      </button>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handleButtonClick}
        className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        Import CSV
      </button>
      {message && !isOpen ? <p className="mt-1 text-[11px] text-rose-600">{message}</p> : null}

      {isOpen && preview
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
              <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Preview price list CSV
                    </h3>
                    <p className="text-sm text-slate-600">
                      Review each row before importing. Rows highlighted in red will be skipped.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-auto p-5">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Line</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Code</th>
                        <th className="px-3 py-2 text-right">Price USD</th>
                        <th className="px-3 py-2 text-right">Price EUR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewLines.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">
                            No rows detected in this file.
                          </td>
                        </tr>
                      ) : (
                        previewLines.map((row) => {
                          const hasError = row.errors.length > 0;
                          const willImport = !hasError && Boolean(row.code);
                          const tooltip = hasError
                            ? row.errors.join('\n') || 'Row will be skipped'
                            : willImport
                              ? 'Ready to import'
                              : 'Row will be skipped';
                          return (
                            <tr
                              key={row.line}
                              className={hasError || !willImport ? 'bg-rose-50/70' : undefined}
                            >
                              <td className="px-3 py-2 text-xs text-slate-500">{row.line}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    'inline-flex h-2.5 w-2.5 items-center justify-center rounded-full',
                                    hasError || !willImport ? 'bg-rose-500' : 'bg-emerald-500',
                                  )}
                                  title={tooltip}
                                  aria-label={tooltip}
                                />
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-slate-800">
                                {row.code || <span className="text-slate-400">(missing)</span>}
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-slate-700">
                                {row.priceUsd ?? <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-slate-700">
                                {row.priceEur ?? <span className="text-slate-400">—</span>}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  <p className="mt-3 text-xs text-slate-600">
                    Valid entries: {validRows.length} of {previewLines.length}. Rows with red
                    indicators will be skipped.
                  </p>
                </div>

                <div className="space-y-2 border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs">
                  {message ? <p className="text-rose-600">{message}</p> : null}
                  {serverSummary ? (
                    <p className="text-slate-600">
                      Attempt result: created {serverSummary.created}, updated{' '}
                      {serverSummary.updated}, skipped {serverSummary.skipped}.
                    </p>
                  ) : null}
                  {serverErrors.length ? (
                    <div className="max-h-28 overflow-auto rounded border border-rose-200 bg-white p-2 text-rose-700">
                      <ul className="space-y-1">
                        {serverErrors.map((err) => (
                          <li key={`${err.line}-${err.message}`}>
                            Line {err.line}: {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex items-center rounded-full border border-slate-300 px-4 py-1.5 font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleImport}
                      disabled={uploading || validRows.length === 0}
                      className="inline-flex items-center rounded-full bg-slate-900 px-4 py-1.5 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploading
                        ? 'Importing…'
                        : validRows.length === 0
                          ? 'No valid rows'
                          : 'Import'}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

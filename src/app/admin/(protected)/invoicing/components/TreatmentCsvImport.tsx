'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

import { type ParsedTreatmentCsv, parseTreatmentCodeCsv } from '@/lib/invoicing/csv';

interface Props {
  csrf: string;
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

export default function TreatmentCsvImport({ csrf, onComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedTreatmentCsv | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const errorMap = useMemo(() => {
    const map = new Map<number, string>();
    errors.forEach((err) => {
      if (!map.has(err.line)) map.set(err.line, err.message);
    });
    return map;
  }, [errors]);

  const entryLines = useMemo(() => {
    return new Set(preview?.entries.map((entry) => entry.line) ?? []);
  }, [preview]);

  const standaloneErrors = useMemo(
    () => errors.filter((err) => !entryLines.has(err.line)),
    [errors, entryLines],
  );

  function resetState() {
    setFile(null);
    setPreview(null);
    setErrors([]);
    setSummary(null);
    setMessage(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function closeModal() {
    setIsOpen(false);
    resetState();
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
      const parsed = parseTreatmentCodeCsv(text);
      setFile(selected);
      setPreview(parsed);
      setErrors(parsed.errors);
      setSummary(null);
      setMessage(null);
      setIsOpen(true);
    } catch {
      setMessage('Failed to read the file.');
      resetState();
    }
  }

  async function handleImport() {
    if (!file) {
      setMessage('Choose a CSV file first.');
      return;
    }
    setUploading(true);
    setMessage(null);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('csrf', csrf);

      const response = await fetch('/admin/api/invoicing/treatments/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const payload = await response.json().catch(() => ({ ok: false, message: 'Upload failed.' }));
      setSummary(payload?.summary ?? null);
      setErrors(payload?.errors ?? []);

      if (!response.ok || !payload.ok) {
        setMessage(payload?.message || 'Unable to import treatments.');
        return;
      }

      setMessage(payload.message || 'Import successful.');
      onComplete();
      closeModal();
    } catch {
      setMessage('Unexpected error while uploading CSV.');
    } finally {
      setUploading(false);
    }
  }

  function handleButtonClick() {
    fileInputRef.current?.click();
  }

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        onClick={handleButtonClick}
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
        className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        onClick={handleButtonClick}
      >
        Import CSV
      </button>
      {isOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
              <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Import treatments from CSV
                    </h3>
                    <p className="text-sm text-slate-600">
                      Preview the rows detected in the selected file before importing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {file ? (
                    <p className="text-xs text-slate-500">Selected file: {file.name}</p>
                  ) : (
                    <p className="text-xs text-slate-500">No file selected.</p>
                  )}
                  {preview ? (
                    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <p>
                        {preview.entries.length} rows ready to import.
                        {errors.length ? ` ${errors.length} issues detected.` : ''}
                      </p>
                      {preview.entries.length ? (
                        <div className="mt-3 max-h-40 overflow-auto rounded border border-slate-200 bg-white">
                          <table className="min-w-full text-xs">
                            <thead className="bg-slate-100 text-left font-semibold">
                              <tr>
                                <th className="w-8 px-3 py-2">&nbsp;</th>
                                <th className="px-3 py-2">Line</th>
                                <th className="px-3 py-2">Code</th>
                                <th className="px-3 py-2">Description</th>
                                <th className="px-3 py-2">USD</th>
                                <th className="px-3 py-2">EUR</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {preview.entries.slice(0, 12).map((entry) => {
                                const lineError = errorMap.get(entry.line);
                                return (
                                  <tr key={`${entry.line}-${entry.data.code}`}>
                                    <td className="px-3 py-1">
                                      <span
                                        className={`inline-block h-2 w-2 rounded-full ${
                                          lineError ? 'bg-rose-500' : 'bg-emerald-500'
                                        }`}
                                      />
                                    </td>
                                    <td className="px-3 py-1">{entry.line}</td>
                                    <td className="px-3 py-1 font-semibold">{entry.data.code}</td>
                                    <td className="px-3 py-1">{entry.data.description}</td>
                                    <td className="px-3 py-1">{entry.data.priceUsd ?? '—'}</td>
                                    <td className="px-3 py-1">{entry.data.priceEur ?? '—'}</td>
                                  </tr>
                                );
                              })}
                              {preview.entries.length > 12 ? (
                                <tr>
                                  <td colSpan={6} className="px-3 py-2 text-center text-slate-500">
                                    …and {preview.entries.length - 12} more lines.
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                      {standaloneErrors.length ? (
                        <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-2 text-rose-700">
                          <p className="font-semibold">Detected issues:</p>
                          <ul className="mt-1 space-y-1">
                            {standaloneErrors.slice(0, 12).map((item) => (
                              <li key={`${item.line}-${item.message}`}>
                                Line {item.line}: {item.message}
                              </li>
                            ))}
                            {standaloneErrors.length > 12 ? (
                              <li>…and {standaloneErrors.length - 12} more issues.</li>
                            ) : null}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      Choose a .csv file to preview the rows that will be imported.
                    </p>
                  )}
                  {message ? <p className="text-xs text-rose-600">{message}</p> : null}
                  {summary ? (
                    <p className="text-xs text-slate-600">
                      Created {summary.created}, updated {summary.updated}, skipped{' '}
                      {summary.skipped}.
                    </p>
                  ) : null}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={uploading || !file}
                  >
                    {uploading ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

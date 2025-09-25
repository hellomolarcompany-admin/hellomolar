'use client';

import { useEffect, useMemo, useRef } from 'react';

import { useTranslations } from 'next-intl';

import Button from '@/ui/Button';

type PrivacyPolicyModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function PrivacyPolicyModal({ open, onClose }: PrivacyPolicyModalProps) {
  const t = useTranslations('intake');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    node?.focus();
  }, [open]);

  const sections = useMemo(
    () =>
      [
        { key: 'intro' },
        { key: 'dataCollection' },
        { key: 'dataUse' },
        { key: 'dataSharing' },
        { key: 'rights' },
      ] as const,
    [],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-md bg-white shadow"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <h2 id="privacy-modal-title" className="text-lg font-semibold">
            {t('privacyModal.title')}
          </h2>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-black/10"
            onClick={onClose}
            aria-label={t('buttons.close')}
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          <ul className="space-y-4 text-sm text-slate-700">
            {sections.map(({ key }) => (
              <li key={key}>
                <h3 className="text-base font-medium text-slate-900">
                  {t(`privacyModal.sections.${key}.title`)}
                </h3>
                <p className="mt-1 leading-relaxed">{t(`privacyModal.sections.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end border-t border-slate-100 p-4">
          <Button type="button" onClick={onClose} className="px-4 py-2 text-sm">
            {t('buttons.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}

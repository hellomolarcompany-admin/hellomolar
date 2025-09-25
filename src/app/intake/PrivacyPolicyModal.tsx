'use client';

import { useEffect, useMemo, useRef } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import Button from '@/ui/Button';

type PrivacyPolicyModalProps = {
  open: boolean;
  onClose: () => void;
};

type SectionKey =
  | 'whoWeAre'
  | 'scope'
  | 'informationWeCollect'
  | 'howWeUseInformation'
  | 'legalBasis'
  | 'hipaa'
  | 'ccpa'
  | 'dataRetention'
  | 'dataSharing'
  | 'securityMeasures'
  | 'yourRights'
  | 'cookies'
  | 'childPrivacy'
  | 'dataBreach'
  | 'changes'
  | 'contact';

type SectionContent = {
  title: string;
  intro?: string;
  paragraphs?: Record<string, string>;
  bullets?: Record<string, string>;
  subsections?: Record<
    string,
    {
      title?: string;
      paragraphs?: Record<string, string>;
      bullets?: Record<string, string>;
    }
  >;
  note?: string;
};

const SECTION_ORDER: SectionKey[] = [
  'whoWeAre',
  'scope',
  'informationWeCollect',
  'howWeUseInformation',
  'legalBasis',
  'hipaa',
  'ccpa',
  'dataRetention',
  'dataSharing',
  'securityMeasures',
  'yourRights',
  'cookies',
  'childPrivacy',
  'dataBreach',
  'changes',
  'contact',
];

const SUBSECTION_ORDER: Partial<Record<SectionKey, readonly string[]>> = {
  informationWeCollect: ['patient', 'staff', 'technical'],
};

export default function PrivacyPolicyModal({ open, onClose }: PrivacyPolicyModalProps) {
  const t = useTranslations('intake');
  const locale = useLocale();
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

  const sectionKeys = useMemo(() => SECTION_ORDER, []);
  const effectiveDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date());
    }
  }, [locale]);

  const toList = (map?: Record<string, string>) => (map ? Object.values(map) : []);

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
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white shadow"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 id="privacy-modal-title" className="text-lg font-semibold">
              {t('privacyModal.title')}
            </h2>
            <div className="mt-1 text-xs text-slate-600">
              <p>{t('privacyModal.effectiveDate', { date: effectiveDate })}</p>
              <p>{t('privacyModal.lastUpdated')}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-black/10"
            onClick={onClose}
            aria-label={t('buttons.close')}
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6 text-sm text-slate-700">
          <ol className="space-y-6">
            {sectionKeys.map((key) => {
              const section = t(`privacyModal.sections.${key}`, {
                returnObjects: true,
              }) as SectionContent;
              const subsections = section.subsections ?? {};
              const subsectionKeys = SUBSECTION_ORDER[key] || Object.keys(subsections);
              const paragraphs = toList(section.paragraphs);
              const bullets = toList(section.bullets);

              return (
                <li key={key} className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
                  {paragraphs.map((paragraph, index) => (
                    <p key={index} className="leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                  {section.intro ? <p className="leading-relaxed">{section.intro}</p> : null}
                  {bullets.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5">
                      {bullets.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {subsectionKeys.length > 0 ? (
                    <div className="space-y-3">
                      {subsectionKeys.map((subKey) => {
                        const subsection = subsections[subKey];
                        if (!subsection) return null;
                        const subParagraphs = toList(subsection.paragraphs);
                        const subBullets = toList(subsection.bullets);
                        return (
                          <div key={subKey} className="space-y-2">
                            {subsection.title ? (
                              <h4 className="font-medium text-slate-900">{subsection.title}</h4>
                            ) : null}
                            {subParagraphs.map((paragraph, index) => (
                              <p key={index} className="leading-relaxed">
                                {paragraph}
                              </p>
                            ))}
                            {subBullets.length > 0 ? (
                              <ul className="list-disc space-y-1 pl-5">
                                {subBullets.map((item, index) => (
                                  <li key={index}>{item}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {section.note ? <p className="leading-relaxed">{section.note}</p> : null}
                </li>
              );
            })}
          </ol>
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

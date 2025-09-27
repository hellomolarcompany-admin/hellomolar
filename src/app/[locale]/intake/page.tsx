import { notFound } from 'next/navigation';
import { type AbstractIntlMessages, createTranslator } from 'next-intl';

import IntakeFormClient from '@/app/intake/IntakeFormClient';
import { type Locale } from '@/i18n/config';
import { resolvePrefillPatient } from '@/lib/appointments/prefill';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

const dictionaries: Record<Locale, () => Promise<AbstractIntlMessages>> = {
  nl: () => import('@/messages/nl.json').then((m) => m.default),
  en: () => import('@/messages/en.json').then((m) => m.default),
  es: () => import('@/messages/es.json').then((m) => m.default),
  pap: () => import('@/messages/pap.json').then((m) => m.default),
};

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const messages = await dictionaries[locale as Locale]();
  const t = createTranslator({ locale, messages, namespace: 'intake' });
  return { title: t('metaTitle') };
}

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  if (!modules.intake) return notFound();

  const sp = (await props.searchParams) || {};
  let prefill:
    | {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        dateOfBirth?: string;
        preferredLocale?: string;
      }
    | undefined;
  let prefillToken: string | undefined;

  if (sp.prefill) {
    const rawToken = sp.prefill;
    const token = decodeURIComponent(rawToken);
    const tenant = await getTenantClient();
    if (tenant) {
      const resolved = await resolvePrefillPatient(tenant.prisma, token);
      if (resolved && resolved.payload.tid === tenant.info.id) {
        prefill = {
          firstName: resolved.patient.firstName ?? undefined,
          lastName: resolved.patient.lastName ?? undefined,
          email: resolved.patient.email ?? undefined,
          phone: resolved.patient.phone ?? undefined,
          dateOfBirth: resolved.patient.dob
            ? resolved.patient.dob.toISOString().slice(0, 10)
            : undefined,
          preferredLocale: resolved.patient.preferredLocale ?? resolved.payload.loc,
        };
        prefillToken = rawToken;
      }
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl py-6">
        <IntakeFormClient prefill={prefill} prefillToken={prefillToken} />
      </div>
    </main>
  );
}

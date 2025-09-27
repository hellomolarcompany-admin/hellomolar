import { notFound } from 'next/navigation';
import { type AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';

import LanguageSwitcher from '@/components/LanguageSwitcher';
import { isLocale, type Locale } from '@/i18n/config';
import HeaderImage from '@/ui/HeaderImage';

export const metadata = {
  title: 'HelloMolar',
  description: 'Intake form',
};

const dictionaries: Record<Locale, () => Promise<AbstractIntlMessages>> = {
  nl: () => import('@/messages/nl.json').then((m) => m.default),
  en: () => import('@/messages/en.json').then((m) => m.default),
  es: () => import('@/messages/es.json').then((m) => m.default),
  pap: () => import('@/messages/pap.json').then((m) => m.default),
};

export default async function LocaleLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  if (!isLocale(locale)) notFound();

  const messages = await dictionaries[locale as Locale]();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="mx-auto max-w-5xl px-4 py-4">
        <header className="mb-6">
          <HeaderImage />
          <div className="mt-3 flex items-center justify-end">
            <LanguageSwitcher />
          </div>
        </header>
        {props.children}
      </div>
    </NextIntlClientProvider>
  );
}

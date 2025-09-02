import Link from 'next/link';

import HeaderImage from '@/ui/HeaderImage';

export default function Home() {
  const choices = [
    { locale: 'pap', label: 'Papiamento' },
    { locale: 'nl', label: 'Nederlands' },
    { locale: 'es', label: 'Español' },
    { locale: 'en', label: 'English' },
  ] as const;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6">
        <HeaderImage />
      </header>

      <h1 className="mb-4 text-center text-xl font-semibold">Please select your language</h1>

      <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {choices.map((c) => (
          <Link
            key={c.locale}
            href={`/${c.locale}/intake`}
            className="btn btn-outline block w-full text-center text-lg py-6"
          >
            {c.label}
          </Link>
        ))}
      </div>
    </main>
  );
}

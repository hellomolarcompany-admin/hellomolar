import { getLocale } from 'next-intl/server';

import './globals.css';

export const metadata = {
  title: 'HelloMolar',
  description: 'HelloMolar application',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="bg-white text-black">{children}</body>
    </html>
  );
}

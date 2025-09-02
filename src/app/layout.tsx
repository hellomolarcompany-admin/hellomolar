import type { Viewport } from 'next';
import { getLocale } from 'next-intl/server';
import { Dancing_Script, Montserrat } from 'next/font/google';

import './globals.css';

export const metadata = {
  title: 'HelloMolar',
  description: 'HelloMolar application',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const sans = Montserrat({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const script = Dancing_Script({ subsets: ['latin'], variable: '--font-script', display: 'swap' });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${sans.variable} ${script.variable} bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}

import { notFound } from 'next/navigation';

import { modules } from '@/lib/modules';

import InvoicingNavigation from './InvoicingNavigation';

export default function InvoicingLayout({ children }: { children: React.ReactNode }) {
  if (!modules.invoicing) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 text-sm">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-slate-900">Invoicing</h1>
        <p className="text-sm text-slate-600">
          Manage draft invoices, price lists, and patient billing assets for your practice.
        </p>
        <InvoicingNavigation />
      </header>
      <section>{children}</section>
    </div>
  );
}

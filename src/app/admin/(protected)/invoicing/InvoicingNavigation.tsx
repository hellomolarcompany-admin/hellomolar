'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/ui/utils';

const items = [
  { href: '/admin/invoicing', label: 'Draft invoices' },
  { href: '/admin/invoicing/price-lists', label: 'Price lists' },
  { href: '/admin/invoicing/treatments', label: 'Treatments' },
];

export default function InvoicingNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Invoicing sections" className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold transition',
              'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100',
              active && 'border-slate-900 bg-slate-900 text-white shadow',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import Icon from '@/ui/Icon';
import { cn } from '@/ui/utils';

type IconName = 'dashboard' | 'intake' | 'calendar' | 'invoice';

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

function NavIcon({ name }: { name: IconName }) {
  switch (name) {
    case 'calendar':
      return (
        <Icon aria-hidden>
          <rect x={3.5} y={5.5} width={17} height={15} rx={2} />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M3.5 11.5h17" />
        </Icon>
      );
    case 'intake':
      return (
        <Icon aria-hidden>
          <path d="M7 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
          <path d="M9 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2" />
          <path d="M11 8h4" />
          <path d="M11 12h4" />
          <path d="M11 16h3" />
        </Icon>
      );
    case 'invoice':
      return (
        <Icon aria-hidden>
          <rect x={5} y={3} width={14} height={18} rx={2} />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
          <path d="M9 5v-2" />
          <path d="M15 5v-2" />
        </Icon>
      );
    case 'dashboard':
    default:
      return (
        <Icon aria-hidden>
          <path d="M4 13h6V4H4z" />
          <path d="M14 20h6V10h-6z" />
          <path d="M14 4h6" />
          <path d="M4 20h6" />
          <path d="M12 4v16" />
        </Icon>
      );
  }
}

export default function AdminNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  if (!items.length) return null;

  return (
    <nav aria-label="Admin modules" className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur">
        {items.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-slate-600 transition',
                'hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
                active && 'bg-slate-900 text-white shadow',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <NavIcon name={item.icon} />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

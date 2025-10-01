import { cookies } from 'next/headers';

import { verifySession } from '@/lib/auth';
import { modules } from '@/lib/modules';
import { resolveTenant } from '@/lib/tenant';
import HeaderImage from '@/ui/HeaderImage';

import AdminNavigation from './AdminNavigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const token = store.get('ADMIN_SESSION')?.value || '';
  const session = token ? verifySession(token) : null;
  // Ensure tenant context matches session
  const t = await resolveTenant();
  if (!session || session.role !== 'tenant_admin' || (t && session.tid && session.tid !== t.id)) {
    return (
      <main className="mx-auto max-w-xl p-6 text-sm">
        <h1 className="mb-3 text-lg font-semibold">Unauthorized</h1>
        <p>
          Access to this page is restricted. Please{' '}
          <a href="/admin/login" className="underline">
            sign in
          </a>{' '}
          to continue.
        </p>
      </main>
    );
  }

  const csrfCookie = store.get('ADMIN_CSRF')?.value || '';
  const items = [
    modules.intake && { href: '/admin/intake', label: 'Intake', icon: 'intake' as const },
    modules.apprequest && {
      href: '/admin/appointments',
      label: 'Appointment requests',
      icon: 'calendar' as const,
    },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: 'intake' | 'calendar' }>;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <HeaderImage />
        </div>
        <div className="border-t border-slate-200 bg-slate-50/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <AdminNavigation items={items} />
            <form method="POST" action="/admin/logout">
              <input type="hidden" name="csrf" defaultValue={csrfCookie} />
              <button
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                type="submit"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}

import { cookies } from 'next/headers';
import Link from 'next/link';

import { verifySession } from '@/lib/auth';
import { modules } from '@/lib/modules';
import { resolveTenant } from '@/lib/tenant';
import HeaderImage from '@/ui/HeaderImage';

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
  return (
    <>
      {/* Site header banner */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl p-3">
          <HeaderImage />
        </div>
      </header>

      {/* Admin navigation bar */}
      <header className="border-b bg-gray-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-gray-600">Admin</span>
            <Link className="rounded px-2 py-1 hover:bg-gray-200" href="/admin/intake">
              Intake
            </Link>
            {modules.apprequest && (
              <Link className="rounded px-2 py-1 hover:bg-gray-200" href="/admin/appointments">
                Appointment requests
              </Link>
            )}
          </nav>
          <form method="POST" action="/admin/logout">
            <input type="hidden" name="csrf" defaultValue={csrfCookie} />
            <button className="rounded border px-3 py-1" type="submit">
              Logout
            </button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}

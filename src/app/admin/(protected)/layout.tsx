import { cookies } from 'next/headers';

import { verifySession } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const token = store.get('ADMIN_SESSION')?.value || '';
  const session = token ? verifySession(token) : null;
  if (!session) {
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
      <header className="border-b bg-gray-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-3 text-sm">
          <div className="font-medium">Admin</div>
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

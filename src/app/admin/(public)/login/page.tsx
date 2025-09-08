import Link from 'next/link';

import CsrfField from '@/components/CsrfField';

export const dynamic = 'force-dynamic';

export default async function Page(props: { searchParams?: Promise<{ returnTo?: string }> }) {
  const sp = (await props.searchParams) || {};
  const raw = sp.returnTo;
  const returnTo = typeof raw === 'string' && raw.startsWith('/') ? raw : '/admin/intake';
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-semibold">Admin Login</h1>
      <form method="POST" action="/admin/login/submit" className="space-y-3">
        <input type="hidden" name="returnTo" value={returnTo} />
        <CsrfField />
        <div>
          <label className="block text-sm font-medium">Username</label>
          <input
            name="username"
            required
            className="mt-1 w-full rounded-md border p-2"
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded-md border p-2"
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Bootstrap token (first admin only)</label>
          <input
            name="bootstrap"
            type="password"
            className="mt-1 w-full rounded-md border p-2"
            placeholder="Only needed if no admin exists"
            autoComplete="off"
          />
        </div>
        <button type="submit" className="w-full rounded-md bg-black p-2 text-white">
          Sign in
        </button>
      </form>
      <div className="mt-4 text-sm">
        <Link className="underline" href="/">
          Back to site
        </Link>
      </div>
    </main>
  );
}

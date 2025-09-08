'use client';

import { useEffect, useState } from 'react';

// Minimal CSRF hidden field. Middleware ensures ADMIN_CSRF cookie exists.
export default function CsrfField() {
  const [val, setVal] = useState('');

  useEffect(() => {
    const fromCookie = document.cookie
      .split('; ')
      .find((s) => s.startsWith('ADMIN_CSRF='))
      ?.split('=')[1];
    if (fromCookie) {
      setVal(fromCookie);
      return;
    }
    // Fallback: request a CSRF token from the server, which also sets the cookie
    (async () => {
      try {
        const res = await fetch('/admin/csrf', { method: 'GET', cache: 'no-store' });
        const data = (await res.json()) as { ok?: boolean; csrf?: string };
        if (data?.ok && data?.csrf) setVal(data.csrf);
      } catch {
        // ignore; value remains empty
      }
    })();
  }, []);

  return <input type="hidden" name="csrf" value={val} />;
}

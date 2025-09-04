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
    if (fromCookie) setVal(fromCookie);
  }, []);

  return <input type="hidden" name="csrf" value={val} />;
}

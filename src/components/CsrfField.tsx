'use client';

import { useEffect, useRef, useState } from 'react';

export default function CsrfField() {
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Ensure CSRF token is present: prefer cookie; if missing, generate client-side token
  useEffect(() => {
    let alive = true;
    (async () => {
      const fromCookie = document.cookie
        .split('; ')
        .find((s) => s.startsWith('ADMIN_CSRF='))
        ?.split('=')[1];
      if (fromCookie) {
        if (alive) setVal(fromCookie);
        return;
      }
      // Generate a new token and set it in a non-HttpOnly cookie
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const token = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `ADMIN_CSRF=${token}; Path=/; SameSite=Lax${secure}`;
      if (alive) setVal(token);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // As a safety net, intercept the first submit if no token is present yet
  useEffect(() => {
    const el = inputRef.current;
    const form = (el ? el.closest('form') : null) as HTMLFormElement | null;
    if (!form) return;

    const onSubmit = async (e: Event) => {
      const current = (inputRef.current?.value || '').trim();
      if (current) return; // token present, allow submit
      e.preventDefault();
      // As a last resort, generate a token client-side
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const token = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `ADMIN_CSRF=${token}; Path=/; SameSite=Lax${secure}`;
      if (inputRef.current) inputRef.current.value = token;
      setVal(token);
      (form as HTMLFormElement).submit();
    };

    form.addEventListener('submit', onSubmit as EventListener);
    return () => form.removeEventListener('submit', onSubmit as EventListener);
  }, []);

  return <input ref={inputRef} type="hidden" name="csrf" value={val} />;
}

import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';

import { locales } from './src/i18n/config';
import { routing } from './src/i18n/routing';

// Locale routing via next-intl
const intlMiddleware = createMiddleware(routing);

function b64urlToBytes(s: string): Uint8Array {
  let base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(view.byteLength);
  new Uint8Array(buf).set(view);
  return buf;
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function isValidSessionToken(token: string): Promise<boolean> {
  try {
    const [b, s] = token.split('.');
    if (!b || !s) return false;
    const body = b64urlToBytes(b);
    const sig = b64urlToBytes(s);
    const keyData = new TextEncoder().encode(process.env.SESSION_SECRET || '');
    if (!keyData.length) return false;
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const expected = new Uint8Array(
      await crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(body)),
    );
    if (expected.byteLength !== sig.byteLength) return false;
    let ok = 0;
    for (let i = 0; i < expected.byteLength; i++) ok |= expected[i] ^ sig[i];
    if (ok !== 0) return false;
    const parsed = JSON.parse(new TextDecoder().decode(body)) as { exp?: number };
    const now = Math.floor(Date.now() / 1000);
    if (!parsed.exp || parsed.exp <= now) return false;
    return true;
  } catch {
    return false;
  }
}

export default async function middleware(req: Request) {
  const url = new URL(req.url);
  // Normalize pathname by stripping a leading locale segment if present
  const segments = url.pathname.split('/').filter(Boolean);
  const first = segments[0];
  const normalizedPath = (locales as readonly string[]).includes(first || '')
    ? `/${segments.slice(1).join('/')}`
    : url.pathname;

  if (normalizedPath.startsWith('/admin')) {
    // Allow login endpoints without session
    if (normalizedPath.startsWith('/admin/login')) {
      const res = (await intlMiddleware(
        req as unknown as Parameters<typeof intlMiddleware>[0],
      )) as NextResponse;
      // Ensure CSRF cookie exists for admin pages
      const hasCsrf = (req.headers.get('cookie') || '').includes('ADMIN_CSRF=');
      if (!hasCsrf) {
        const token = bytesToB64url(crypto.getRandomValues(new Uint8Array(16)));
        const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
        const secure = proto === 'https';
        // Set non-HttpOnly so the client can submit it as a hidden field
        (res as NextResponse).cookies.set('ADMIN_CSRF', token, {
          httpOnly: false,
          sameSite: 'lax',
          secure,
          path: '/',
        });
      }
      return res;
    }
    // Check for presence of session cookie; detailed verification happens server-side
    const cookie = (req.headers.get('cookie') || '')
      .split(';')
      .find((c) => c.trim().startsWith('ADMIN_SESSION='));
    const token = cookie ? decodeURIComponent(cookie.split('=')[1].trim()) : '';
    if (!token || !(await isValidSessionToken(token))) {
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('returnTo', url.pathname + url.search);
      return NextResponse.redirect(loginUrl);
    }
    const res = (await intlMiddleware(
      req as unknown as Parameters<typeof intlMiddleware>[0],
    )) as NextResponse;
    const hasCsrf = (req.headers.get('cookie') || '').includes('ADMIN_CSRF=');
    if (!hasCsrf) {
      const token = bytesToB64url(crypto.getRandomValues(new Uint8Array(16)));
      const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
      const secure = proto === 'https';
      (res as NextResponse).cookies.set('ADMIN_CSRF', token, {
        httpOnly: false,
        sameSite: 'lax',
        secure,
        path: '/',
      });
    }
    return res;
  }
  return intlMiddleware(req as unknown as Parameters<typeof intlMiddleware>[0]);
}

export const config = {
  // Only run middleware on admin routes (with and without a locale prefix)
  matcher: ['/admin/:path*', '/:locale/admin/:path*'],
};

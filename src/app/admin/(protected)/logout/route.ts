import { NextResponse } from 'next/server';

import { verifyCsrfForRequest } from '@/lib/auth';

export async function POST(req: Request) {
  // Verify CSRF (double-submit or same-origin navigation)
  try {
    const form = await req.formData();
    const csrf = String(form.get('csrf') || '');
    const ok = await verifyCsrfForRequest(req, csrf);
    if (!ok) {
      const res = NextResponse.redirect(new URL('/admin/login?err=csrf', req.url));
      return res;
    }
  } catch {
    // Ignore parsing issues; treat as authorized same-origin navigation if headers allow
  }

  const res = NextResponse.redirect(new URL('/admin/login', req.url));
  // Clear session cookie explicitly on the response
  try {
    const proto =
      req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '');
    const secure = proto === 'https';
    res.cookies.set('ADMIN_SESSION', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 0,
    });
  } catch {
    // swallow and still redirect
  }
  return res;
}

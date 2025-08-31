import { NextResponse } from 'next/server';

import { clearSessionCookie } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const csrf = String(form.get('csrf') || '');
    if (!verifyCsrfToken(csrf)) {
      return NextResponse.redirect(new URL('/admin/login?err=csrf', req.url));
    }
  } catch {
    // ignore and proceed with logout
  }
  clearSessionCookie();
  return NextResponse.redirect('/admin/login');
}

import { NextResponse } from 'next/server';

function newToken(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Buffer.from(arr).toString('base64url');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const secure = proto === 'https';
  const token = newToken();
  const res = NextResponse.json({ ok: true, csrf: token });
  res.cookies.set('ADMIN_CSRF', token, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  return res;
}

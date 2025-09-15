import { NextResponse } from 'next/server';

import { hashPassword, setSessionCookie, verifyCsrfForRequest, verifyPassword } from '@/lib/auth';
import { rateLimit, rlKeyFromRequest } from '@/lib/rateLimit';
import { getTenantClient } from '@/lib/tenant';

export async function POST(req: Request) {
  const host = req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '');
  const origin = `${proto}://${host || 'localhost:3000'}`;
  const abs = (path: string) => new URL(path, origin);
  // Note: In development we accept localhost directly (no subdomain redirect).
  // Throttle login attempts: 10/min/IP
  const tenant = await getTenantClient();
  const tid = tenant?.info.id || 'unknown';
  const rl = await rateLimit(rlKeyFromRequest(req, 'login', tid), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.redirect(abs('/admin/login?err=rate'), 303);
  }
  const form = await req.formData();
  const username = String(form.get('username') || '').trim();
  const password = String(form.get('password') || '');
  const csrf = String(form.get('csrf') || '');
  const base = new URL(req.url);
  const returnToRaw = String(form.get('returnTo') || '');
  let returnTo = '/admin/intake';
  try {
    if (returnToRaw) {
      const u = new URL(returnToRaw, base);
      if (u.origin === base.origin && u.pathname.startsWith('/')) {
        returnTo = u.pathname + u.search;
      }
    }
  } catch {
    // ignore and keep default
  }
  const bootstrapToken = String(form.get('bootstrap') || '');

  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.redirect(abs('/admin/login?err=csrf'), 303);
  }

  if (!tenant) {
    return NextResponse.redirect(abs('/admin/login?err=tenant'), 303);
  }
  const prisma = tenant.prisma;

  const totalAdmins = await prisma.adminUser.count();
  if (totalAdmins === 0) {
    // Bootstrap initial admin
    const inProd = process.env.NODE_ENV === 'production';
    const expected = process.env.ADMIN_BOOTSTRAP_TOKEN || '';
    if (inProd) {
      // In production, require a configured one-time bootstrap token
      if (!expected || !bootstrapToken || bootstrapToken !== expected) {
        return NextResponse.redirect(abs('/admin/login?err=bootstrap-disabled'), 303);
      }
    }
    if (!username || password.length < 8) {
      return NextResponse.redirect(abs('/admin/login?err=bootstrap'), 303);
    }
    const passwordHash = await hashPassword(password);
    const created = await prisma.adminUser.create({ data: { username, passwordHash } });
    await setSessionCookie({ uid: created.id, tid: tenant.info.id, role: 'tenant_admin' }, { req });
    return NextResponse.redirect(abs(returnTo), 303);
  }

  const user = await prisma.adminUser.findUnique({ where: { username } });
  const now = new Date();
  if (!user) return NextResponse.redirect(abs('/admin/login?err=invalid'), 303);
  if (user.lockedUntil && user.lockedUntil > now) {
    return NextResponse.redirect(abs('/admin/login?err=locked'), 303);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const attempts = user.failedAttempts + 1;
    let lockedUntil: Date | null = null;
    if (attempts >= 5) {
      // Lock for 10 minutes
      lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    }
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { failedAttempts: attempts, lockedUntil: lockedUntil },
    });
    return NextResponse.redirect(abs('/admin/login?err=invalid'), 303);
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await setSessionCookie({ uid: user.id, tid: tenant.info.id, role: 'tenant_admin' }, { req });
  return NextResponse.redirect(abs(returnTo), 303);
}

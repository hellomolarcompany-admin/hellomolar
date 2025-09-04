import { NextResponse } from 'next/server';

import { hashPassword, setSessionCookie, verifyCsrfForRequest, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, rlKeyFromRequest } from '@/lib/rateLimit';

export async function POST(req: Request) {
  // Throttle login attempts: 10/min/IP
  const rl = rateLimit(rlKeyFromRequest(req, 'login'), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.redirect(new URL('/admin/login?err=rate', req.url));
  }
  const form = await req.formData();
  const username = String(form.get('username') || '').trim();
  const password = String(form.get('password') || '');
  const csrf = String(form.get('csrf') || '');
  const returnTo = String(form.get('returnTo') || '/admin/intake');
  const bootstrapToken = String(form.get('bootstrap') || '');

  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.redirect(new URL('/admin/login?err=csrf', req.url));
  }

  const totalAdmins = await prisma.adminUser.count();
  if (totalAdmins === 0) {
    // Bootstrap initial admin
    const inProd = process.env.NODE_ENV === 'production';
    const expected = process.env.ADMIN_BOOTSTRAP_TOKEN || '';
    if (inProd) {
      // In production, require a configured one-time bootstrap token
      if (!expected || !bootstrapToken || bootstrapToken !== expected) {
        return NextResponse.redirect(new URL('/admin/login?err=bootstrap-disabled', req.url));
      }
    }
    if (!username || password.length < 8) {
      return NextResponse.redirect(new URL('/admin/login?err=bootstrap', req.url));
    }
    const passwordHash = await hashPassword(password);
    const created = await prisma.adminUser.create({ data: { username, passwordHash } });
    await setSessionCookie(created.id, { req });
    return NextResponse.redirect(new URL(returnTo, req.url));
  }

  const user = await prisma.adminUser.findUnique({ where: { username } });
  const now = new Date();
  if (!user) return NextResponse.redirect(new URL('/admin/login?err=invalid', req.url));
  if (user.lockedUntil && user.lockedUntil > now) {
    return NextResponse.redirect(new URL('/admin/login?err=locked', req.url));
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
    return NextResponse.redirect(new URL('/admin/login?err=invalid', req.url));
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await setSessionCookie(user.id, { req });
  return NextResponse.redirect(new URL(returnTo, req.url));
}

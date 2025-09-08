import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { getTenantClient } from '@/lib/tenant';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Require a valid admin session
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL('/admin/login?err=auth', req.url));
  }

  const { id } = await ctx.params;
  const form = await req.formData();
  const csrf = String(form.get('csrf') || '');
  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.redirect(new URL('/admin/intake?err=csrf', req.url));
  }
  try {
    const tenant = await getTenantClient();
    if (!tenant) return NextResponse.redirect(new URL('/admin/intake?err=tenant', req.url));
    await tenant.prisma.intakeSubmission.delete({ where: { id } });
    try {
      const ipInet = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
      const userAgent = req.headers.get('user-agent') || null;
      await tenant.prisma.adminAuditLog.create({
        data: {
          adminId: session.uid,
          action: 'intake.delete',
          subjectId: id,
          ipInet: ipInet || undefined,
          userAgent: userAgent || undefined,
        },
      });
    } catch {}
  } catch {
    // ignore
  }
  // Use 303 to ensure the client performs a GET to the list after POST
  return NextResponse.redirect(new URL('/admin/intake', req.url), 303);
}

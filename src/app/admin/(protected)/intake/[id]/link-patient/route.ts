import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { getTenantClient } from '@/lib/tenant';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/admin/login?err=auth', req.url));
  const { id } = await ctx.params;
  const form = await req.formData();
  const csrf = String(form.get('csrf') || '');
  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.redirect(new URL(`/admin/intake/${id}?err=csrf`, req.url));
  }
  const tenant = await getTenantClient();
  if (!tenant) return NextResponse.redirect(new URL(`/admin/intake/${id}?err=tenant`, req.url));
  const prisma = tenant.prisma;
  try {
    const rec = await prisma.intakeSubmission.findUnique({ where: { id } });
    if (!rec) return NextResponse.redirect(new URL('/admin/intake?err=notfound', req.url));
    // Upsert a minimal Patient record based on the intake submission
    const [firstName, ...rest] = (rec.fullName || '').split(' ');
    const lastName = rest.join(' ').trim() || firstName || 'Unknown';
    const patient = await prisma.patient.create({
      data: {
        firstName: firstName || 'Unknown',
        lastName,
        dob: rec.dob ?? undefined,
        email: rec.email ?? undefined,
        phone: rec.phone ?? undefined,
      },
    });
    await prisma.intakeSubmission.update({
      where: { id },
      data: { patientId: patient.id },
    });
  } catch {
    // ignore failures but still redirect back
  }
  return NextResponse.redirect(new URL(`/admin/intake/${id}`, req.url), 303);
}

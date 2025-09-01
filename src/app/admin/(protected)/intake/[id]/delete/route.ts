import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Require a valid admin session
  if (!(await getSession())) {
    return NextResponse.redirect('/admin/login?err=auth');
  }

  const { id } = await ctx.params;
  const form = await req.formData();
  const csrf = String(form.get('csrf') || '');
  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.redirect('/admin/intake?err=csrf');
  }
  try {
    await prisma.intakeSubmission.delete({ where: { id } });
  } catch {
    // ignore
  }
  return NextResponse.redirect('/admin/intake');
}

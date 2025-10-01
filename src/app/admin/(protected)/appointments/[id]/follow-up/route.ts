import { NextResponse } from 'next/server';

import { logFollowUp } from '@/lib/appointments/service';
import { followUpCreateSchema } from '@/lib/appointments/validation';
import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!modules.apprequest) {
    return NextResponse.redirect(new URL('/admin/appointments?err=module', req.url));
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL('/admin/login?err=auth', req.url));
  }

  const { id } = await ctx.params;
  const form = await req.formData();
  const csrf = String(form.get('csrf') || '');
  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.redirect(new URL(`/admin/appointments/${id}?err=csrf`, req.url));
  }

  const tenant = await getTenantClient();
  if (!tenant) {
    return NextResponse.redirect(new URL('/admin/appointments?err=tenant', req.url));
  }
  const prisma = tenant.prisma;

  const request = await prisma.appointmentRequest.findUnique({ where: { id } });
  if (!request) {
    return NextResponse.redirect(new URL('/admin/appointments?err=missing', req.url));
  }

  const parsed = followUpCreateSchema.safeParse({
    occurredAt: form.get('occurred_at') ? String(form.get('occurred_at')) : undefined,
    channel: String(form.get('channel') || ''),
    outcome: String(form.get('outcome') || ''),
    notes: String(form.get('notes') || ''),
    recordEvent: form.get('record_event') != null ? 'true' : 'false',
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL(`/admin/appointments/${id}?err=validation`, req.url));
  }

  try {
    await logFollowUp(prisma, {
      ...parsed.data,
      request,
      tenantId: tenant.info.id,
      staffId: undefined,
    });
    return NextResponse.redirect(new URL(`/admin/appointments/${id}?follow=1`, req.url), 303);
  } catch (error) {
    console.error('Failed to log follow-up', error);
    return NextResponse.redirect(new URL(`/admin/appointments/${id}?err=server`, req.url));
  }
}

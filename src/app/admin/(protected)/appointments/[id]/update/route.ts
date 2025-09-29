import { AppointmentRequestStatus } from '@prisma/client';
import { NextResponse } from 'next/server';

import { updateRequestStatus } from '@/lib/appointments/service';
import { appointmentRequestUpdateSchema } from '@/lib/appointments/validation';
import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

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

  const status = String(form.get('status') || '').toUpperCase();
  const plannedDuration = Number(form.get('planned_duration') || '0');
  const preferredProviderIds = form.getAll('preferred_provider_ids').map((value) => String(value));
  const notes = String(form.get('notes') || '').trim() || undefined;
  const preferredLocale = String(form.get('preferred_locale') || '').trim() || undefined;

  const availabilityEntries = WEEKDAYS.map((day) => {
    const slots = form.getAll(`availability_${day}`).map((value) => String(value));
    return [day, slots] as const;
  });
  const availability = Object.fromEntries(
    availabilityEntries.filter(([, slots]) => slots.length > 0),
  ) as Record<string, string[]>;

  const parsed = appointmentRequestUpdateSchema.safeParse({
    status: status in AppointmentRequestStatus ? (status as AppointmentRequestStatus) : undefined,
    plannedDurationMinutes: Number.isFinite(plannedDuration) ? plannedDuration : undefined,
    preferredProviderIds,
    availability,
    notes,
    preferredLocale,
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL(`/admin/appointments/${id}?err=validation`, req.url));
  }

  try {
    await updateRequestStatus(prisma, id, tenant.info.id, parsed.data);
    return NextResponse.redirect(new URL(`/admin/appointments/${id}?saved=1`, req.url), 303);
  } catch (error) {
    console.error('Failed to update appointment request', error);
    return NextResponse.redirect(new URL(`/admin/appointments/${id}?err=server`, req.url));
  }
}

import { NextResponse } from 'next/server';

import { signPrefillToken } from '@/lib/appointments/prefill';
import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

const TEMPLATE_MESSAGES: Record<string, string> = {
  en: 'Dear patient, thank you for your interest in our Dental Clinic. We kindly request you to fill in the following form to finalize your request (form). Please note this link will only work for 24 hours. If you do not fill the form before, your request will be put on hold.',
  nl: 'Beste patiënt, bedankt voor uw interesse in onze tandartspraktijk. Wil u alstublieft het volgende formulier invullen om uw aanvraag af te ronden (form). Deze link is slechts 24 uur geldig. Als het formulier niet tijdig wordt ingevuld, wordt uw aanvraag gepauzeerd.',
  es: 'Estimado paciente, gracias por su interés en nuestra clínica dental. Le pedimos amablemente que complete el siguiente formulario para finalizar su solicitud (form). Este enlace solo funcionará durante 24 horas. Si no lo completa a tiempo, su solicitud quedará en espera.',
  pap: 'Apreciá pacient, danki pa bo interés den nos clínica dental. Por fabor yena e siguiente forma pa finalisá bo petishon (form). Tené cuenta ku e link ta traha solo pa 24 ora. Si bo no yena e forma a tempo, bo petishon lo keda na pausa.',
};

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

  const request = await prisma.appointmentRequest.findUnique({
    where: { id },
    include: { patient: true },
  });
  if (!request || !request.patientId) {
    return NextResponse.redirect(new URL(`/admin/appointments/${id}?err=missing`, req.url));
  }

  const preferredLocale = request.preferredLocale ?? 'en';

  const payload = {
    pid: request.patientId,
    rid: request.id,
    tid: tenant.info.id,
    exp: Date.now() + 24 * 60 * 60 * 1000,
    loc: preferredLocale,
  };
  const token = signPrefillToken(payload);

  const base = new URL(req.url);
  base.pathname = `/${preferredLocale}/intake`;
  base.search = `prefill=${encodeURIComponent(token)}`;
  base.hash = '';
  const shareUrl = base.toString();

  const template = TEMPLATE_MESSAGES[preferredLocale] || TEMPLATE_MESSAGES.en;
  const shareMessage = template.replace('(form)', shareUrl);

  const redirectUrl = new URL(`/admin/appointments/${id}`, req.url);
  redirectUrl.searchParams.set('prefillLink', shareUrl);
  redirectUrl.searchParams.set('prefillMessage', shareMessage);

  return NextResponse.redirect(redirectUrl, 303);
}

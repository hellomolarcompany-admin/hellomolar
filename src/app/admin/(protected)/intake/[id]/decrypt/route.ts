import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { decryptBufferToJson } from '@/lib/crypto';
import { getTenantClient } from '@/lib/tenant';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Require a valid admin session
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const form = await req.formData();
  const csrf = String(form.get('csrf') || '');
  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 });
  }
  const tenant = await getTenantClient();
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  const rec = await tenant.prisma.intakeSubmission.findUnique({ where: { id } });
  if (!rec || !rec.encBlob) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const key = tenant.info.encKey || process.env.INTAKE_ENC_KEY;
  if (!key) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  try {
    // Try primary key; if it fails, try fallbacks for key rotation
    const attemptKeys = [key, ...(process.env.INTAKE_FALLBACK_KEYS?.split(',') || [])].filter(
      (s) => !!s,
    );
    let lastErr: unknown = null;
    for (const k of attemptKeys) {
      try {
        const json = decryptBufferToJson(Buffer.from(rec.encBlob), k);
        // Audit log (best-effort)
        try {
          const ipInet = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
          const userAgent = req.headers.get('user-agent') || null;
          await tenant.prisma.adminAuditLog.create({
            data: {
              adminId: session.uid,
              action: 'intake.decrypt',
              subjectId: id,
              ipInet: ipInet || undefined,
              userAgent: userAgent || undefined,
            },
          });
        } catch {}
        return new Response(JSON.stringify(json, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Decrypt failed');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { decryptBufferToJson } from '@/lib/crypto';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Require a valid admin session
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const form = await req.formData();
  const csrf = String(form.get('csrf') || '');
  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 });
  }
  const rec = await prisma.intakeSubmission.findUnique({ where: { id } });
  if (!rec || !rec.encBlob) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const key = process.env.INTAKE_ENC_KEY;
  if (!key) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  try {
    const json = decryptBufferToJson(Buffer.from(rec.encBlob), key);
    return new Response(JSON.stringify(json, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

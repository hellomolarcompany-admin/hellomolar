import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { InvoiceLineError, previewInvoiceLine } from '@/lib/invoicing/invoiceLines';
import { InvoiceNotFoundError } from '@/lib/invoicing/invoices';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

async function resolveParams(ctx: { params: Promise<{ id: string }> }): Promise<string> {
  const { id } = await ctx.params;
  return id;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!modules.invoicing) {
    return NextResponse.json({ ok: false, message: 'Module disabled' }, { status: 404 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getTenantClient();
  if (!tenant) {
    return NextResponse.json({ ok: false, message: 'Tenant not found' }, { status: 400 });
  }

  const invoiceId = await resolveParams(ctx);
  const url = new URL(req.url);
  const treatmentCodeId = url.searchParams.get('treatmentCodeId') || '';
  if (!treatmentCodeId) {
    return NextResponse.json({ ok: false, message: 'Provide a treatment code.' }, { status: 400 });
  }

  try {
    const preview = await previewInvoiceLine(tenant.prisma, invoiceId, treatmentCodeId);
    return NextResponse.json({ ok: true, preview }, { status: 200 });
  } catch (error) {
    const err = error as unknown;
    if (err instanceof InvoiceNotFoundError || err instanceof InvoiceLineError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 400 });
    }
    console.error('Failed to preview invoice line', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

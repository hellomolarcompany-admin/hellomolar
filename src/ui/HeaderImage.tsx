import { headers } from 'next/headers';
import Image from 'next/image';

import { controlPrisma } from '@/lib/controlPlane';
import { parseTenantFromHost } from '@/lib/tenant';

export default async function HeaderImage() {
  const host = (await headers()).get('host');
  const slug = parseTenantFromHost(host);
  let logoUrl: string | null = null;
  if (slug) {
    try {
      const t = await controlPrisma.tenant.findUnique({
        where: { slug },
        include: { branding: true },
      });
      logoUrl = t?.branding?.logoUrl || null;
    } catch {}
  }
  const src = logoUrl || '/brand/header.svg';
  return (
    <Image
      src={src}
      alt="Klinika Dental header"
      width={1000}
      height={200}
      priority
      sizes="(max-width: 1000px) 100vw, 1000px"
      className="h-auto w-auto max-w-full"
    />
  );
}

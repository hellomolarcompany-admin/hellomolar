export async function verifyHCaptcha(token: string, remoteip?: string | null): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET || '';
  if (!secret) return true; // If not configured, skip check (dev)
  if (!token) return false;
  try {
    const params = new URLSearchParams();
    params.set('secret', secret);
    params.set('response', token);
    if (remoteip) params.set('remoteip', remoteip);
    const res = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

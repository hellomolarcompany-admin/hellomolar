'use client';

import { useEffect, useState } from 'react';

import IntakeForm from './IntakeForm';

export type IntakePrefillData = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  preferredLocale?: string;
};

// Render the form only after mount to avoid SSR/client hydration mismatches
export default function IntakeFormClient({
  prefill,
  prefillToken,
}: {
  prefill?: IntakePrefillData;
  prefillToken?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <IntakeForm prefill={prefill} prefillToken={prefillToken} />;
}

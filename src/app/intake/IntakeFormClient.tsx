'use client';

import { useEffect, useState } from 'react';

import IntakeForm from './IntakeForm';

// Render the form only after mount to avoid SSR/client hydration mismatches
export default function IntakeFormClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <IntakeForm />;
}

import type { ReactNode } from 'react';

import Label from './Label';
import { cn } from './utils';

interface Props {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export default function Field({ label, hint, error, children, className }: Props) {
  return (
    <div className={cn('space-y-1', className)}>
      {label ? <Label>{label}</Label> : null}
      {children}
      {hint && !error ? <p className="hint">{hint}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

import type { ComponentProps } from 'react';

import { cn } from '../utils';

export default function Section({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('section', className)} {...props} />;
}

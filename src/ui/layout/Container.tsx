import type { ComponentProps } from 'react';

import { cn } from '../utils';

export default function Container({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto max-w-5xl px-4', className)} {...props} />;
}

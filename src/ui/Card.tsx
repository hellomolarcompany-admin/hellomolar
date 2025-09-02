import type { ComponentProps } from 'react';

import { cn } from './utils';

export default function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('card', className)} {...props} />;
}

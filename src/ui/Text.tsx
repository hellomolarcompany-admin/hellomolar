import type { ComponentProps } from 'react';

import { cn } from './utils';

interface Props extends ComponentProps<'p'> {
  dim?: boolean;
  small?: boolean;
}

export default function Text({ className, dim, small, ...props }: Props) {
  return (
    <p
      className={cn(
        dim ? 'text-muted-foreground' : 'text-foreground',
        small ? 'text-sm' : 'text-base',
        className,
      )}
      {...props}
    />
  );
}

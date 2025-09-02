import type { ButtonHTMLAttributes } from 'react';

import { cn } from './utils';

type Variant = 'brand' | 'outline' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export default function Button({ className, variant = 'brand', ...props }: Props) {
  const styles =
    variant === 'outline'
      ? 'btn btn-outline'
      : variant === 'ghost'
        ? 'btn btn-ghost'
        : 'btn btn-brand';

  return <button className={cn(styles, className)} {...props} />;
}

import * as React from 'react';

import { cn } from './utils';

export type RadioProps = React.InputHTMLAttributes<HTMLInputElement>;

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="radio"
    className={cn(
      'h-4 w-4 border-brand-600 text-brand-600 focus:ring-2 focus:ring-[var(--ring)]',
      className,
    )}
    {...props}
  />
));
Radio.displayName = 'Radio';

export default Radio;

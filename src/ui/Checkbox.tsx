import * as React from 'react';

import { cn } from './utils';

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        // Force white background when unchecked and brand when checked
        'appearance-none grid h-4 w-4 place-content-center rounded border border-slate-400 bg-white text-white',
        'focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
        'checked:bg-brand-600 checked:border-brand-600',
        // Draw checkmark
        "after:hidden checked:after:block after:content-['✓'] after:text-[0.65rem] after:leading-none",
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = 'Checkbox';

export default Checkbox;

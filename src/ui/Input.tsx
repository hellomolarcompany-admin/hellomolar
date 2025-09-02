import * as React from 'react';

import { cn } from './utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn('w-full rounded-md border p-2', className)} {...props} />
));
Input.displayName = 'Input';

export default Input;

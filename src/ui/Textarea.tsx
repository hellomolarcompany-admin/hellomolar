import * as React from 'react';

import { cn } from './utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn('w-full rounded-md border p-2', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export default Textarea;

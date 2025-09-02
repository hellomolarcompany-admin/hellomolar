import * as React from 'react';

import { cn } from './utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn('w-full rounded-md border p-2', className)} {...props} />
));
Select.displayName = 'Select';

export default Select;

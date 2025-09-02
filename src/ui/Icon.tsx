import type { SVGProps } from 'react';

import { cn } from './utils';

type Props = SVGProps<SVGSVGElement> & { size?: number | string };

export default function Icon({ className, size = 20, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-current', className)}
      {...props}
    />
  );
}

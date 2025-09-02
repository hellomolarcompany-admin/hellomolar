import type { ComponentProps, ReactNode } from 'react';

import { cn } from './utils';

type Level = 1 | 2 | 3 | 4 | 5 | 6;

interface Props extends Omit<ComponentProps<'h1'>, 'children'> {
  level?: Level;
  children: ReactNode;
  uppercase?: boolean;
  scriptAccent?: ReactNode;
}

const sizes: Record<Level, string> = {
  1: 'text-3xl md:text-4xl',
  2: 'text-2xl md:text-3xl',
  3: 'text-xl md:text-2xl',
  4: 'text-lg md:text-xl',
  5: 'text-base md:text-lg',
  6: 'text-sm md:text-base',
};

export function Heading({
  level = 2,
  children,
  className,
  uppercase = true,
  scriptAccent,
  ...rest
}: Props) {
  const Tag = `h${level}` as unknown as React.ElementType;
  return (
    <Tag
      className={cn(
        sizes[level],
        uppercase ? 'heading-title' : 'font-semibold',
        'text-foreground',
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      {scriptAccent ? (
        <span className={cn('ml-2 heading-script text-brand-700')}>{scriptAccent}</span>
      ) : null}
    </Tag>
  );
}

export default Heading;

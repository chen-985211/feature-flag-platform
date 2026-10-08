import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';
const variants = cva('button', {
  variants: {
    variant: {
      primary: 'button-primary',
      outline: 'button-outline',
      ghost: 'button-ghost',
    },
  },
  defaultVariants: { variant: 'outline' },
});
export function Button({
  asChild = false,
  variant,
  className,
  ...props
}: ComponentProps<'button'> & {
  asChild?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
}) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      className={twMerge(clsx(variants({ variant }), className))}
      {...props}
    />
  );
}

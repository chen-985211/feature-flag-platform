import type { ComponentProps } from 'react';
import { Button as UI } from './ui/button';
type Props = Omit<ComponentProps<typeof UI>, 'variant'> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'secondary' | 'destructive';
};
export function Button({ variant = 'outline', ...props }: Props) {
  return (
    <UI variant={variant === 'primary' ? 'default' : variant} {...props} />
  );
}

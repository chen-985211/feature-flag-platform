import type { ComponentProps } from 'react';
import { CircleAlert, Info } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { cn } from '../lib/cn';
export function Notice({
  tone = 'info',
  children,
  className,
  role,
  ...props
}: ComponentProps<typeof Alert> & { tone?: 'info' | 'error' }) {
  const Icon = tone === 'error' ? CircleAlert : Info;
  return (
    <Alert
      variant={tone === 'error' ? 'destructive' : 'default'}
      role={role ?? (tone === 'error' ? 'alert' : 'note')}
      className={cn('notice', className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

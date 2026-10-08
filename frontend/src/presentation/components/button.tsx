import type { ComponentProps } from 'react';
import { Button as UI } from './ui/button';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from './ui/tooltip';
type Props = Omit<ComponentProps<typeof UI>, 'variant'> & {
  variant?:
    'primary' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
};
export function Button({ variant = 'outline', title, ...props }: Props) {
  const label = title;
  const button = (
    <UI
      variant={variant === 'primary' ? 'default' : variant}
      title={props.size === 'icon' ? undefined : title}
      {...props}
    />
  );
  if (props.size !== 'icon' || !label) return button;
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent sideOffset={6}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

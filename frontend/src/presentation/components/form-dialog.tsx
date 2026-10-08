import type { ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
export function FormDialog({
  open,
  title,
  description,
  trigger,
  children,
  busy = false,
  onOpenChange,
  focusTarget,
}: {
  open: boolean;
  title: string;
  description: string;
  trigger?: ReactNode;
  children: ReactNode;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  focusTarget?: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="form-dialog"
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          if (focusTarget?.current) {
            event.preventDefault();
            focusTarget.current.focus();
          }
        }}
      >
        <DialogHeader>
          <div className="dialog-title-row">
            <DialogTitle>{title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              aria-label={'关闭' + title}
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              <X size={16} />
            </Button>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

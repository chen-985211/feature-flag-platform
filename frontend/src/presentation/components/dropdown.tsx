import type { ComponentProps, ReactNode } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select';
const emptyValue = '__ui_empty_selection__';
function selectValue(value: string | number) {
  return value === '' ? emptyValue : String(value);
}
export function Dropdown({
  value,
  onValueChange,
  children,
  disabled,
  ...props
}: Omit<ComponentProps<typeof SelectTrigger>, 'value' | 'onChange'> & {
  value: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <Select
      value={selectValue(value)}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next === emptyValue ? '' : next)}
    >
      <SelectTrigger disabled={disabled} {...props}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" sideOffset={4}>
        {children}
      </SelectContent>
    </Select>
  );
}
export function DropdownOption({
  value,
  children,
  disabled,
}: {
  value: string | number;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <SelectItem value={selectValue(value)} disabled={disabled}>
      {children}
    </SelectItem>
  );
}

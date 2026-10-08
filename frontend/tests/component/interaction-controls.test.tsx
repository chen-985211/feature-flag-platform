import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Dropdown,
  DropdownOption,
} from '../../src/presentation/components/dropdown';
import { FormDialog } from '../../src/presentation/components/form-dialog';
import { History } from '../../src/contexts/audit/presentation/history';
import type { Audit } from '../../src/contexts/audit/application/contracts';

it('maps the all-state selection to an empty business value and rejects disabled options', async () => {
  const changed = vi.fn();
  function Choices() {
    const [value, setValue] = useState('true');
    return (
      <Dropdown
        aria-label="筛选"
        value={value}
        onValueChange={(next) => {
          setValue(next);
          changed(next);
        }}
      >
        <DropdownOption value="">全部状态</DropdownOption>
        <DropdownOption value="true">启用</DropdownOption>
        <DropdownOption value="false" disabled>
          停用
        </DropdownOption>
      </Dropdown>
    );
  }
  render(<Choices />);
  await userEvent.click(screen.getByRole('combobox', { name: '筛选' }));
  const blocked = screen.getByRole('option', { name: '停用' });
  expect(blocked).toHaveAttribute('aria-disabled', 'true');
  await userEvent.click(blocked);
  expect(changed).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('option', { name: '全部状态' }));
  expect(changed).toHaveBeenCalledExactlyOnceWith('');
  expect(screen.getByRole('combobox', { name: '筛选' })).toHaveTextContent(
    '全部状态',
  );
});

it('closes a nested menu before its dialog and restores focus to the select trigger', async () => {
  function Editor() {
    const [open, setOpen] = useState(true);
    return (
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="编辑条件"
        description="选择匹配条件。"
      >
        <Dropdown aria-label="条件" value="equals" onValueChange={() => {}}>
          <DropdownOption value="equals">等于</DropdownOption>
          <DropdownOption value="in">属于</DropdownOption>
        </Dropdown>
      </FormDialog>
    );
  }
  render(<Editor />);
  const trigger = screen.getByRole('combobox', { name: '条件' });
  await userEvent.click(trigger);
  expect(screen.getByRole('listbox')).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('dialog', { name: '编辑条件' })).toBeVisible();
  expect(trigger).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

it('discloses authoritative audit changes and loads the final page through the new pagination', async () => {
  const entry = {
    id: 'first',
    flag_id: 'flag',
    environment: 'development',
    key: 'checkout',
    revision: 2,
    actor_name: 'Admin',
    action: 'flag_created',
    created_at: '2026-10-08T00:00:00Z',
    changes_json: '{"after":{"revision":2}}',
    request_id: 'request',
  };
  const history = vi
    .fn<Audit['history']>()
    .mockResolvedValueOnce({ items: [entry], total: 51 })
    .mockResolvedValueOnce({
      items: [{ ...entry, id: 'last', revision: 9, action: 'flag_edited' }],
      total: 51,
    });
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <History id="flag" audit={{ history }} />
    </QueryClientProvider>,
  );
  const trigger = await screen.findByRole('button', { name: '查看变更详情' });
  expect(screen.queryByText(entry.changes_json)).not.toBeInTheDocument();
  await userEvent.click(trigger);
  expect(screen.getByText(entry.changes_json)).toBeVisible();
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(await screen.findByText('编辑基本信息')).toBeVisible();
  expect(history.mock.calls[1].slice(0, 2)).toEqual(['flag', 50]);
  expect(screen.getByText('r9')).toBeVisible();
  expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '上一页' })).toBeEnabled();
});

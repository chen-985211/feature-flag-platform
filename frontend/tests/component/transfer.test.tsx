import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import type {
  Flag,
  Flags,
} from '../../src/contexts/flags/application/contracts';
import { RuleOrder } from '../../src/contexts/flags/presentation/rule-order';
import { TransferDialog } from '../../src/contexts/flags/presentation/transfer-dialog';
import { ApiError } from '../../src/shared-kernel/errors';
const source: Flag = {
  id: 'source',
  name: 'Fixed',
  key: 'key',
  environment: 'development',
  seed: 'seed',
  revision: 4,
  enabled: true,
  default_value: false,
  rules: [
    {
      id: 'a',
      kind: 'attribute',
      priority: 1,
      attribute: 'tier',
      operator: 'equals',
      expected_json: '"a"',
      result: false,
    },
    {
      id: 'b',
      kind: 'percentage',
      priority: 2,
      percentage_bp: 10000,
      result: true,
    },
  ],
  created_at: '2026-10-08T00:00:00Z',
  updated_at: '2026-10-08T00:00:00Z',
};
const target: Flag = {
  ...source,
  id: 'target',
  environment: 'staging',
  revision: 7,
};
function gateways(): Flags {
  return {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    enabled: vi.fn(),
    saveRule: vi.fn(),
    deleteRule: vi.fn(),
    evaluate: vi.fn(),
    rollback: vi.fn(),
    preview: vi.fn(),
    reorder: vi.fn(),
    copy: vi.fn(),
    publish: vi.fn(),
    publication: vi.fn().mockResolvedValue({
      source_revision: 4,
      target_revision: 7,
      source,
      target,
      changes: [{ field: 'enabled', before_json: 'false', after_json: 'true' }],
    }),
    versions: vi.fn().mockResolvedValue({
      items: [
        {
          revision: 4,
          actor_id: 'actor',
          actor_name: 'Admin',
          schema_version: 1,
          created_at: source.created_at,
        },
      ],
      total: 1,
    }),
    version: vi.fn().mockResolvedValue({ revision: 4, snapshot: source }),
  };
}
function mountDialog(flags: Flags, write = ['staging']) {
  const close = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <TransferDialog
        flag={source}
        flags={flags}
        writeEnvironments={write}
        onSaved={async () => {}}
        close={close}
      />
    </QueryClientProvider>,
  );
  return close;
}
it('submits keyboard sorting with the complete sequence and restores saved order after a conflict', async () => {
  const flags = gateways(),
    reorder = vi
      .fn<Flags['reorder']>()
      .mockRejectedValue(new ApiError('VERSION_CONFLICT'));
  flags.reorder = reorder;
  render(
    <RuleOrder
      flag={source}
      flags={flags}
      canWrite
      onSaved={async () => {}}
      reload={async () => {}}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '调整规则顺序' }));
  screen.getByRole('button', { name: '移动第 2 条规则' }).focus();
  await userEvent.keyboard('{ArrowUp}');
  expect(await screen.findByRole('alert')).toHaveTextContent('已恢复');
  expect(reorder).toHaveBeenCalledWith('source', ['b', 'a'], 4);
  expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('tier');
  expect(
    screen.getByRole('button', { name: '上移第 2 条规则' }),
  ).toBeDisabled();
});
it('submits drag sorting through the same complete-order contract', async () => {
  const flags = gateways(),
    reorder = vi
      .fn<Flags['reorder']>()
      .mockResolvedValue({ ...source, revision: 5 });
  flags.reorder = reorder;
  render(
    <RuleOrder
      flag={source}
      flags={flags}
      canWrite
      onSaved={async () => {}}
      reload={async () => {}}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '调整规则顺序' }));
  const rows = screen.getAllByRole('listitem');
  fireEvent.dragStart(rows[1], {
    dataTransfer: { setData: vi.fn(), effectAllowed: 'move' },
  });
  fireEvent.dragEnter(rows[0]);
  fireEvent.drop(rows[0]);
  expect(reorder).toHaveBeenCalledWith('source', ['b', 'a'], 4);
});
it('preserves fixed source and target after publication conflicts and requires a new preview', async () => {
  const flags = gateways(),
    publish = vi
      .fn<Flags['publish']>()
      .mockRejectedValue(new ApiError('VERSION_CONFLICT'));
  flags.publish = publish;
  mountDialog(flags);
  await userEvent.selectOptions(screen.getByLabelText('操作方式'), 'publish');
  await screen.findByText(/当前 r7/);
  await userEvent.click(screen.getByRole('button', { name: '确认发布' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('已被更新');
  expect(publish).toHaveBeenCalledWith('source', 4, 'target', 7);
  expect(screen.getByLabelText('源版本')).toHaveValue('4');
  expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
});
it('allows previewing but prevents read-only writes and handles Escape', async () => {
  const close = mountDialog(gateways(), []);
  await screen.findByRole('heading', { name: '源版本完整配置' });
  expect(screen.getByRole('button', { name: '确认复制' })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  expect(close).toHaveBeenCalledOnce();
});

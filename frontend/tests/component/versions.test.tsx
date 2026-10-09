import { chooseOption } from '../support/choose-option';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { Versions } from '../../src/contexts/flags/presentation/versions';
import type {
  Flag,
  Flags,
} from '../../src/contexts/flags/application/contracts';
import { ApiError } from '../../src/shared-kernel/errors';
const current: Flag = {
  id: 'id',
  name: 'Current',
  key: 'key',
  environment: 'development',
  revision: 3,
  seed: 'seed',
  enabled: true,
  default_value: false,
  rules: [],
  created_at: '2026-10-08T00:00:00Z',
  updated_at: '2026-10-08T00:00:00Z',
};
const source = { ...current, name: 'Original', revision: 1 };
const summary = {
  revision: 1,
  schema_version: 1,
  actor_id: 'actor',
  actor_name: 'Admin',
  created_at: '2026-10-08T00:00:00Z',
};
function gateways(): Flags {
  return {
    reorder: vi.fn(),
    copy: vi.fn(),
    publication: vi.fn(),
    publish: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    enabled: vi.fn(),
    saveRule: vi.fn(),
    deleteRule: vi.fn(),
    evaluate: vi.fn(),
    versions: vi.fn().mockResolvedValue({ items: [summary], total: 1 }),
    version: vi.fn().mockResolvedValue({ ...summary, snapshot: source }),
    preview: vi.fn().mockResolvedValue({
      current_revision: 3,
      source_revision: 1,
      source,
      changes: [
        { field: 'name', before_json: '"Current"', after_json: '"Original"' },
      ],
    }),
    rollback: vi.fn().mockRejectedValue(new ApiError('VERSION_CONFLICT')),
  };
}
function mount(flags: Flags, canWrite = true) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <Versions
        flag={current}
        flags={flags}
        canWrite={canWrite}
        onSaved={async () => {}}
      />
    </QueryClientProvider>,
  );
}
it('retains the selected version after a stale preview and prevents blind retries', async () => {
  const flags = gateways();
  const rollback = vi
    .fn<Flags['rollback']>()
    .mockRejectedValue(new ApiError('VERSION_CONFLICT'));
  flags.rollback = rollback;
  mount(flags);
  await chooseOption('选择版本', /^r1 ·/);
  await userEvent.click(
    await screen.findByRole('button', { name: '回滚到 r1' }),
  );
  await userEvent.click(screen.getByRole('button', { name: '确认回滚' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('已被更新');
  expect(screen.getByLabelText('选择版本')).toHaveTextContent(/^r1 ·/);
  expect(screen.getByRole('button', { name: '确认回滚' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '刷新差异' })).toBeEnabled();
  expect(rollback).toHaveBeenCalledWith('id', 1, 3);
});
it('allows viewing history but prevents read-only restore', async () => {
  mount(gateways(), false);
  await chooseOption('选择版本', /^r1 ·/);
  expect(
    await screen.findByRole('button', { name: '回滚到 r1' }),
  ).toBeDisabled();
});

it('shows the exact changed fields and new version before confirming rollback', async () => {
  mount(gateways());
  await chooseOption('选择版本', /^r1 ·/);
  await userEvent.click(
    await screen.findByRole('button', { name: '回滚到 r1' }),
  );
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(/将生成 r4/)).toBeVisible();
  expect(
    within(dialog).getByRole('heading', { name: '本次将修改' }),
  ).toBeVisible();
  expect(within(dialog).getByText('Current', { exact: true })).toBeVisible();
  expect(within(dialog).getByText('Original', { exact: true })).toBeVisible();
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { Workbench } from '../../src/presentation/app-shell/workbench';
import type { Flags } from '../../src/contexts/flags/application/contracts';
import { ApiError } from '../../src/shared-kernel/errors';
const flags: Flags = {
  reorder: vi.fn(),
  copy: vi.fn(),
  publication: vi.fn(),
  publish: vi.fn(),
  list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  get: vi.fn(),
  versions: vi.fn(),
  version: vi.fn(),
  preview: vi.fn(),
  rollback: vi.fn(),
  create: vi.fn(),
  edit: vi.fn(),
  enabled: vi.fn(),
  saveRule: vi.fn(),
  deleteRule: vi.fn(),
  evaluate: vi.fn(),
};
it('opens a read-only workspace after login and clears it after logout', async () => {
  const identity = {
    session: vi.fn().mockRejectedValue(new ApiError('UNAUTHENTICATED')),
    login: vi.fn().mockResolvedValue({
      user: {
        id: 'v',
        username: 'viewer',
        display_name: 'Viewer',
        role: 'viewer',
      },
      write_environments: [],
      csrf_token: 'x'.repeat(64),
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/flags']}>
        <Workbench
          identity={identity}
          flags={flags}
          audit={{ history: vi.fn() }}
          checkReadiness={() => Promise.resolve({ status: 'ready' })}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: '登录工作空间' });
  await userEvent.type(screen.getByLabelText('账号'), 'viewer');
  await userEvent.type(screen.getByLabelText('密码'), 'password');
  await userEvent.click(screen.getByRole('button', { name: /^登录$/ }));
  expect(
    await screen.findByRole('heading', { name: '功能配置' }),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: '新建 Flag' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: '切换为深色主题' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByRole('button', { name: '切换为浅色主题' })).toBeVisible();
  expect(screen.getByText(/当前环境为只读/)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: '退出' }));
  expect(
    await screen.findByRole('heading', { name: '登录工作空间' }),
  ).toBeVisible();
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}
function mountEditor(gateway: Flags, path = '/flags?environment=development') {
  const identity = {
    session: vi.fn().mockResolvedValue({
      user: {
        id: 'e',
        username: 'editor',
        display_name: 'Editor',
        role: 'editor',
      },
      write_environments: ['development', 'staging'],
      csrf_token: 'x'.repeat(64),
    }),
    login: vi.fn(),
    logout: vi.fn(),
  };
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Workbench
          identity={identity}
          flags={gateway}
          audit={{ history: vi.fn() }}
          checkReadiness={() => Promise.resolve({ status: 'ready' })}
        />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it('creates in a named dialog, retains rejected input and returns focus after dismissal', async () => {
  const create = vi
    .fn<Flags['create']>()
    .mockRejectedValue(new ApiError('KEY_CONFLICT'));
  mountEditor({ ...flags, create });
  const trigger = await screen.findByRole('button', { name: '新建 Flag' });
  await userEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: '新建 Flag' });
  await userEvent.type(within(dialog).getByLabelText('名称'), 'Acceptance');
  await userEvent.type(within(dialog).getByLabelText('Key'), 'acceptance');
  await userEvent.click(
    within(dialog).getByRole('button', { name: '保存配置' }),
  );
  expect(await within(dialog).findByRole('alert')).toBeVisible();
  expect(within(dialog).getByLabelText('名称')).toHaveValue('Acceptance');
  expect(create).toHaveBeenCalledWith({
    name: 'Acceptance',
    key: 'acceptance',
    environment: 'development',
    enabled: true,
    default_value: false,
  });
  await userEvent.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
});
it('navigates detail tabs by keyboard and writes the selected tab into the URL', async () => {
  mountEditor(
    {
      ...flags,
      get: vi.fn().mockResolvedValue({
        id: 'id',
        name: 'Keyboard flag',
        key: 'keyboard',
        environment: 'development',
        revision: 1,
        enabled: true,
        default_value: false,
        seed: 'seed',
        rules: [],
        created_at: '2026-10-08T00:00:00Z',
        updated_at: '2026-10-08T00:00:00Z',
      }),
    },
    '/flags/id?environment=development',
  );
  const rules = await screen.findByRole('tab', { name: '规则' });
  expect(rules).toHaveAttribute('aria-selected', 'true');
  rules.focus();
  await userEvent.keyboard('{Home}');
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: '基本信息' })).toHaveAttribute(
      'aria-selected',
      'true',
    ),
  );
  expect(screen.getByTestId('location')).toHaveTextContent('tab=basic');
  expect(screen.getByRole('tabpanel', { name: '基本信息' })).toContainElement(
    screen.getByRole('button', { name: '编辑基本信息' }),
  );
});
it('keeps an in-flight save open and allows dismissal after its error', async () => {
  let reject!: (reason: unknown) => void;
  const request = new Promise<Awaited<ReturnType<Flags['create']>>>(
    (_resolve, rejectRequest) => {
      reject = rejectRequest;
    },
  );
  const create = vi.fn<Flags['create']>().mockReturnValue(request);
  mountEditor({ ...flags, create });
  await userEvent.click(
    await screen.findByRole('button', { name: '新建 Flag' }),
  );
  const dialog = screen.getByRole('dialog', { name: '新建 Flag' });
  await userEvent.type(within(dialog).getByLabelText('名称'), 'Pending');
  await userEvent.type(within(dialog).getByLabelText('Key'), 'pending');
  await userEvent.click(
    within(dialog).getByRole('button', { name: '保存配置' }),
  );
  expect(create).toHaveBeenCalledOnce();
  expect(
    within(dialog).getByRole('button', { name: '保存中…' }),
  ).toBeDisabled();
  expect(
    within(dialog).getByRole('button', { name: '关闭新建 Flag' }),
  ).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: /^取消$/ })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  expect(dialog).toBeVisible();
  reject(new ApiError('KEY_CONFLICT'));
  expect(await within(dialog).findByRole('alert')).toBeVisible();
  expect(within(dialog).getByLabelText('名称')).toHaveValue('Pending');
  await userEvent.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

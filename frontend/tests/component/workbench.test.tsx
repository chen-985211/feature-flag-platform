import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { Workbench } from '../../src/presentation/app-shell/workbench';
import type { Flags } from '../../src/contexts/flags/application/contracts';
import { ApiError } from '../../src/shared-kernel/errors';
const flags: Flags = {
  list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  get: vi.fn(),
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

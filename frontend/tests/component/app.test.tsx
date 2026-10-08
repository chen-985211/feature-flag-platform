import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/presentation/app-shell/app';
import type {
  CheckReadiness,
  Readiness,
} from '../../src/platform/health/application/check-readiness';
function mount(checkReadiness: CheckReadiness) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App checkReadiness={checkReadiness} />
    </QueryClientProvider>,
  );
}
describe('runtime connection screen', () => {
  it('shows loading while waiting and then the actual ready result', async () => {
    let finish!: (result: Readiness) => void;
    mount(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('检查中');
    finish({ status: 'ready' });
    expect(await screen.findByText('服务已就绪')).toBeVisible();
  });
  it('shows a dependency failure and allows a fresh request', async () => {
    const check = vi
      .fn<CheckReadiness>()
      .mockResolvedValueOnce({ status: 'unavailable', requestId: 'r-503' })
      .mockResolvedValueOnce({ status: 'ready' });
    mount(check);
    expect(await screen.findByText('服务暂不可用')).toBeVisible();
    expect(screen.getByText('r-503')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '刷新状态' }));
    expect(await screen.findByText('服务已就绪')).toBeVisible();
    expect(check).toHaveBeenCalledTimes(2);
  });
  it('shows safe connection feedback without dependency details', async () => {
    mount(() => Promise.reject(new Error('secret=do-not-display')));
    expect(await screen.findByText('无法连接服务')).toBeVisible();
    expect(screen.queryByText(/do-not-display/)).not.toBeInTheDocument();
  });
  it('does not show an old request ID after refresh loses the connection', async () => {
    const check = vi
      .fn<CheckReadiness>()
      .mockResolvedValueOnce({
        status: 'unavailable',
        requestId: 'old-request',
      })
      .mockRejectedValueOnce(new Error('connection lost'));
    mount(check);
    expect(await screen.findByText('old-request')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '刷新状态' }));
    expect(await screen.findByText('无法连接服务')).toBeVisible();
    expect(screen.queryByText('old-request')).not.toBeInTheDocument();
  });
  it('switches the theme accessibly', async () => {
    mount(() => Promise.resolve({ status: 'ready' }));
    await screen.findByText('服务已就绪');
    await userEvent.click(
      screen.getByRole('button', { name: '切换为深色主题' }),
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(
      screen.getByRole('button', { name: '切换为浅色主题' }),
    ).toBeVisible();
  });
});

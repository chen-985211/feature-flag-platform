import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { FlagForm } from '../../src/contexts/flags/presentation/flag-form';
import { ApiError } from '../../src/shared-kernel/errors';
it('retains local input after a version conflict and offers the latest version', async () => {
  const save = vi.fn().mockRejectedValue(new ApiError('VERSION_CONFLICT'));
  const reload = vi.fn();
  render(
    <FlagForm
      environment="development"
      save={save}
      cancel={() => {}}
      reload={reload}
    />,
  );
  await userEvent.type(screen.getByLabelText('名称'), 'Checkout');
  await userEvent.type(screen.getByLabelText('Key'), 'checkout');
  await userEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('本地输入已保留');
  expect(screen.getByLabelText('名称')).toHaveValue('Checkout');
  await userEvent.click(screen.getByRole('button', { name: '加载最新版本' }));
  expect(reload).toHaveBeenCalledOnce();
});

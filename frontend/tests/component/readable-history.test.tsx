import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { History } from '../../src/contexts/audit/presentation/history';
import { RuleCondition } from '../../src/contexts/flags/presentation/rule-condition';
import type { AuditEntry } from '../../src/contexts/audit/application/contracts';

const rule = {
  ID: 'old-rule',
  Priority: 1,
  Attribute: 'tier',
  Operator: 'equals',
  ExpectedJSON: '"blocked"',
  Result: false,
};
const before = {
  ID: 'flag',
  Name: 'Checkout',
  Key: 'checkout',
  Environment: 'development',
  Enabled: true,
  DefaultValue: false,
  Seed: 'seed',
  Revision: 2,
  Rules: [rule],
};
const after = {
  ...before,
  Revision: 3,
  UpdatedAt: '2026-10-09T00:00:00Z',
  Rules: [
    rule,
    {
      ID: 'new-rule',
      Priority: 2,
      Attribute: 'country',
      Operator: 'in',
      ExpectedJSON: '["CN","SG"]',
      Result: true,
    },
  ],
};
const entry: AuditEntry = {
  id: 'entry',
  flag_id: 'flag',
  environment: 'development',
  key: 'checkout',
  revision: 3,
  actor_name: 'Admin',
  action: 'rule_created',
  created_at: '2026-10-09T00:00:00Z',
  request_id: 'request',
  changes_json: JSON.stringify({ before, after }),
};
function mount(value = entry) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <History
        id="flag"
        audit={{
          history: vi.fn().mockResolvedValue({ items: [value], total: 1 }),
        }}
      />
    </QueryClientProvider>,
  );
}

it('summarizes the added rule by default and discloses only the changed business facts', async () => {
  mount();
  expect(await screen.findByText(/新增规则：优先级 2/)).toHaveTextContent(
    'country 属于任一值 ["CN","SG"] → 开启（true）',
  );
  expect(screen.getByText('r2 → r3')).toBeVisible();
  expect(screen.queryByText(entry.changes_json)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '查看变更详情' }));
  const details = screen.getByRole('region', { name: '变更前后对比' });
  expect(details).toHaveTextContent('新增规则');
  expect(details).toHaveTextContent('未配置');
  expect(details).not.toHaveTextContent('blocked');
  expect(details).not.toHaveTextContent('UpdatedAt');
  expect(details).not.toHaveTextContent('seed');
});

it('copies the complete original audit text and reports clipboard failures without losing it', async () => {
  const user = userEvent.setup();
  const write = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockRejectedValueOnce(new Error('denied'))
    .mockResolvedValueOnce();
  mount();
  await user.click(await screen.findByRole('button', { name: '查看变更详情' }));
  await user.click(screen.getByRole('button', { name: '查看原始数据' }));
  const raw = screen.getByRole('region', { name: '原始审计数据' });
  expect(raw.querySelector('pre')?.textContent).toContain('\n');
  await user.click(within(raw).getByRole('button', { name: '复制原始数据' }));
  expect(await within(raw).findByRole('alert')).toHaveTextContent('复制失败');
  await user.click(within(raw).getByRole('button', { name: '复制原始数据' }));
  expect(await within(raw).findByRole('status')).toHaveTextContent('已复制');
  expect(write).toHaveBeenLastCalledWith(entry.changes_json);
  write.mockRestore();
});

it('preserves an unfamiliar audit payload through a clearly marked fallback', async () => {
  mount({ ...entry, changes_json: '{"future":{"expected":9007199254740993}}' });
  expect(await screen.findByText(/此记录暂无法生成变更摘要/)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: '查看变更详情' }));
  await userEvent.click(screen.getByRole('button', { name: '查看原始数据' }));
  expect(
    screen.getByRole('region', { name: '原始审计数据' }),
  ).toHaveTextContent('9007199254740993');
});

it('describes operators in readable language while retaining exact expected number text', () => {
  render(
    <RuleCondition
      rule={{
        id: 'r',
        kind: 'attribute',
        priority: 1,
        attribute: 'account_number',
        operator: 'in',
        expected_json: '[9007199254740993,9007199254740995]',
        result: false,
      }}
    />,
  );
  expect(screen.getByText('属于任一值')).toBeVisible();
  expect(screen.getByText('[9007199254740993,9007199254740995]')).toBeVisible();
});

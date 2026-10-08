import { chooseOption } from '../support/choose-option';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import { RuleForm } from '../../src/contexts/flags/presentation/rule-form';
import { EvaluationConsole } from '../../src/contexts/flags/presentation/evaluation';
import type { Flags } from '../../src/contexts/flags/application/contracts';
import { ApiError } from '../../src/shared-kernel/errors';
it('rejects a heterogeneous in array before saving and keeps its input', async () => {
  const save = vi.fn();
  render(
    <RuleForm
      revision={3}
      nextPriority={1}
      save={save}
      cancel={() => {}}
      reload={() => {}}
    />,
  );
  await userEvent.type(screen.getByLabelText('属性名称'), 'country');
  await chooseOption('操作符', 'in · 属于');
  await userEvent.clear(screen.getByLabelText('期望值 JSON'));
  await userEvent.type(screen.getByLabelText('期望值 JSON'), '[[1,"cn"]');
  await userEvent.click(screen.getByRole('button', { name: '保存规则' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('不合法');
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText('期望值 JSON')).toHaveValue('[1,"cn"]');
});
it('retains the rule after a rejected write', async () => {
  const save = vi.fn().mockRejectedValue(new ApiError('PRIORITY_CONFLICT'));
  render(
    <RuleForm
      revision={3}
      nextPriority={1}
      save={save}
      cancel={() => {}}
      reload={() => {}}
    />,
  );
  await userEvent.type(screen.getByLabelText('属性名称'), 'country');
  await userEvent.click(screen.getByRole('button', { name: '保存规则' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('优先级');
  expect(screen.getByLabelText('属性名称')).toHaveValue('country');
  expect(screen.getByRole('button', { name: '保存规则' })).toBeEnabled();
});
it('rejects non-object evaluation input and renders authoritative false hits', async () => {
  const evaluate = vi.fn<Flags['evaluate']>().mockResolvedValue({
    value: false,
    revision: 4,
    source: 'attribute_rule',
    matched_rule_id: 'r',
    used_default: false,
    trace: [
      { rule_id: 'r', status: 'hit' },
      { rule_id: 'later', status: 'skipped' },
    ],
  });
  const flags: Flags = {
    evaluate,
    reorder: vi.fn(),
    copy: vi.fn(),
    publication: vi.fn(),
    publish: vi.fn(),
    list: vi.fn(),
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
  };
  render(
    <MemoryRouter>
      <EvaluationConsole flags={flags} environment="development" />
    </MemoryRouter>,
  );
  await userEvent.type(screen.getByLabelText('Flag Key'), 'checkout');
  await userEvent.clear(screen.getByLabelText('用户属性 JSON'));
  await userEvent.type(screen.getByLabelText('用户属性 JSON'), '[[]');
  await userEvent.click(screen.getByRole('button', { name: '运行评估' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('JSON 对象');
  expect(evaluate).not.toHaveBeenCalled();
  await userEvent.clear(screen.getByLabelText('用户属性 JSON'));
  await userEvent.type(
    screen.getByLabelText('用户属性 JSON'),
    '{{"tier":9007199254740993}',
  );
  await userEvent.click(screen.getByRole('button', { name: '运行评估' }));
  expect(await screen.findByRole('status')).toHaveTextContent('false');
  expect(screen.getByRole('status')).toHaveTextContent('revision 4');
  expect(screen.getByText('未计算')).toBeVisible();
  expect(evaluate).toHaveBeenCalledWith(
    'development',
    'checkout',
    '{"tier":9007199254740993}',
  );
});

it('edits percentage as decimal text and submits exact integer basis points', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <RuleForm
      revision={3}
      nextPriority={1}
      save={save}
      cancel={() => {}}
      reload={() => {}}
    />,
  );
  await chooseOption('规则类型', '百分比灰度');
  await userEvent.clear(screen.getByLabelText('用户比例 (%)'));
  await userEvent.type(screen.getByLabelText('用户比例 (%)'), '99.99');
  await userEvent.click(screen.getByRole('button', { name: '保存规则' }));
  expect(save).toHaveBeenCalledWith({
    kind: 'percentage',
    percentage_bp: 9999,
    priority: 1,
    result: true,
    expected_revision: 3,
  });
  expect(screen.queryByLabelText('期望值 JSON')).not.toBeInTheDocument();
});

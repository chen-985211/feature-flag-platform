import { useState } from 'react';
import type { Rule, RuleInput } from '../application/contracts';
import { validExpected } from '../domain/editing';
import { ApiError, feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
export function RuleForm({
  initial,
  revision,
  nextPriority,
  save,
  cancel,
  reload,
}: {
  initial?: Rule;
  revision: number;
  nextPriority: number;
  save: (input: RuleInput) => Promise<void>;
  cancel: () => void;
  reload: () => void;
}) {
  const [attribute, setAttribute] = useState(initial?.attribute ?? '');
  const [operator, setOperator] = useState<'equals' | 'in'>(
    initial?.operator ?? 'equals',
  );
  const [expected, setExpected] = useState(initial?.expected_json ?? '"cn"');
  const [priority, setPriority] = useState(initial?.priority ?? nextPriority);
  const [result, setResult] = useState(initial?.result ?? true);
  const [baseRevision] = useState(revision);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!validExpected(expected, operator)) {
      setError(new ApiError('INVALID_INPUT'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await save({
        attribute,
        operator,
        expectedJSON: expected,
        priority,
        result,
        expected_revision: baseRevision,
      });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="panel form-grid"
      aria-label={initial ? '编辑规则' : '添加规则'}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2>{initial ? '编辑规则' : '添加属性规则'}</h2>
      <label>
        属性名称
        <input
          required
          maxLength={128}
          value={attribute}
          onChange={(e) => setAttribute(e.target.value)}
          disabled={busy}
          autoFocus
        />
      </label>
      <label>
        操作符
        <select
          value={operator}
          onChange={(e) =>
            setOperator(e.target.value === 'in' ? 'in' : 'equals')
          }
          disabled={busy}
        >
          <option value="equals">equals · 等于</option>
          <option value="in">in · 属于</option>
        </select>
      </label>
      <label htmlFor="rule-expected">期望值 JSON</label>
      <textarea
        id="rule-expected"
        required
        value={expected}
        onChange={(e) => setExpected(e.target.value)}
        disabled={busy}
        spellCheck={false}
      />
      <p className="muted">
        equals 使用字符串、数字或布尔值；in 使用非空、同类型数组。
      </p>
      <label>
        优先级
        <input
          type="number"
          min={1}
          max={2147483647}
          step={1}
          required
          value={priority}
          onChange={(e) => setPriority(e.target.valueAsNumber)}
          disabled={busy}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={result}
          onChange={(e) => setResult(e.target.checked)}
          disabled={busy}
        />
        命中返回 true
      </label>
      <p className="muted">
        数字越小越先执行。首条命中即结束，包括返回 false。
      </p>
      {error !== undefined && (
        <p role="alert" className="error-message">
          {feedback(error)}
        </p>
      )}
      {error instanceof ApiError && error.code === 'VERSION_CONFLICT' && (
        <Button type="button" variant="outline" onClick={reload}>
          加载最新版本
        </Button>
      )}
      <div className="actions">
        <Button type="submit" disabled={busy}>
          {busy ? '保存中…' : '保存规则'}
        </Button>
        <Button type="button" variant="ghost" onClick={cancel} disabled={busy}>
          取消
        </Button>
      </div>
    </form>
  );
}

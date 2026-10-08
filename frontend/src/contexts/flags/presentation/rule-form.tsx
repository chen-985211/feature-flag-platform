import { Notice } from '../../../presentation/components/notice';
import { Card } from '../../../presentation/components/ui/card';
import { Checkbox } from '../../../presentation/components/ui/checkbox';
import { Label } from '../../../presentation/components/ui/label';
import {
  Dropdown,
  DropdownOption,
} from '../../../presentation/components/dropdown';
import { Textarea } from '../../../presentation/components/ui/textarea';
import { Input } from '../../../presentation/components/ui/input';
import { useState, useId } from 'react';
import type { Rule, RuleInput } from '../application/contracts';
import { validExpected } from '../domain/editing';
import { parsePercentage, formatPercentage } from '../domain/percentage';
import { ApiError, feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
export function RuleForm({
  initial,
  revision,
  nextPriority,
  save,
  cancel,
  reload,
  embedded = false,
  onBusyChange,
}: {
  initial?: Rule;
  revision: number;
  nextPriority: number;
  save: (input: RuleInput) => Promise<void>;
  cancel: () => void;
  reload: () => void;
  embedded?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const initialAttribute = initial?.kind === 'attribute' ? initial : undefined;
  const fieldID = useId();
  const [kind, setKind] = useState<'attribute' | 'percentage'>(
    initial?.kind ?? 'attribute',
  );
  const [percentage, setPercentage] = useState(
    initial?.kind === 'percentage'
      ? formatPercentage(initial.percentage_bp)
      : '20',
  );
  const [attribute, setAttribute] = useState(initialAttribute?.attribute ?? '');
  const [operator, setOperator] = useState<'equals' | 'in'>(
    initialAttribute?.operator ?? 'equals',
  );
  const [expected, setExpected] = useState(
    initialAttribute?.expected_json ?? '"cn"',
  );
  const [priority, setPriority] = useState(initial?.priority ?? nextPriority);
  const [result, setResult] = useState(initial?.result ?? true);
  const [baseRevision] = useState(revision);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (
      (kind === 'attribute' && !validExpected(expected, operator)) ||
      (kind === 'percentage' && parsePercentage(percentage) === null)
    ) {
      setError(new ApiError('INVALID_INPUT'));
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError(undefined);
    try {
      await save(
        kind === 'percentage'
          ? {
              kind,
              percentage_bp: parsePercentage(percentage) ?? 0,
              priority,
              result,
              expected_revision: baseRevision,
            }
          : {
              attribute,
              operator,
              expectedJSON: expected,
              priority,
              result,
              expected_revision: baseRevision,
            },
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <Card asChild className={embedded ? 'form-surface' : undefined}>
      <form
        className={embedded ? 'form-grid' : 'panel form-grid'}
        aria-label={initial ? '编辑规则' : '添加规则'}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {!embedded && <h2>{initial ? '编辑规则' : '添加规则'}</h2>}
        <div className="field">
          <Label htmlFor="rule-kind">规则类型</Label>
          <Dropdown
            id="rule-kind"
            value={kind}
            disabled={busy}
            onValueChange={(nextValue) =>
              setKind(nextValue === 'percentage' ? 'percentage' : 'attribute')
            }
          >
            <DropdownOption value="attribute">
              属性规则 · equals / in
            </DropdownOption>
            <DropdownOption value="percentage">百分比灰度</DropdownOption>
          </Dropdown>
        </div>
        {kind === 'percentage' ? (
          <>
            <div className="field">
              <Label className="field">
                用户比例 (%)
                <Input
                  inputMode="decimal"
                  required
                  value={percentage}
                  disabled={busy}
                  onChange={(e) => setPercentage(e.target.value)}
                />
              </Label>
              <p className="muted">
                0～100，最多两位小数。使用非空字符串 user_id
                稳定分组；调整比例保持原有分桶。
              </p>
            </div>
          </>
        ) : (
          <>
            <Label>
              属性名称
              <Input
                required
                maxLength={128}
                value={attribute}
                onChange={(e) => setAttribute(e.target.value)}
                disabled={busy}
                autoFocus
              />
            </Label>
            <div className="field">
              <Label htmlFor="rule-operator">操作符</Label>
              <Dropdown
                id="rule-operator"
                value={operator}
                onValueChange={(nextValue) =>
                  setOperator(nextValue === 'in' ? 'in' : 'equals')
                }
                disabled={busy}
              >
                <DropdownOption value="equals">equals · 等于</DropdownOption>
                <DropdownOption value="in">in · 属于</DropdownOption>
              </Dropdown>
            </div>
            <div className="field">
              <Label htmlFor="rule-expected">期望值 JSON</Label>
              <Textarea
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
            </div>
          </>
        )}
        <Label>
          优先级
          <Input
            type="number"
            min={1}
            max={2147483647}
            step={1}
            required
            value={priority}
            onChange={(e) => setPriority(e.target.valueAsNumber)}
            disabled={busy}
          />
        </Label>
        <Label className="check-label" htmlFor={fieldID + '-1'}>
          <Checkbox
            id={fieldID + '-1'}
            checked={result}
            onCheckedChange={(checked) => setResult(checked === true)}
            disabled={busy}
          />
          命中返回 true
        </Label>
        <p className="muted">
          数字越小越先执行。首条命中即结束，包括返回 false。
        </p>
        {error !== undefined && (
          <Notice role="alert" className="error-message" tone="error">
            {feedback(error)}
          </Notice>
        )}
        {error instanceof ApiError && error.code === 'VERSION_CONFLICT' && (
          <Button type="button" variant="outline" onClick={reload}>
            加载最新版本
          </Button>
        )}
        <div className="actions">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? '保存中…' : '保存规则'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={cancel}
            disabled={busy}
          >
            取消
          </Button>
        </div>
      </form>
    </Card>
  );
}

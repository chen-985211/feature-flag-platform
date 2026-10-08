import { PageHeader } from '../../../presentation/components/page-header';
import { Notice } from '../../../presentation/components/notice';
import { Card } from '../../../presentation/components/ui/card';
import { Label } from '../../../presentation/components/ui/label';
import { Textarea } from '../../../presentation/components/ui/textarea';
import { Input } from '../../../presentation/components/ui/input';
import { Badge } from '../../../presentation/components/ui/badge';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Environment, Evaluation, Flags } from '../application/contracts';
import { ApiError, feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
const sourceNames = {
  disabled: '配置已停用',
  attribute_rule: '属性规则命中',
  percentage_rule: '百分比规则命中',
  default: '默认值',
};
const statusNames = {
  hit: '命中',
  miss: '未命中',
  missing: '缺少属性或 user_id',
  invalid_identifier: 'user_id 必须为非空字符串',
  skipped: '未计算',
};
export function EvaluationConsole({
  flags,
  environment,
}: {
  flags: Flags;
  environment: Environment;
}) {
  const [search] = useSearchParams();
  const [key, setKey] = useState(search.get('key') ?? '');
  const [attrs, setAttrs] = useState('{\n  "country": "cn"\n}');
  const [result, setResult] = useState<Evaluation>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const value: unknown = JSON.parse(attrs);
      if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new ApiError('INVALID_USER_ATTRIBUTES');
      setResult(await flags.evaluate(environment, key, attrs));
    } catch (e) {
      setError(
        e instanceof SyntaxError ? new ApiError('INVALID_USER_ATTRIBUTES') : e,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="评估控制台"
        description="用当前配置和用户属性检查实际返回结果。"
      ></PageHeader>
      <div className="evaluation-grid">
        <Card asChild>
          <form
            className="panel form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h2>评估输入</h2>
            <Label>
              Flag Key
              <Input
                required
                maxLength={128}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={busy}
              />
            </Label>
            <div className="field">
              <Label htmlFor="evaluation-attributes">用户属性 JSON</Label>
              <Textarea
                id="evaluation-attributes"
                className="attributes-input"
                required
                value={attrs}
                onChange={(e) => setAttrs(e.target.value)}
                spellCheck={false}
                disabled={busy}
              />
              <p className="muted">
                输入顶层 JSON 对象。属性名称与类型须与规则一致。
              </p>
            </div>
            {error !== undefined && (
              <Notice className="error-message" role="alert" tone="error">
                {feedback(error)}
              </Notice>
            )}
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? '评估中…' : '运行评估'}
            </Button>
          </form>
        </Card>
        <Card asChild>
          <section className="panel" aria-labelledby="evaluation-result">
            <h2 id="evaluation-result">评估结果</h2>
            {!result ? (
              <p className="empty-state">
                {busy ? '正在读取当前配置…' : '运行评估后将在这里显示结果。'}
              </p>
            ) : (
              <>
                <div
                  role="status"
                  className={
                    'result-value ' + (result.value ? 'good' : 'neutral')
                  }
                >
                  <strong>{String(result.value)}</strong>
                  <span>
                    {sourceNames[result.source]} · revision {result.revision}
                  </span>
                </div>
                <dl className="facts">
                  <dt>使用默认值</dt>
                  <dd>{result.used_default ? '是' : '否'}</dd>
                  <dt>命中规则</dt>
                  <dd>
                    <code>{result.matched_rule_id ?? '无'}</code>
                  </dd>
                </dl>
                <h3>判断轨迹</h3>
                {result.trace.length === 0 ? (
                  <p className="muted">当前配置没有规则。</p>
                ) : (
                  <ol className="trace-list">
                    {result.trace.map((step, index) => (
                      <li key={step.rule_id}>
                        <span className="priority">{index + 1}</span>
                        <div className="trace-copy">
                          <span>规则 {index + 1}</span>
                          <code title={step.rule_id}>{step.rule_id}</code>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            'trace-status ' +
                            (step.status === 'hit' ? 'good' : 'neutral')
                          }
                        >
                          {statusNames[step.status]}
                        </Badge>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </section>
        </Card>
      </div>
    </>
  );
}

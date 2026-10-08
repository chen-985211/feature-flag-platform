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
      <div className="page-heading">
        <div>
          <p className="eyebrow">工作空间 / {environment}</p>
          <h1>评估控制台</h1>
          <p className="page-description">
            用当前配置和用户属性检查实际返回结果。
          </p>
        </div>
      </div>
      <div className="evaluation-grid">
        <form
          className="panel form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h2>评估输入</h2>
          <label>
            Flag Key
            <input
              required
              maxLength={128}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={busy}
            />
          </label>
          <label htmlFor="evaluation-attributes">用户属性 JSON</label>
          <textarea
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
          {error !== undefined && (
            <p className="error-message" role="alert">
              {feedback(error)}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? '评估中…' : '运行评估'}
          </Button>
        </form>
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
                      <span>{index + 1}</span>
                      <code>{step.rule_id}</code>
                      <strong>{statusNames[step.status]}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

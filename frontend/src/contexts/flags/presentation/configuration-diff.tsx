import type { Rule, VersionPreview } from '../application/contracts';
import { RuleCondition } from './rule-condition';
const fields: Record<string, string> = {
  name: '名称',
  key: 'Key',
  enabled: '启用状态',
  default_value: '默认结果',
  seed: '灰度 seed',
  rules: '规则及顺序',
};
function Value({ field, raw }: { field: string; raw: string }) {
  const value: unknown = JSON.parse(raw);
  if (field === 'rules' && Array.isArray(value)) {
    if (value.length === 0) return <span className="muted">无规则</span>;
    return (
      <ol className="diff-rules">
        {(value as Rule[]).map((rule) => (
          <li key={rule.id}>
            <span>优先级 {rule.priority} · </span>
            <RuleCondition rule={rule} />
            <p>返回 {String(rule.result)}</p>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <code className="diff-scalar">
      {typeof value === 'string' ? value : raw}
    </code>
  );
}
export function ConfigurationDiff({
  changes,
}: {
  changes: VersionPreview['changes'];
}) {
  if (changes.length === 0) return <p className="muted">配置内容一致。</p>;
  return (
    <div className="diff-list">
      {changes.map((c) => (
        <section key={c.field} className="diff-row">
          <h4>{fields[c.field]}</h4>
          <div className="diff-columns">
            <div>
              <small>当前配置</small>
              <Value field={c.field} raw={c.before_json} />
            </div>
            <div>
              <small>应用后配置</small>
              <Value field={c.field} raw={c.after_json} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

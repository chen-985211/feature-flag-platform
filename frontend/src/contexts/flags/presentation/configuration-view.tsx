import type { Flag } from '../application/contracts';
import { RuleCondition } from './rule-condition';
export function ConfigurationView({
  flag,
  heading = '选中版本的完整配置',
}: {
  flag: Flag;
  heading?: string;
}) {
  return (
    <section className="panel">
      <h3>{heading}</h3>
      <dl className="facts">
        <dt>名称</dt>
        <dd>{flag.name}</dd>
        <dt>Key / 环境</dt>
        <dd>
          <code>{flag.key}</code> / {flag.environment}
        </dd>
        <dt>启用状态</dt>
        <dd>{flag.enabled ? '已启用' : '已停用'}</dd>
        <dt>默认结果</dt>
        <dd>
          <code>{String(flag.default_value)}</code>
        </dd>
        <dt>灰度 seed</dt>
        <dd>
          <code>{flag.seed}</code>
        </dd>
      </dl>
      <h3 className="subsection-title">规则顺序与条件</h3>
      {flag.rules.length === 0 ? (
        <p className="muted">此版本没有规则。</p>
      ) : (
        <ol className="rule-list">
          {flag.rules.map((rule) => (
            <li key={rule.id}>
              <div className="rule-description">
                <span className="priority">{rule.priority}</span>
                <div>
                  <RuleCondition rule={rule} />
                  <p className="muted">
                    命中返回 <strong>{String(rule.result)}</strong>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

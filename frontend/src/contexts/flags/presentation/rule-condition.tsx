import type { Rule } from '../application/contracts';
import { formatPercentage } from '../domain/percentage';
export function RuleCondition({ rule }: { rule: Rule }) {
  return rule.kind === 'percentage' ? (
    <>
      <strong>百分比灰度</strong>{' '}
      <code>{formatPercentage(rule.percentage_bp)}%</code>{' '}
      <span className="muted">按 user_id</span>
    </>
  ) : (
    <>
      <strong>{rule.attribute}</strong> <code>{rule.operator}</code>{' '}
      <code className="expected-value">{rule.expected_json}</code>
    </>
  );
}

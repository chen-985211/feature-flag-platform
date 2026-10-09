import type { Rule } from '../application/contracts';
import {
  operatorLabel,
  percentageLabel,
} from '../../../presentation/components/configuration-language';
export function RuleCondition({ rule }: { rule: Rule }) {
  return (
    <span className="rule-condition">
      {rule.kind === 'percentage' ? (
        <>
          <strong>百分比灰度</strong>
          <code className="rule-percentage">
            {percentageLabel(rule.percentage_bp)}
          </code>
          <span className="muted">按 user_id</span>
        </>
      ) : (
        <>
          <strong>{rule.attribute}</strong>
          <span className="rule-operator">{operatorLabel(rule.operator)}</span>
          <code className="expected-value">{rule.expected_json}</code>
        </>
      )}
    </span>
  );
}

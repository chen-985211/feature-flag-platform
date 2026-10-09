export type DisplayRule = {
  priority: number;
  result: boolean;
} & (
  | {
      kind: 'attribute';
      attribute: string;
      operator: 'equals' | 'in';
      expected_json: string;
    }
  | { kind: 'percentage'; percentage_bp: number }
);

export function resultLabel(value: boolean) {
  return value ? '开启（true）' : '关闭（false）';
}
export function percentageLabel(bp: number) {
  return String(bp / 100) + '%';
}
export function operatorLabel(operator: 'equals' | 'in') {
  return operator === 'equals' ? '等于' : '属于任一值';
}
export function ruleDescription(rule: DisplayRule) {
  const condition =
    rule.kind === 'percentage'
      ? `按 user_id 灰度 ${percentageLabel(rule.percentage_bp)}`
      : `${rule.attribute} ${operatorLabel(rule.operator)} ${rule.expected_json}`;
  return `优先级 ${String(rule.priority)} · ${condition} → ${resultLabel(rule.result)}`;
}

// Add whitespace without reserializing values: JSON.parse/stringify would round
// large numbers and normalize exponent lexemes in diagnostic payloads.
export function formatJSON(raw: string) {
  try {
    JSON.parse(raw);
  } catch {
    return raw;
  }
  const tokens = raw.match(/"(?:\\.|[^"\\])*"|[{}[\],:]|[^\s{}[\],:]+/g) ?? [];
  let depth = 0,
    output = '';
  const newline = () => '\n' + '  '.repeat(depth);
  tokens.forEach((token, index) => {
    if (token === '{' || token === '[') {
      output += token;
      depth++;
      if (tokens[index + 1] !== '}' && tokens[index + 1] !== ']')
        output += newline();
    } else if (token === '}' || token === ']') {
      depth--;
      if (tokens[index - 1] !== '{' && tokens[index - 1] !== '[')
        output += newline();
      output += token;
    } else if (token === ',') output += ',' + newline();
    else if (token === ':') output += ': ';
    else output += token;
  });
  return output;
}

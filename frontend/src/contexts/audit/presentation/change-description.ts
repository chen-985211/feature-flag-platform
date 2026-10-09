import {
  ruleDescription,
  resultLabel,
  type DisplayRule,
} from '../../../presentation/components/configuration-language';
import type { AuditEntry } from '../application/contracts';

interface ChangeRow {
  label: string;
  before: string;
  after: string;
}
interface Snapshot {
  Name: string;
  Key: string;
  Environment: string;
  Enabled: boolean;
  DefaultValue: boolean;
  Seed: string;
  Revision: number;
  Rules: (DisplayRule & { id: string })[];
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function integer(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
function readRule(value: unknown): (DisplayRule & { id: string }) | null {
  if (
    !record(value) ||
    typeof value.ID !== 'string' ||
    !integer(value.Priority) ||
    typeof value.Result !== 'boolean'
  )
    return null;
  const base = { id: value.ID, priority: value.Priority, result: value.Result };
  if (
    value.Kind === 'percentage' &&
    typeof value.PercentageBP === 'number' &&
    Number.isInteger(value.PercentageBP) &&
    value.PercentageBP >= 0 &&
    value.PercentageBP <= 10000
  )
    return { ...base, kind: 'percentage', percentage_bp: value.PercentageBP };
  if (
    (value.Kind === undefined ||
      value.Kind === '' ||
      value.Kind === 'attribute') &&
    typeof value.Attribute === 'string' &&
    ['equals', 'in'].includes(String(value.Operator)) &&
    typeof value.ExpectedJSON === 'string'
  ) {
    try {
      JSON.parse(value.ExpectedJSON);
    } catch {
      return null;
    }
    return {
      ...base,
      kind: 'attribute',
      attribute: value.Attribute,
      operator: value.Operator as 'equals' | 'in',
      expected_json: value.ExpectedJSON,
    };
  }
  return null;
}
function snapshot(value: unknown): Snapshot | null {
  if (
    !record(value) ||
    typeof value.Name !== 'string' ||
    typeof value.Key !== 'string' ||
    !['development', 'staging', 'production'].includes(
      String(value.Environment),
    ) ||
    typeof value.Enabled !== 'boolean' ||
    typeof value.DefaultValue !== 'boolean' ||
    typeof value.Seed !== 'string' ||
    !integer(value.Revision) ||
    !Array.isArray(value.Rules) ||
    (value.SchemaVersion !== undefined && value.SchemaVersion !== 1)
  )
    return null;
  const rules = value.Rules.map(readRule);
  if (rules.some((r) => r === null)) return null;
  if (
    new Set(rules.map((r) => r?.id)).size !== rules.length ||
    new Set(rules.map((r) => r?.priority)).size !== rules.length
  )
    return null;
  return {
    Name: value.Name,
    Key: value.Key,
    Environment: String(value.Environment),
    Enabled: value.Enabled,
    DefaultValue: value.DefaultValue,
    Seed: value.Seed,
    Revision: value.Revision,
    Rules: (rules as Snapshot['Rules']).sort((a, b) => a.priority - b.priority),
  };
}

export function describeChange(
  entry: AuditEntry,
): { summary: string; rows: ChangeRow[]; fromRevision?: number } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(entry.changes_json);
  } catch {
    return null;
  }
  if (!record(raw)) return null;
  const after = snapshot(raw.after);
  const before = raw.before === null ? null : snapshot(raw.before);
  if (
    !after ||
    after.Revision !== entry.revision ||
    (raw.before !== null && !before)
  )
    return null;
  const rows: ChangeRow[] = [];
  function add(label: string, oldValue: string | undefined, newValue: string) {
    if (oldValue !== newValue)
      rows.push({ label, before: oldValue ?? '未配置', after: newValue });
  }
  add('名称', before?.Name, after.Name);
  add('Key', before?.Key, after.Key);
  add(
    '启用状态',
    before ? (before.Enabled ? '已启用' : '已停用') : undefined,
    after.Enabled ? '已启用' : '已停用',
  );
  add(
    '默认结果',
    before ? resultLabel(before.DefaultValue) : undefined,
    resultLabel(after.DefaultValue),
  );
  if (before && before.Seed !== after.Seed)
    add(
      '灰度分组',
      '原分组依据',
      '已更换分组依据；相同 user_id 的灰度结果可能变化',
    );
  const byPriority = entry.action === 'flag_published';
  const identity = (r: Snapshot['Rules'][number]) =>
    byPriority ? String(r.priority) : r.id;
  const oldRules = new Map((before?.Rules ?? []).map((r) => [identity(r), r]));
  const newRules = new Map(after.Rules.map((r) => [identity(r), r]));
  for (const [id, rule] of newRules) {
    const oldRule = oldRules.get(id);
    add(
      oldRule ? '修改规则' : '新增规则',
      oldRule ? ruleDescription(oldRule) : undefined,
      ruleDescription(rule),
    );
  }
  for (const [id, rule] of oldRules)
    if (!newRules.has(id))
      rows.push({
        label: '删除规则',
        before: ruleDescription(rule),
        after: '已删除',
      });
  const ruleRows = rows.filter((r) => r.label.includes('规则'));
  let summary: string;
  switch (entry.action) {
    case 'flag_created':
      summary = `创建配置 ${after.Key}，${after.Enabled ? '已启用' : '已停用'}，默认 ${resultLabel(after.DefaultValue)}。`;
      break;
    case 'flag_edited':
      summary = rows.length
        ? rows.map((r) => `${r.label}：${r.before} → ${r.after}`).join('；')
        : '保存基本信息，业务内容未改变。';
      break;
    case 'flag_enabled':
      summary = `${after.Enabled ? '启用' : '停用'}配置。${after.Enabled ? '按当前规则评估，未命中使用默认值。' : '所有评估均返回 false。'}`;
      break;
    case 'rule_created':
    case 'rule_edited':
    case 'rule_deleted':
      summary = ruleRows.length
        ? `${ruleRows[0].label}：${entry.action === 'rule_deleted' ? ruleRows[0].before : ruleRows[0].after}`
        : '保存规则，规则内容未改变。';
      break;
    case 'rules_reordered':
      summary = `调整规则顺序：${after.Rules.slice(0, 3)
        .map(
          (r) =>
            `优先级 ${String(r.priority)} ${r.kind === 'attribute' ? r.attribute : '百分比灰度'}`,
        )
        .join(
          ' → ',
        )}${after.Rules.length > 3 ? ` 等 ${String(after.Rules.length)} 条规则` : ''}。`;
      break;
    case 'flag_rolled_back':
      if (!integer(raw.restored_revision)) return null;
      summary = `恢复 r${String(raw.restored_revision)} 的完整配置，生成 r${String(after.Revision)}，旧版本和历史保留。`;
      break;
    case 'flag_copied':
    case 'flag_published': {
      const source = raw.source;
      if (
        !record(source) ||
        !['development', 'staging', 'production'].includes(
          String(source.environment),
        ) ||
        !integer(source.revision)
      )
        return null;
      summary = `${entry.action === 'flag_copied' ? '复制' : '发布'} ${String(source.environment)} 的 r${String(source.revision)} 到 ${after.Environment} / ${after.Key}，${entry.action === 'flag_copied' ? '创建' : '生成'} r${String(after.Revision)}。`;
      break;
    }
    default:
      return null;
  }
  return { summary, rows, fromRevision: before?.Revision };
}

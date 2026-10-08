export type Environment = 'development' | 'staging' | 'production';
interface RuleBase {
  id: string;
  priority: number;
  result: boolean;
}
interface AttributeRule extends RuleBase {
  kind: 'attribute';
  attribute: string;
  operator: 'equals' | 'in';
  expected_json: string;
}
interface PercentageRule extends RuleBase {
  kind: 'percentage';
  percentage_bp: number;
}
export type Rule = AttributeRule | PercentageRule;
export interface Flag {
  id: string;
  name: string;
  key: string;
  environment: Environment;
  enabled: boolean;
  default_value: boolean;
  seed: string;
  revision: number;
  rules: Rule[];
  created_at: string;
  updated_at: string;
}
export interface Page {
  items: Flag[];
  total: number;
}
export interface CreateFlag {
  name: string;
  key: string;
  environment: Environment;
  enabled: boolean;
  default_value: boolean;
}
export interface EditFlag {
  name: string;
  key: string;
  default_value: boolean;
  expected_revision: number;
}
interface RuleInputBase {
  priority: number;
  result: boolean;
  expected_revision: number;
}
export type RuleInput =
  | (RuleInputBase & {
      kind?: 'attribute';
      attribute: string;
      operator: 'equals' | 'in';
      expectedJSON: string;
    })
  | (RuleInputBase & { kind: 'percentage'; percentage_bp: number });
export interface VersionSummary {
  revision: number;
  schema_version: number;
  actor_id: string;
  actor_name: string;
  created_at: string;
}
export interface Version extends VersionSummary {
  snapshot: Flag;
}
export interface VersionsPage {
  items: VersionSummary[];
  total: number;
}
export interface VersionPreview {
  current_revision: number;
  source_revision: number;
  source: Flag;
  changes: { field: string; before_json: string; after_json: string }[];
}
export interface Evaluation {
  value: boolean;
  revision: number;
  source: 'disabled' | 'attribute_rule' | 'percentage_rule' | 'default';
  matched_rule_id: string | null;
  used_default: boolean;
  trace: {
    rule_id: string;
    status: 'hit' | 'miss' | 'missing' | 'invalid_identifier' | 'skipped';
  }[];
}
export interface Flags {
  versions(
    id: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<VersionsPage>;
  version(id: string, revision: number, signal?: AbortSignal): Promise<Version>;
  preview(
    id: string,
    revision: number,
    signal?: AbortSignal,
  ): Promise<VersionPreview>;
  rollback(
    id: string,
    sourceRevision: number,
    expectedRevision: number,
  ): Promise<Flag>;
  list(
    environment: Environment,
    q: string,
    enabled: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<Page>;
  get(id: string, signal?: AbortSignal): Promise<Flag>;
  create(input: CreateFlag): Promise<Flag>;
  edit(id: string, input: EditFlag): Promise<Flag>;
  enabled(id: string, enabled: boolean, revision: number): Promise<Flag>;
  saveRule(
    id: string,
    ruleID: string | undefined,
    input: RuleInput,
  ): Promise<Flag>;
  deleteRule(id: string, ruleID: string, revision: number): Promise<Flag>;
  evaluate(
    environment: Environment,
    key: string,
    attributesJSON: string,
  ): Promise<Evaluation>;
}

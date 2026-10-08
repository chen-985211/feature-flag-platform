export type Environment = 'development' | 'staging' | 'production';
export interface Rule {
  id: string;
  priority: number;
  kind: 'attribute';
  attribute: string;
  operator: 'equals' | 'in';
  expected_json: string;
  result: boolean;
}
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
export interface RuleInput {
  attribute: string;
  operator: 'equals' | 'in';
  expectedJSON: string;
  priority: number;
  result: boolean;
  expected_revision: number;
}
export interface Evaluation {
  value: boolean;
  revision: number;
  source: 'disabled' | 'attribute_rule' | 'default';
  matched_rule_id: string | null;
  used_default: boolean;
  trace: { rule_id: string; status: 'hit' | 'miss' | 'missing' | 'skipped' }[];
}
export interface Flags {
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

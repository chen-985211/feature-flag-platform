import type {
  CreateFlag,
  EditFlag,
  Environment,
  Evaluation,
  Flag,
  Flags,
  Page,
  Rule,
  RuleInput,
  Version,
  VersionsPage,
  VersionPreview,
  VersionSummary,
} from '../application/contracts';
import { validExpected } from '../domain/editing';
import {
  integer,
  isRecord,
  text,
  type Transport,
} from '../../../platform/http/client';
import { ApiError } from '../../../shared-kernel/errors';
const environment = (v: unknown): v is Environment =>
  v === 'development' || v === 'staging' || v === 'production';
function rule(v: unknown): v is Rule {
  if (
    !isRecord(v) ||
    !text(v.id) ||
    !integer(v.priority) ||
    v.priority < 1 ||
    v.priority > 2147483647 ||
    typeof v.result !== 'boolean'
  )
    return false;
  if (v.kind === 'percentage')
    return (
      integer(v.percentage_bp) &&
      v.percentage_bp <= 10000 &&
      (v.attribute === undefined || v.attribute === '') &&
      (v.operator === undefined || v.operator === '') &&
      (v.expected_json === undefined || v.expected_json === '')
    );
  return (
    v.kind === 'attribute' &&
    v.percentage_bp === undefined &&
    text(v.attribute) &&
    (v.operator === 'equals' || v.operator === 'in') &&
    text(v.expected_json) &&
    validExpected(v.expected_json, v.operator)
  );
}
function summary(v: unknown): v is VersionSummary {
  return (
    isRecord(v) &&
    integer(v.revision) &&
    v.revision > 0 &&
    integer(v.schema_version) &&
    v.schema_version > 0 &&
    text(v.actor_id) &&
    text(v.actor_name) &&
    text(v.created_at) &&
    Number.isFinite(Date.parse(v.created_at))
  );
}
function validJSON(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}
function validChange(v: unknown): boolean {
  if (
    !isRecord(v) ||
    !text(v.field) ||
    !text(v.before_json) ||
    !text(v.after_json) ||
    !validJSON(v.before_json) ||
    !validJSON(v.after_json)
  )
    return false;
  const before: unknown = JSON.parse(v.before_json),
    after: unknown = JSON.parse(v.after_json);
  if (v.field === 'rules')
    return (
      Array.isArray(before) &&
      before.every(rule) &&
      Array.isArray(after) &&
      after.every(rule)
    );
  if (v.field === 'enabled' || v.field === 'default_value')
    return typeof before === 'boolean' && typeof after === 'boolean';
  return (
    ['name', 'key', 'seed'].includes(v.field) && text(before) && text(after)
  );
}
function flag(v: unknown): Flag {
  if (
    !isRecord(v) ||
    !text(v.id) ||
    !text(v.name) ||
    !text(v.key) ||
    !environment(v.environment) ||
    typeof v.enabled !== 'boolean' ||
    typeof v.default_value !== 'boolean' ||
    !text(v.seed) ||
    !integer(v.revision) ||
    v.revision < 1 ||
    !text(v.created_at) ||
    !Number.isFinite(Date.parse(v.created_at)) ||
    !text(v.updated_at) ||
    !Number.isFinite(Date.parse(v.updated_at)) ||
    !Array.isArray(v.rules) ||
    !v.rules.every(rule)
  )
    throw new ApiError('INVALID_RESPONSE');
  return v as unknown as Flag;
}
export class HttpFlags implements Flags {
  async versions(
    id: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<VersionsPage> {
    const v = await this.http.request(
      '/api/flags/' +
        encodeURIComponent(id) +
        '/versions?limit=50&offset=' +
        String(offset),
      'GET',
      undefined,
      signal,
    );
    if (
      !isRecord(v) ||
      !integer(v.total) ||
      !Array.isArray(v.items) ||
      !v.items.every(summary)
    )
      throw new ApiError('INVALID_RESPONSE');
    return { items: v.items, total: v.total };
  }
  async version(
    id: string,
    revision: number,
    signal?: AbortSignal,
  ): Promise<Version> {
    const v = await this.http.request(
      '/api/flags/' + encodeURIComponent(id) + '/versions/' + String(revision),
      'GET',
      undefined,
      signal,
    );
    if (!isRecord(v) || !summary(v)) throw new ApiError('INVALID_RESPONSE');
    const snapshot = flag(v.snapshot);
    if (snapshot.revision !== v.revision)
      throw new ApiError('INVALID_RESPONSE');
    return { ...v, snapshot };
  }
  async preview(
    id: string,
    revision: number,
    signal?: AbortSignal,
  ): Promise<VersionPreview> {
    const v = await this.http.request(
      '/api/flags/' +
        encodeURIComponent(id) +
        '/versions/' +
        String(revision) +
        '/diff',
      'GET',
      undefined,
      signal,
    );
    if (
      !isRecord(v) ||
      !integer(v.current_revision) ||
      v.current_revision < 1 ||
      !integer(v.source_revision) ||
      v.source_revision < 1 ||
      !Array.isArray(v.changes) ||
      !v.changes.every(validChange)
    )
      throw new ApiError('INVALID_RESPONSE');
    const source = flag(v.source);
    if (source.revision !== v.source_revision)
      throw new ApiError('INVALID_RESPONSE');
    return { ...v, source } as VersionPreview;
  }
  async rollback(id: string, source: number, expected: number): Promise<Flag> {
    return flag(
      await this.http.request(
        '/api/flags/' + encodeURIComponent(id) + '/rollback',
        'POST',
        JSON.stringify({
          source_revision: source,
          expected_revision: expected,
        }),
      ),
    );
  }
  constructor(private http: Transport) {}
  async list(
    env: Environment,
    q: string,
    enabled: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<Page> {
    const search = new URLSearchParams({
      environment: env,
      q,
      limit: '50',
      offset: String(offset),
    });
    if (enabled) search.set('enabled', enabled);
    const value = await this.http.request(
      '/api/flags?' + search.toString(),
      'GET',
      undefined,
      signal,
    );
    if (
      !isRecord(value) ||
      !Array.isArray(value.items) ||
      !integer(value.total)
    )
      throw new ApiError('INVALID_RESPONSE');
    return { items: value.items.map(flag), total: value.total };
  }
  async get(id: string, signal?: AbortSignal): Promise<Flag> {
    return flag(
      await this.http.request(
        '/api/flags/' + encodeURIComponent(id),
        'GET',
        undefined,
        signal,
      ),
    );
  }
  async create(input: CreateFlag): Promise<Flag> {
    return flag(
      await this.http.request('/api/flags', 'POST', JSON.stringify(input)),
    );
  }
  async edit(id: string, input: EditFlag): Promise<Flag> {
    return flag(
      await this.http.request(
        '/api/flags/' + encodeURIComponent(id),
        'PUT',
        JSON.stringify(input),
      ),
    );
  }
  async enabled(id: string, enabled: boolean, rev: number): Promise<Flag> {
    return flag(
      await this.http.request(
        '/api/flags/' + encodeURIComponent(id) + '/enabled',
        'PATCH',
        JSON.stringify({ enabled, expected_revision: rev }),
      ),
    );
  }
  async saveRule(
    id: string,
    ruleID: string | undefined,
    input: RuleInput,
  ): Promise<Flag> {
    let body: string;
    if (input.kind === 'percentage') {
      if (!integer(input.percentage_bp) || input.percentage_bp > 10000)
        throw new ApiError('INVALID_INPUT');
      body = JSON.stringify(input);
    } else {
      if (!validExpected(input.expectedJSON, input.operator))
        throw new ApiError('INVALID_INPUT');
      const { expectedJSON, ...fields } = input;
      body =
        JSON.stringify({ ...fields, kind: 'attribute' }).slice(0, -1) +
        ',"expected":' +
        expectedJSON +
        '}';
    }
    return flag(
      await this.http.request(
        '/api/flags/' +
          encodeURIComponent(id) +
          '/rules' +
          (ruleID ? '/' + encodeURIComponent(ruleID) : ''),
        ruleID ? 'PUT' : 'POST',
        body,
      ),
    );
  }
  async deleteRule(id: string, ruleID: string, rev: number): Promise<Flag> {
    return flag(
      await this.http.request(
        '/api/flags/' +
          encodeURIComponent(id) +
          '/rules/' +
          encodeURIComponent(ruleID),
        'DELETE',
        JSON.stringify({ expected_revision: rev }),
      ),
    );
  }
  async evaluate(
    env: Environment,
    key: string,
    attrs: string,
  ): Promise<Evaluation> {
    let value: unknown;
    try {
      value = JSON.parse(attrs);
    } catch {
      throw new ApiError('INVALID_USER_ATTRIBUTES');
    }
    if (!isRecord(value)) throw new ApiError('INVALID_USER_ATTRIBUTES');
    const body =
      JSON.stringify({ environment: env, key }).slice(0, -1) +
      ',"attributes":' +
      attrs +
      '}';
    const v = await this.http.request('/api/evaluations', 'POST', body);
    if (
      !isRecord(v) ||
      typeof v.value !== 'boolean' ||
      !integer(v.revision) ||
      v.revision < 1 ||
      !['disabled', 'attribute_rule', 'percentage_rule', 'default'].includes(
        String(v.source),
      ) ||
      !(v.matched_rule_id === null || text(v.matched_rule_id)) ||
      typeof v.used_default !== 'boolean' ||
      !Array.isArray(v.trace) ||
      !v.trace.every(
        (step: unknown) =>
          isRecord(step) &&
          text(step.rule_id) &&
          ['hit', 'miss', 'missing', 'invalid_identifier', 'skipped'].includes(
            String(step.status),
          ),
      )
    )
      throw new ApiError('INVALID_RESPONSE');
    return v as unknown as Evaluation;
  }
}

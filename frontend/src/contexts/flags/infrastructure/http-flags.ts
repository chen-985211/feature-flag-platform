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
  return (
    isRecord(v) &&
    text(v.id) &&
    integer(v.priority) &&
    v.priority > 0 &&
    v.kind === 'attribute' &&
    text(v.attribute) &&
    (v.operator === 'equals' || v.operator === 'in') &&
    text(v.expected_json) &&
    validExpected(v.expected_json, v.operator) &&
    typeof v.result === 'boolean'
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
    if (!validExpected(input.expectedJSON, input.operator))
      throw new ApiError('INVALID_INPUT');
    const { expectedJSON, ...fields } = input;
    const body =
      JSON.stringify(fields).slice(0, -1) + ',"expected":' + expectedJSON + '}';
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
      !['disabled', 'attribute_rule', 'default'].includes(String(v.source)) ||
      !(v.matched_rule_id === null || text(v.matched_rule_id)) ||
      typeof v.used_default !== 'boolean' ||
      !Array.isArray(v.trace) ||
      !v.trace.every(
        (step: unknown) =>
          isRecord(step) &&
          text(step.rule_id) &&
          ['hit', 'miss', 'missing', 'skipped'].includes(String(step.status)),
      )
    )
      throw new ApiError('INVALID_RESPONSE');
    return v as unknown as Evaluation;
  }
}

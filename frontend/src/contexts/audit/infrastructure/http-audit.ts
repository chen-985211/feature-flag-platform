import type { Audit, AuditEntry, AuditPage } from '../application/contracts';
import {
  integer,
  isRecord,
  text,
  type Transport,
} from '../../../platform/http/client';
import { ApiError } from '../../../shared-kernel/errors';
function entry(v: unknown): v is AuditEntry {
  return (
    isRecord(v) &&
    text(v.id) &&
    text(v.flag_id) &&
    text(v.environment) &&
    text(v.key) &&
    integer(v.revision) &&
    text(v.actor_name) &&
    text(v.action) &&
    text(v.created_at) &&
    text(v.changes_json) &&
    text(v.request_id)
  );
}
export class HttpAudit implements Audit {
  constructor(private http: Transport) {}
  async history(
    id: string,
    offset: number,
    signal?: AbortSignal,
  ): Promise<AuditPage> {
    const value = await this.http.request(
      '/api/flags/' +
        encodeURIComponent(id) +
        '/history?limit=50&offset=' +
        String(offset),
      'GET',
      undefined,
      signal,
    );
    if (
      !isRecord(value) ||
      !integer(value.total) ||
      !Array.isArray(value.items) ||
      !value.items.every(entry)
    )
      throw new ApiError('INVALID_RESPONSE');
    return { items: value.items, total: value.total };
  }
}

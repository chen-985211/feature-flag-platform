export interface AuditEntry {
  id: string;
  flag_id: string;
  environment: string;
  key: string;
  revision: number;
  actor_name: string;
  action: string;
  created_at: string;
  changes_json: string;
  request_id: string;
}
export interface AuditPage {
  items: AuditEntry[];
  total: number;
}
export interface Audit {
  history(id: string, offset: number, signal?: AbortSignal): Promise<AuditPage>;
}

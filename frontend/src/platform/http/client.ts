import { ApiError } from '../../shared-kernel/errors';
export interface Transport {
  request(
    path: string,
    method?: string,
    body?: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
}
export class HttpClient implements Transport {
  private csrf = '';
  constructor(
    private fetcher: typeof fetch,
    private onUnauthorized?: () => void,
  ) {}
  setCSRF(token: string) {
    this.csrf = token;
  }
  async request(
    path: string,
    method = 'GET',
    body?: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.csrf) headers['X-CSRF-Token'] = this.csrf;
    const response = await this.fetcher(path, {
      method,
      body,
      signal,
      headers,
      credentials: 'same-origin',
    });
    if (response.status === 204) return undefined;
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new ApiError('INVALID_RESPONSE');
    }
    if (!response.ok) {
      if (response.status === 401 && path !== '/api/auth/login')
        this.onUnauthorized?.();
      if (
        isRecord(value) &&
        isRecord(value.error) &&
        typeof value.error.code === 'string' &&
        typeof value.error.request_id === 'string'
      )
        throw new ApiError(value.error.code, value.error.request_id);
      throw new ApiError('INVALID_RESPONSE');
    }
    return value;
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function text(value: unknown): value is string {
  return typeof value === 'string';
}
export function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

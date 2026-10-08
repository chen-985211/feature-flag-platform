import type { Identity, Session } from '../application/contracts';
import { HttpClient, isRecord, text } from '../../../platform/http/client';
import { ApiError } from '../../../shared-kernel/errors';
export class HttpIdentity implements Identity {
  constructor(private http: HttpClient) {}
  private consume(v: unknown): Session {
    if (
      !isRecord(v) ||
      !isRecord(v.user) ||
      !text(v.user.id) ||
      !text(v.user.username) ||
      !text(v.user.display_name) ||
      !['admin', 'editor', 'viewer'].includes(String(v.user.role)) ||
      !text(v.csrf_token) ||
      v.csrf_token.length !== 64 ||
      !Array.isArray(v.write_environments) ||
      !v.write_environments.every(
        (env: unknown) =>
          typeof env === 'string' &&
          ['development', 'staging', 'production'].includes(env),
      )
    )
      throw new ApiError('INVALID_RESPONSE');
    this.http.setCSRF(v.csrf_token);
    return v as unknown as Session;
  }
  async session(signal?: AbortSignal): Promise<Session> {
    return this.consume(
      await this.http.request('/api/auth/session', 'GET', undefined, signal),
    );
  }
  async login(username: string, password: string): Promise<Session> {
    return this.consume(
      await this.http.request(
        '/api/auth/login',
        'POST',
        JSON.stringify({ username, password }),
      ),
    );
  }
  async logout(): Promise<void> {
    await this.http.request('/api/auth/logout', 'POST');
    this.http.setCSRF('');
  }
}

import type { HealthGateway, Readiness } from '../application/check-readiness';
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export class HttpHealthGateway implements HealthGateway {
  constructor(private readonly request: typeof fetch) {}
  async readiness(signal?: AbortSignal): Promise<Readiness> {
    const response = await this.request('/health/ready', {
      signal,
      headers: { Accept: 'application/json' },
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('无法读取服务状态');
    }
    if (response.status === 200 && isRecord(body) && body.status === 'ready')
      return { status: 'ready' };
    if (
      response.status === 503 &&
      isRecord(body) &&
      isRecord(body.error) &&
      body.error.code === 'SERVICE_NOT_READY' &&
      typeof body.error.request_id === 'string' &&
      body.error.request_id.length > 0
    )
      return { status: 'unavailable', requestId: body.error.request_id };
    throw new Error('无法读取服务状态');
  }
}

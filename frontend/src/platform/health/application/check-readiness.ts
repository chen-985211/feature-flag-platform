export type Readiness =
  { status: 'ready' } | { status: 'unavailable'; requestId: string };
export interface HealthGateway {
  readiness(signal?: AbortSignal): Promise<Readiness>;
}
export type CheckReadiness = (signal?: AbortSignal) => Promise<Readiness>;
export function createCheckReadiness(gateway: HealthGateway): CheckReadiness {
  return (signal) => gateway.readiness(signal);
}

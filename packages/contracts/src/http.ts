export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

export interface HealthDependency {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  dependencies: Record<string, HealthDependency>;
}

import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

export interface ApiConfig {
  host: string;
  port: number;
  apiKey?: string;
  model?: string;
  allowedOrigins: string[];
  requestsPerHour: number;
  trustProxy: boolean;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadLocalEnvironment(): void {
  const envPath = path.resolve('.env');
  if (existsSync(envPath)) loadEnvFile(envPath);
}

export function readApiConfig(environment = process.env): ApiConfig {
  return {
    host: environment.FORMGEN_API_HOST?.trim() || environment.HOST?.trim() || '127.0.0.1',
    port: positiveInteger(environment.FORMGEN_API_PORT ?? environment.PORT, 8787),
    apiKey: environment.OPENAI_API_KEY?.trim() || undefined,
    model: environment.OPENAI_MODEL?.trim() || undefined,
    allowedOrigins: (
      environment.FORMGEN_ALLOWED_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    requestsPerHour: positiveInteger(environment.FORMGEN_AI_REQUESTS_PER_HOUR, 10),
    trustProxy: environment.FORMGEN_TRUST_PROXY === 'true',
  };
}

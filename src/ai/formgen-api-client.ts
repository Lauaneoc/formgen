import { validateAssistanceSuggestions, type AssistanceSuggestion } from './form-assistance.js';
import { type FormDefinition } from '../schema/form-schema.js';

export const DEFAULT_FORMGEN_API_URL = 'https://formgen-xmg1.onrender.com';
export const DEFAULT_FORMGEN_API_TIMEOUT_MILLISECONDS = 90_000;

interface FormGenApiClientOptions {
  baseUrl: string;
  fetchImplementation?: typeof fetch;
  timeoutMilliseconds?: number;
}

interface AssistanceResponse {
  suggestions?: unknown;
  error?: string | { code?: string; message?: string };
}

export class FormGenApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'FormGenApiError';
  }
}

export async function requestFormAssistance(
  definition: FormDefinition,
  options: FormGenApiClientOptions,
): Promise<AssistanceSuggestion[]> {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const endpoint = `${baseUrl}/v1/assistance/suggestions`;
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const response = await fetchImplementation(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition }),
    signal: AbortSignal.timeout(
      options.timeoutMilliseconds ?? DEFAULT_FORMGEN_API_TIMEOUT_MILLISECONDS,
    ),
  });

  let body: AssistanceResponse;
  try {
    body = (await response.json()) as AssistanceResponse;
  } catch {
    throw new FormGenApiError('A API do FormGen devolveu uma resposta invalida.', response.status);
  }

  if (!response.ok) {
    const apiError = typeof body.error === 'string' ? undefined : body.error;
    const message =
      typeof body.error === 'string'
        ? body.error
        : (apiError?.message ?? 'Nao foi possivel obter sugestoes da IA.');
    throw new FormGenApiError(message, response.status, apiError?.code);
  }

  return validateAssistanceSuggestions(definition, body.suggestions);
}

import { type AssistanceSuggestion } from '../../src/ai/form-assistance.js';
import { requestFormAssistance } from '../../src/ai/formgen-api-client.js';
import { type FormDefinition } from '../../src/schema/form-schema.js';

const apiBaseUrl = (import.meta.env.VITE_FORMGEN_API_URL ?? '').replace(/\/$/, '');

export async function requestAiAssistance(
  definition: FormDefinition,
): Promise<AssistanceSuggestion[]> {
  return requestFormAssistance(definition, { baseUrl: apiBaseUrl });
}

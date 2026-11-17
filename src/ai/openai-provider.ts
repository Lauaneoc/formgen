import { detectAssistanceGaps, validateAssistanceSuggestions } from './form-assistance.js';
import { type FormDefinition } from '../schema/form-schema.js';

interface OpenAiAssistanceOptions {
  apiKey: string;
  model: string;
  fetchImplementation?: typeof fetch;
}

interface OpenAiResponseBody {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: unknown;
    }>;
  }>;
}

export class OpenAiProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'OpenAiProviderError';
  }
}

function extractOutputText(body: OpenAiResponseBody): string {
  if (typeof body.output_text === 'string') return body.output_text;

  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  throw new Error('A API de IA nao devolveu um texto estruturado.');
}

export async function requestOpenAiAssistance(
  definition: FormDefinition,
  options: OpenAiAssistanceOptions,
) {
  const gaps = detectAssistanceGaps(definition);
  if (gaps.length === 0) return [];
  if (!options.apiKey.trim() || !options.model.trim()) {
    throw new Error('OPENAI_API_KEY e OPENAI_MODEL precisam estar configurados.');
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;
  const response = await fetchImplementation('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      instructions:
        'Voce auxilia na escrita de formularios acessiveis em portugues do Brasil. ' +
        'Responda somente com sugestoes para as chaves fornecidas. ' +
        'Placeholders devem ser exemplos curtos e nunca substituir rotulos. ' +
        'Textos de ajuda devem orientar sem repetir o rotulo. ' +
        'Nao invente campos, regras, dados pessoais ou requisitos.',
      input: JSON.stringify({
        form: {
          name: definition.name,
          description: definition.description,
          fields: definition.fields.map((field) => ({
            id: field.id,
            label: field.label,
            type: field.domainType,
            required: field.required,
            min: field.min,
            max: field.max,
            minLength: field.minLength,
            maxLength: field.maxLength,
            options: field.options,
          })),
        },
        gaps,
      }),
      max_output_tokens: 1600,
      text: {
        format: {
          type: 'json_schema',
          name: 'formgen_assistance',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['suggestions'],
            properties: {
              suggestions: {
                type: 'array',
                maxItems: gaps.length,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['key', 'value', 'reason'],
                  properties: {
                    key: { type: 'string', enum: gaps.map((gap) => gap.key) },
                    value: { type: 'string', minLength: 1, maxLength: 240 },
                    reason: { type: 'string', minLength: 1, maxLength: 240 },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new OpenAiProviderError(
      `A API de IA recusou a solicitacao com status ${response.status}.`,
      response.status,
    );
  }

  const body = (await response.json()) as OpenAiResponseBody;
  const parsed = JSON.parse(extractOutputText(body)) as { suggestions?: unknown };
  return validateAssistanceSuggestions(definition, parsed.suggestions);
}

import { describe, expect, it, vi } from 'vitest';
import { requestOpenAiAssistance } from '../../src/ai/openai-provider.js';
import { parseForm } from '../../src/parser/parser.js';

const definition = parseForm(
  'formulario "Contato" campo email { rotulo "E-mail" tipo email obrigatorio verdadeiro } botao { texto "Enviar" }',
);

describe('Provedor OpenAI', () => {
  it('usa saida estruturada e valida as sugestoes devolvidas', async () => {
    const fetchImplementation = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        text: { format: { schema: { properties: { suggestions: { items: unknown } } } } };
      };
      expect(requestBody.text.format.schema.properties.suggestions.items).toBeTruthy();

      return new Response(
        JSON.stringify({
          output: [
            {
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    suggestions: [
                      {
                        key: 'field.email.placeholder',
                        value: 'nome@exemplo.com',
                        reason: 'Demonstra o formato esperado',
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const suggestions = await requestOpenAiAssistance(definition, {
      apiKey: 'test-key',
      model: 'test-model',
      fetchImplementation,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].key).toBe('field.email.placeholder');
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });
});

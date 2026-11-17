import { describe, expect, it, vi } from 'vitest';
import { FormGenApiError, requestFormAssistance } from '../../src/ai/formgen-api-client.js';
import { parseForm } from '../../src/parser/parser.js';

const definition = parseForm(
  'formulario "Contato" campo email { rotulo "E-mail" tipo email obrigatorio verdadeiro } botao { texto "Enviar" }',
);

describe('Cliente da API FormGen', () => {
  it('consulta o endpoint versionado e valida as sugestoes', async () => {
    const fetchImplementation = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe('https://api.formgen.test/v1/assistance/suggestions');
      return new Response(
        JSON.stringify({
          suggestions: [
            {
              key: 'field.email.placeholder',
              value: 'nome@exemplo.com',
              reason: 'Demonstra o formato esperado',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const suggestions = await requestFormAssistance(definition, {
      baseUrl: 'https://api.formgen.test/',
      fetchImplementation,
    });

    expect(suggestions).toHaveLength(1);
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it('preserva codigo e mensagem de erro devolvidos pela API', async () => {
    const fetchImplementation = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'RATE_LIMIT_REACHED', message: 'Tente novamente mais tarde.' },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    const request = requestFormAssistance(definition, {
      baseUrl: 'https://api.formgen.test',
      fetchImplementation,
    });

    await expect(request).rejects.toMatchObject<FormGenApiError>({
      status: 429,
      code: 'RATE_LIMIT_REACHED',
      message: 'Tente novamente mais tarde.',
    });
  });
});

import { type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createFormGenServer } from '../../server/app.js';
import { type ApiConfig } from '../../server/config.js';
import { OpenAiProviderError } from '../../src/ai/openai-provider.js';

const definition = {
  name: 'Contato',
  fields: [
    {
      id: 'email',
      label: 'E-mail',
      domainType: 'email',
      htmlType: 'email',
      required: true,
    },
  ],
  submitButton: { text: 'Enviar' },
};

const config: ApiConfig = {
  host: '127.0.0.1',
  port: 0,
  apiKey: 'test-key',
  model: 'test-model',
  allowedOrigins: ['http://127.0.0.1:5173'],
  requestsPerHour: 10,
  trustProxy: false,
};

const servers: ReturnType<typeof createFormGenServer>[] = [];

async function startServer(
  overrides: Partial<ApiConfig> = {},
  assist = async () => [
    {
      key: 'field.email.placeholder',
      value: 'nome@exemplo.com',
      reason: 'Exemplo do formato esperado',
    },
  ],
) {
  const server = createFormGenServer({ ...config, ...overrides }, { assist, log: () => undefined });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

describe('API FormGen', () => {
  it('informa saude sem expor credenciais', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', aiConfigured: true });
  });

  it('devolve sugestoes e cabecalhos de limite para uma origem permitida', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/v1/assistance/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:5173',
      },
      body: JSON.stringify({ definition }),
    });
    const body = (await response.json()) as { suggestions: Array<{ key: string }> };

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('9');
    expect(body.suggestions[0].key).toBe('field.email.placeholder');
  });

  it('gera o ZIP React sem consumir a cota de IA', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/v1/generation/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition }),
    });
    const zip = await JSZip.loadAsync(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('x-ratelimit-remaining')).toBeNull();
    expect(Object.keys(zip.files)).toContain('src/forms/ContatoForm.tsx');
    expect(Object.keys(zip.files)).toContain('src/components/formgen/Input.tsx');
  });

  it('bloqueia origem nao autorizada', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/v1/assistance/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
      body: JSON.stringify({ definition }),
    });

    expect(response.status).toBe(403);
  });

  it('aplica limite por cliente antes de consultar a IA', async () => {
    const baseUrl = await startServer({ requestsPerHour: 1 });
    const request = () =>
      fetch(`${baseUrl}/v1/assistance/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ definition }),
      });

    expect((await request()).status).toBe(200);
    const blocked = await request();
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: { code: 'RATE_LIMIT_REACHED' } });
  });

  it('traduz o limite financeiro da provedora sem expor detalhes internos', async () => {
    const baseUrl = await startServer({}, async () => {
      throw new OpenAiProviderError('provider details', 429);
    });
    const response = await fetch(`${baseUrl}/v1/assistance/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition }),
    });
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toMatchObject({ error: { code: 'AI_LIMIT_REACHED' } });
    expect(JSON.stringify(body)).not.toContain('provider details');
  });
});

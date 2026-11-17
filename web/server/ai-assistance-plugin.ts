import { type IncomingMessage, type ServerResponse } from 'node:http';
import { type Plugin } from 'vite';
import { ZodError } from 'zod';
import { requestOpenAiAssistance } from '../../src/ai/openai-provider.js';
import { formSchema } from '../../src/schema/form-schema.js';
import { validateFormDefinition } from '../../src/validators/semantic-validator.js';

interface AiAssistancePluginOptions {
  apiKey?: string;
  model?: string;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error('A solicitacao excede o limite de 64 KB.');
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, status: number, code: string, message: string) {
  sendJson(response, status, { error: { code, message } });
}

export function aiAssistancePlugin(options: AiAssistancePluginOptions): Plugin {
  return {
    name: 'formgen-ai-assistance',
    configureServer(server) {
      server.middlewares.use('/v1/assistance/suggestions', async (request, response) => {
        if (request.method !== 'POST') {
          sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Metodo nao permitido.');
          return;
        }

        if (!options.apiKey || !options.model) {
          sendError(
            response,
            503,
            'AI_NOT_CONFIGURED',
            'Configure OPENAI_API_KEY e OPENAI_MODEL para usar a assistencia de IA.',
          );
          return;
        }

        try {
          const requestBody = (await readJsonBody(request)) as { definition?: unknown };
          const definition = formSchema.parse(requestBody.definition);
          validateFormDefinition(definition);
          const suggestions = await requestOpenAiAssistance(definition, {
            apiKey: options.apiKey,
            model: options.model,
          });
          sendJson(response, 200, { suggestions });
        } catch (error) {
          if (error instanceof ZodError || error instanceof SyntaxError) {
            sendError(response, 400, 'INVALID_FORM', 'A definicao enviada para a IA e invalida.');
            return;
          }

          console.error(error);
          sendError(
            response,
            502,
            'AI_REQUEST_FAILED',
            error instanceof Error ? error.message : 'Nao foi possivel consultar a IA.',
          );
        }
      });
    },
  };
}

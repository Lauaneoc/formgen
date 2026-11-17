import { type IncomingMessage, type ServerResponse } from 'node:http';
import { type Plugin } from 'vite';
import { ZodError } from 'zod';
import { createReactArchive } from '../../src/generator/create-react-archive.js';
import { formSchema } from '../../src/schema/form-schema.js';
import { validateFormDefinition } from '../../src/validators/semantic-validator.js';

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function sendError(response: ServerResponse, status: number, code: string, message: string) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ error: { code, message } }));
}

export function reactGenerationPlugin(): Plugin {
  return {
    name: 'formgen-react-generation',
    configureServer(server) {
      server.middlewares.use('/v1/generation/react', async (request, response) => {
        if (request.method !== 'POST') {
          sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
          return;
        }

        try {
          const body = (await readJsonBody(request)) as { definition?: unknown };
          const definition = formSchema.parse(body.definition);
          validateFormDefinition(definition);
          const archive = await createReactArchive(definition);
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/zip');
          response.setHeader('Content-Disposition', `attachment; filename="${archive.fileName}"`);
          response.end(archive.buffer);
        } catch (error) {
          if (error instanceof ZodError || error instanceof SyntaxError) {
            sendError(response, 400, 'INVALID_FORM', 'A definição enviada é inválida.');
          } else if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
            sendError(response, 413, 'PAYLOAD_TOO_LARGE', 'A solicitação excede 64 KB.');
          } else {
            console.error(error);
            sendError(response, 500, 'GENERATION_FAILED', 'Não foi possível gerar o ZIP.');
          }
        }
      });
    },
  };
}

import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { ZodError } from 'zod';
import { type AssistanceSuggestion } from '../src/ai/form-assistance.js';
import { OpenAiProviderError, requestOpenAiAssistance } from '../src/ai/openai-provider.js';
import { createReactArchive } from '../src/generator/create-react-archive.js';
import { FormSemanticError } from '../src/parser/parser-error.js';
import { formSchema, type FormDefinition } from '../src/schema/form-schema.js';
import { validateFormDefinition } from '../src/validators/semantic-validator.js';
import { type ApiConfig } from './config.js';
import { FixedWindowRateLimiter } from './rate-limiter.js';

interface RequestLog {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

interface ServerDependencies {
  assist?: (definition: FormDefinition) => Promise<AssistanceSuggestion[]>;
  log?: (entry: RequestLog) => void;
  now?: () => number;
}

const maximumBodySize = 64 * 1024;
const assistancePath = '/v1/assistance/suggestions';
const generationPath = '/v1/generation/react';

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maximumBodySize) throw new PayloadTooLargeError();
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

class PayloadTooLargeError extends Error {}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', 'no-store');
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, status: number, code: string, message: string): void {
  sendJson(response, status, { error: { code, message } });
}

function requestPath(request: IncomingMessage): string {
  return new URL(request.url ?? '/', 'http://formgen.local').pathname;
}

function clientAddress(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const firstAddress = value?.split(',')[0]?.trim();
    if (firstAddress) return firstAddress;
  }
  return request.socket.remoteAddress ?? 'unknown';
}

function applyCors(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: string[],
): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  if (!allowedOrigins.includes(origin)) return false;

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Vary', 'Origin');
  return true;
}

function providerError(response: ServerResponse, error: OpenAiProviderError): void {
  if (error.status === 429) {
    sendError(
      response,
      429,
      'AI_LIMIT_REACHED',
      'O limite da assistencia de IA foi atingido. O editor e o gerador continuam disponiveis.',
    );
    return;
  }
  if (error.status === 401 || error.status === 403) {
    sendError(response, 503, 'AI_CONFIGURATION_ERROR', 'A assistencia de IA esta indisponivel.');
    return;
  }
  sendError(response, 503, 'AI_PROVIDER_UNAVAILABLE', 'A assistencia de IA esta indisponivel.');
}

export function createFormGenServer(
  config: ApiConfig,
  dependencies: ServerDependencies = {},
): Server {
  const limiter = new FixedWindowRateLimiter(config.requestsPerHour, 60 * 60 * 1_000);
  const now = dependencies.now ?? Date.now;
  const assist =
    dependencies.assist ??
    ((definition: FormDefinition) =>
      requestOpenAiAssistance(definition, {
        apiKey: config.apiKey ?? '',
        model: config.model ?? '',
      }));
  const log = dependencies.log ?? ((entry: RequestLog) => console.log(JSON.stringify(entry)));

  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = now();
    const path = requestPath(request);
    response.setHeader('X-Request-Id', requestId);
    setSecurityHeaders(response);

    try {
      if (!applyCors(request, response, config.allowedOrigins)) {
        sendError(response, 403, 'ORIGIN_NOT_ALLOWED', 'Origem nao autorizada.');
        return;
      }

      if (request.method === 'OPTIONS' && [assistancePath, generationPath].includes(path)) {
        response.statusCode = 204;
        response.end();
        return;
      }

      if (request.method === 'GET' && path === '/health') {
        sendJson(response, 200, {
          status: 'ok',
          aiConfigured: Boolean(config.apiKey && config.model),
        });
        return;
      }

      if (request.method === 'POST' && path === generationPath) {
        const body = (await readJsonBody(request)) as { definition?: unknown };
        const definition = formSchema.parse(body.definition);
        validateFormDefinition(definition);
        const archive = await createReactArchive(definition);
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/zip');
        response.setHeader('Content-Disposition', `attachment; filename="${archive.fileName}"`);
        response.end(archive.buffer);
        return;
      }

      if (request.method !== 'POST' || path !== assistancePath) {
        sendError(response, 404, 'NOT_FOUND', 'Rota nao encontrada.');
        return;
      }

      if (!config.apiKey || !config.model) {
        sendError(response, 503, 'AI_NOT_CONFIGURED', 'A assistencia de IA nao esta configurada.');
        return;
      }

      const rateLimit = limiter.consume(clientAddress(request, config.trustProxy), now());
      response.setHeader('X-RateLimit-Limit', String(config.requestsPerHour));
      response.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
      response.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetAt / 1_000)));
      if (!rateLimit.allowed) {
        sendError(
          response,
          429,
          'RATE_LIMIT_REACHED',
          'Limite de solicitacoes atingido. Tente novamente mais tarde.',
        );
        return;
      }

      const body = (await readJsonBody(request)) as { definition?: unknown };
      const definition = formSchema.parse(body.definition);
      validateFormDefinition(definition);
      const suggestions = await assist(definition);
      sendJson(response, 200, { suggestions });
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        sendError(response, 413, 'PAYLOAD_TOO_LARGE', 'A solicitacao excede o limite de 64 KB.');
      } else if (
        error instanceof ZodError ||
        error instanceof SyntaxError ||
        error instanceof FormSemanticError
      ) {
        sendError(response, 400, 'INVALID_FORM', 'A definicao enviada e invalida.');
      } else if (error instanceof OpenAiProviderError) {
        providerError(response, error);
      } else {
        console.error(error);
        if (path === generationPath) {
          sendError(response, 500, 'GENERATION_FAILED', 'Nao foi possivel gerar o ZIP.');
        } else {
          sendError(response, 502, 'AI_REQUEST_FAILED', 'Nao foi possivel consultar a IA.');
        }
      }
    } finally {
      log({
        requestId,
        method: request.method ?? 'UNKNOWN',
        path,
        status: response.statusCode,
        durationMs: Math.max(0, now() - startedAt),
      });
    }
  });
}

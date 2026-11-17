import { type FormDefinition } from '../../src/schema/form-schema.js';

const apiBaseUrl = (import.meta.env.VITE_FORMGEN_API_URL ?? '').replace(/\/$/, '');

interface ErrorResponse {
  error?: { message?: string };
}

export async function requestReactArchive(definition: FormDefinition): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}/v1/generation/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition }),
  });

  if (!response.ok) {
    let message = 'Não foi possível gerar o arquivo ZIP.';
    try {
      const body = (await response.json()) as ErrorResponse;
      message = body.error?.message ?? message;
    } catch {
      // A mensagem padrão cobre respostas que não são JSON.
    }
    throw new Error(message);
  }

  return response.blob();
}

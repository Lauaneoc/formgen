import { parseForm } from '../../src/parser/parser.js';
import { type FormDefinition } from '../../src/schema/form-schema.js';
import { validateFormDefinition } from '../../src/validators/semantic-validator.js';

export type CompilationResult =
  { ok: true; definition: FormDefinition } | { ok: false; message: string };

export function compileDsl(source: string): CompilationResult {
  try {
    const definition = parseForm(source);
    validateFormDefinition(definition);
    return { ok: true, definition };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Não foi possível analisar a especificação.',
    };
  }
}

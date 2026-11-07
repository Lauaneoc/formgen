import { type FormDefinition } from '../schema/form-schema.js';
import { formSchema } from '../schema/form-schema.js';

export function compileForm(definition: FormDefinition): FormDefinition {
  const result = formSchema.safeParse(definition);
  if (!result.success) {
    throw new Error(`Falha na validação final do formulário: ${result.error.message}`);
  }

  return result.data;
}

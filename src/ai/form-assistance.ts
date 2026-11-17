import { z } from 'zod';
import { formSchema, type FormDefinition } from '../schema/form-schema.js';
import { validateFormDefinition } from '../validators/semantic-validator.js';

export type AssistanceProperty = 'description' | 'helpText' | 'placeholder';

export interface AssistanceGap {
  key: string;
  property: AssistanceProperty;
  label: string;
  fieldId?: string;
}

export interface AssistanceSuggestion {
  key: string;
  value: string;
  reason: string;
}

const suggestionSchema = z.object({
  key: z.string().min(1),
  value: z.string().trim().min(1).max(240),
  reason: z.string().trim().min(1).max(240),
});

const suggestionsSchema = z.array(suggestionSchema).max(100);
const placeholderTypes = new Set([
  'texto',
  'email',
  'senha',
  'numero',
  'telefone',
  'cpf',
  'cnpj',
  'textarea',
]);

export function detectAssistanceGaps(definition: FormDefinition): AssistanceGap[] {
  const gaps: AssistanceGap[] = [];

  if (!definition.description?.trim()) {
    gaps.push({
      key: 'form.description',
      property: 'description',
      label: `Descricao do formulario ${definition.name}`,
    });
  }

  for (const field of definition.fields) {
    if (!field.helpText?.trim()) {
      gaps.push({
        key: `field.${field.id}.helpText`,
        property: 'helpText',
        fieldId: field.id,
        label: `Texto de ajuda de ${field.label}`,
      });
    }

    if (placeholderTypes.has(field.domainType) && !field.placeholder?.trim()) {
      gaps.push({
        key: `field.${field.id}.placeholder`,
        property: 'placeholder',
        fieldId: field.id,
        label: `Placeholder de ${field.label}`,
      });
    }
  }

  return gaps;
}

export function validateAssistanceSuggestions(
  definition: FormDefinition,
  input: unknown,
): AssistanceSuggestion[] {
  const suggestions = suggestionsSchema.parse(input);
  const gapsByKey = new Map(detectAssistanceGaps(definition).map((gap) => [gap.key, gap]));
  const seenKeys = new Set<string>();

  for (const suggestion of suggestions) {
    const gap = gapsByKey.get(suggestion.key);
    if (!gap) {
      throw new Error(`A IA sugeriu uma propriedade nao solicitada: ${suggestion.key}.`);
    }
    if (seenKeys.has(suggestion.key)) {
      throw new Error(`A IA devolveu a sugestao duplicada: ${suggestion.key}.`);
    }
    if (/["\r\n]/.test(suggestion.value)) {
      throw new Error(`A sugestao ${suggestion.key} contem aspas ou quebra de linha.`);
    }

    const maximumLength = gap.property === 'placeholder' ? 100 : 200;
    if (suggestion.value.length > maximumLength) {
      throw new Error(`A sugestao ${suggestion.key} excede ${maximumLength} caracteres.`);
    }
    seenKeys.add(suggestion.key);
  }

  return suggestions;
}

export function applyAssistanceSuggestions(
  definition: FormDefinition,
  input: unknown,
): FormDefinition {
  const suggestions = validateAssistanceSuggestions(definition, input);
  const gapsByKey = new Map(detectAssistanceGaps(definition).map((gap) => [gap.key, gap]));
  const nextDefinition = structuredClone(definition);

  for (const suggestion of suggestions) {
    const gap = gapsByKey.get(suggestion.key)!;
    if (gap.property === 'description') {
      nextDefinition.description = suggestion.value;
      continue;
    }

    const field = nextDefinition.fields.find((candidate) => candidate.id === gap.fieldId);
    if (!field) {
      throw new Error(`Campo nao encontrado ao aplicar a sugestao: ${gap.fieldId}.`);
    }

    if (gap.property === 'helpText') {
      field.helpText = suggestion.value;
    } else {
      field.placeholder = suggestion.value;
    }
  }

  const parsed = formSchema.parse(nextDefinition);
  validateFormDefinition(parsed);
  return parsed;
}

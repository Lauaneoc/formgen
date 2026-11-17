import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  applyAssistanceSuggestions,
  detectAssistanceGaps,
  type AssistanceGap,
  type AssistanceSuggestion,
} from '../ai/form-assistance.js';
import { requestFormAssistance } from '../ai/formgen-api-client.js';
import { serializeFormDefinition } from '../compiler/serialize-form.js';
import { parseForm } from '../parser/parser.js';
import { type FormDefinition } from '../schema/form-schema.js';
import { validateFormDefinition } from '../validators/semantic-validator.js';

interface ReviewAssistanceOptions {
  apiUrl: string;
  selectSuggestions: (
    suggestions: AssistanceSuggestion[],
    gaps: Map<string, AssistanceGap>,
  ) => Promise<AssistanceSuggestion[]>;
  fetchImplementation?: typeof fetch;
}

interface AssistFormFileOptions extends ReviewAssistanceOptions {
  inputPath: string;
  outputPath?: string;
}

export interface ReviewAssistanceResult {
  definition: FormDefinition;
  suggestionCount: number;
  appliedCount: number;
}

export interface AssistFormFileResult {
  outputPath?: string;
  suggestionCount: number;
  appliedCount: number;
}

function defaultOutputPath(inputPath: string): string {
  const extension = path.extname(inputPath) || '.form';
  const name = path.basename(inputPath, path.extname(inputPath));
  return path.join(path.dirname(inputPath), `${name}.assistido${extension}`);
}

export async function reviewFormAssistance(
  definition: FormDefinition,
  options: ReviewAssistanceOptions,
): Promise<ReviewAssistanceResult> {
  const suggestions = await requestFormAssistance(definition, {
    baseUrl: options.apiUrl,
    fetchImplementation: options.fetchImplementation,
  });

  if (suggestions.length === 0) {
    return { definition, suggestionCount: 0, appliedCount: 0 };
  }

  const gaps = new Map(detectAssistanceGaps(definition).map((gap) => [gap.key, gap]));
  const selected = await options.selectSuggestions(suggestions, gaps);
  if (selected.length === 0) {
    return { definition, suggestionCount: suggestions.length, appliedCount: 0 };
  }

  return {
    definition: applyAssistanceSuggestions(definition, selected),
    suggestionCount: suggestions.length,
    appliedCount: selected.length,
  };
}

export async function assistFormFile(
  options: AssistFormFileOptions,
): Promise<AssistFormFileResult> {
  const inputPath = path.resolve(options.inputPath);
  const outputPath = path.resolve(options.outputPath ?? defaultOutputPath(inputPath));
  if (inputPath === outputPath) {
    throw new Error('O comando assist nao sobrescreve o arquivo original. Escolha outra saida.');
  }
  if (existsSync(outputPath)) {
    throw new Error(`O arquivo de saida ja existe: ${outputPath}. Escolha outro nome.`);
  }

  const source = readFileSync(inputPath, 'utf8');
  const definition = parseForm(source);
  validateFormDefinition(definition);
  const reviewed = await reviewFormAssistance(definition, options);
  if (reviewed.appliedCount === 0) {
    return { suggestionCount: reviewed.suggestionCount, appliedCount: 0 };
  }

  writeFileSync(outputPath, serializeFormDefinition(reviewed.definition), 'utf8');
  return {
    outputPath,
    suggestionCount: reviewed.suggestionCount,
    appliedCount: reviewed.appliedCount,
  };
}

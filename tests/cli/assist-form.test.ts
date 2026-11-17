import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assistFormFile, reviewFormAssistance } from '../../src/cli/assist-form.js';
import { parseForm } from '../../src/parser/parser.js';

const temporaryDirectories: string[] = [];
const source = `formulario "Contato"

campo email {
  rotulo "E-mail"
  tipo email
  obrigatorio verdadeiro
}

botao { texto "Enviar" }`;

function assistanceResponse() {
  return new Response(
    JSON.stringify({
      suggestions: [
        {
          key: 'form.description',
          value: 'Entre em contato com nossa equipe',
          reason: 'Contextualiza o formulario',
        },
        {
          key: 'field.email.placeholder',
          value: 'nome@exemplo.com',
          reason: 'Demonstra o formato esperado',
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

async function createInputFile() {
  const directory = await mkdtemp(path.join(tmpdir(), 'formgen-assist-'));
  temporaryDirectories.push(directory);
  const inputPath = path.join(directory, 'contato.form');
  await writeFile(inputPath, source, 'utf8');
  return { directory, inputPath };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('Comando assist', () => {
  it('aplica sugestoes em memoria sem alterar a definicao original', async () => {
    const definition = parseForm(source);
    const reviewed = await reviewFormAssistance(definition, {
      apiUrl: 'https://api.formgen.test',
      fetchImplementation: vi.fn(async () => assistanceResponse()),
      selectSuggestions: async (suggestions) => suggestions,
    });

    expect(reviewed).toMatchObject({ suggestionCount: 2, appliedCount: 2 });
    expect(reviewed.definition.description).toBe('Entre em contato com nossa equipe');
    expect(reviewed.definition.fields[0].placeholder).toBe('nome@exemplo.com');
    expect(definition.description).toBeUndefined();
    expect(definition.fields[0].placeholder).toBeUndefined();
  });

  it('cria outro arquivo apenas com as sugestoes selecionadas', async () => {
    const { directory, inputPath } = await createInputFile();
    const fetchImplementation = vi.fn(async () => assistanceResponse());
    const result = await assistFormFile({
      inputPath,
      apiUrl: 'https://api.formgen.test',
      fetchImplementation,
      selectSuggestions: async (suggestions) =>
        suggestions.filter((suggestion) => suggestion.key.endsWith('.placeholder')),
    });

    const outputPath = path.join(directory, 'contato.assistido.form');
    const output = parseForm(await readFile(outputPath, 'utf8'));
    expect(result).toMatchObject({ outputPath, suggestionCount: 2, appliedCount: 1 });
    expect(output.description).toBeUndefined();
    expect(output.fields[0].placeholder).toBe('nome@exemplo.com');
    expect(await readFile(inputPath, 'utf8')).toBe(source);
  });

  it('nao cria saida quando todas as sugestoes sao recusadas', async () => {
    const { directory, inputPath } = await createInputFile();
    const result = await assistFormFile({
      inputPath,
      apiUrl: 'https://api.formgen.test',
      fetchImplementation: vi.fn(async () => assistanceResponse()),
      selectSuggestions: async () => [],
    });

    expect(result).toMatchObject({ suggestionCount: 2, appliedCount: 0 });
    await expect(readFile(path.join(directory, 'contato.assistido.form'))).rejects.toThrow();
  });

  it('nunca sobrescreve o arquivo original', async () => {
    const { inputPath } = await createInputFile();
    const fetchImplementation = vi.fn(async () => assistanceResponse());

    await expect(
      assistFormFile({
        inputPath,
        outputPath: inputPath,
        apiUrl: 'https://api.formgen.test',
        fetchImplementation,
        selectSuggestions: async (suggestions) => suggestions,
      }),
    ).rejects.toThrow('nao sobrescreve o arquivo original');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});

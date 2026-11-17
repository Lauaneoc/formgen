#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { type AssistanceGap, type AssistanceSuggestion } from '../ai/form-assistance.js';
import { assistFormFile, reviewFormAssistance } from './assist-form.js';
import { relativeImportPath, resolveComponentsOutput } from './component-paths.js';
import { Command } from 'commander';
import { compileForm } from '../compiler/compile-form.js';
import { generateReactArtifacts } from '../generator/react-code-generator.js';
import {
  assertGeneratedArtifactsWritable,
  writeGeneratedArtifacts,
} from '../generator/write-artifacts.js';
import { parseForm } from '../parser/parser.js';
import { FormSemanticError, FormSyntaxError } from '../parser/parser-error.js';
import { validateFormDefinition } from '../validators/semantic-validator.js';

function formatError(error: unknown, filePath: string): string {
  if (error instanceof FormSyntaxError) {
    return `Erro de sintaxe em ${filePath}\n\n${error.message}`;
  }

  if (error instanceof FormSemanticError) {
    return `Erro semântico em ${filePath}\n\n${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Erro inesperado.';
}

function resolveOutputPath(inputPath: string, outputPath?: string): string {
  if (outputPath) {
    return path.resolve(outputPath);
  }

  return path.resolve(
    path.dirname(inputPath),
    `${path.basename(inputPath, path.extname(inputPath))}.json`,
  );
}

async function selectSuggestionsInteractively(
  suggestions: AssistanceSuggestion[],
  gaps: Map<string, AssistanceGap>,
): Promise<AssistanceSuggestion[]> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('O modo interativo exige um terminal. Use --accept-all para automacao.');
  }

  const selected: AssistanceSuggestion[] = [];
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    for (const suggestion of suggestions) {
      const label = gaps.get(suggestion.key)?.label ?? suggestion.key;
      stdout.write(`\n${label}\n`);
      stdout.write(`Sugestao: ${suggestion.value}\n`);
      stdout.write(`Motivo: ${suggestion.reason}\n`);
      const answer = (await prompt.question('Aplicar esta sugestao? [s/N] ')).trim().toLowerCase();
      if (answer === 's' || answer === 'sim') selected.push(suggestion);
    }
  } finally {
    prompt.close();
  }
  return selected;
}

function buildCli(): Command {
  const program = new Command();

  program.name('formgen').description('Compilador de formulários web acessíveis').version('0.1.0');

  program
    .command('compile')
    .description('Valida e compila um arquivo .form para JSON')
    .argument('<file>', 'Caminho do arquivo .form')
    .option('-o, --output <path>', 'Caminho do arquivo JSON de saída')
    .action((file: string, options: { output?: string }) => {
      try {
        const absoluteInputPath = path.resolve(file);
        const source = readFileSync(absoluteInputPath, 'utf8');
        const definition = parseForm(source);
        validateFormDefinition(definition);
        const compiled = compileForm(definition);
        const outputPath = resolveOutputPath(absoluteInputPath, options.output);

        if (existsSync(outputPath)) {
          throw new Error(`O arquivo de saída já existe: ${outputPath}. Escolha outro nome.`);
        }

        writeFileSync(outputPath, `${JSON.stringify(compiled, null, 2)}\n`, 'utf8');
        console.log(`Formulário compilado com sucesso: ${outputPath}`);
      } catch (error) {
        console.error(formatError(error, file));
        process.exitCode = 1;
      }
    });

  program
    .command('validate')
    .description('Valida um arquivo .form sem gerar saída')
    .argument('<file>', 'Caminho do arquivo .form')
    .action((file: string) => {
      try {
        const absoluteInputPath = path.resolve(file);
        const source = readFileSync(absoluteInputPath, 'utf8');
        const definition = parseForm(source);
        validateFormDefinition(definition);
        console.log(`Arquivo válido: ${absoluteInputPath}`);
      } catch (error) {
        console.error(formatError(error, file));
        process.exitCode = 1;
      }
    });

  program
    .command('assist')
    .description('Sugere descricoes, textos de ajuda e placeholders para uma DSL')
    .argument('<file>', 'Caminho do arquivo .form')
    .option('-o, --output <path>', 'Arquivo .form que recebera as sugestoes aprovadas')
    .option(
      '--api-url <url>',
      'Endereco da API do FormGen',
      process.env.FORMGEN_API_URL ?? 'http://127.0.0.1:8787',
    )
    .option('--accept-all', 'Aplica todas as sugestoes sem perguntas interativas', false)
    .action(
      async (file: string, options: { output?: string; apiUrl: string; acceptAll: boolean }) => {
        try {
          const result = await assistFormFile({
            inputPath: file,
            outputPath: options.output,
            apiUrl: options.apiUrl,
            selectSuggestions: options.acceptAll
              ? async (suggestions) => suggestions
              : selectSuggestionsInteractively,
          });

          if (result.suggestionCount === 0) {
            console.log('Nenhuma lacuna compativel com a assistencia foi encontrada.');
          } else if (result.appliedCount === 0) {
            console.log('Nenhuma sugestao foi aplicada. O arquivo original nao foi alterado.');
          } else {
            console.log(
              `${result.appliedCount} sugestoes aplicadas em ${result.outputPath}. O arquivo original foi preservado.`,
            );
          }
        } catch (error) {
          console.error(formatError(error, file));
          process.exitCode = 1;
        }
      },
    );

  program
    .command('generate')
    .description('Gera componente React, validação, Storybook e teste de acessibilidade')
    .argument('<file>', 'Caminho do arquivo .form')
    .option('-o, --output <directory>', 'Diretório de saída', 'generated')
    .option(
      '--components-output <directory>',
      'Diretório dos componentes compartilhados do FormGen',
    )
    .option('--runtime-only', 'Gera somente os arquivos necessários em produção', false)
    .option('--force', 'Substitui arquivos gerados existentes', false)
    .option('--assist', 'Revisa lacunas de conteúdo com a IA antes de gerar', false)
    .option(
      '--api-url <url>',
      'Endereço da API do FormGen',
      process.env.FORMGEN_API_URL ?? 'http://127.0.0.1:8787',
    )
    .option('--accept-all', 'Aplica todas as sugestões sem perguntas interativas', false)
    .action(
      async (
        file: string,
        options: {
          output: string;
          componentsOutput?: string;
          runtimeOnly: boolean;
          force: boolean;
          assist: boolean;
          apiUrl: string;
          acceptAll: boolean;
        },
      ) => {
        try {
          if (options.acceptAll && !options.assist) {
            throw new Error('A opção --accept-all exige --assist.');
          }

          const absoluteInputPath = path.resolve(file);
          const source = readFileSync(absoluteInputPath, 'utf8');
          let definition = parseForm(source);
          validateFormDefinition(definition);

          if (options.assist) {
            const reviewed = await reviewFormAssistance(definition, {
              apiUrl: options.apiUrl,
              selectSuggestions: options.acceptAll
                ? async (suggestions) => suggestions
                : selectSuggestionsInteractively,
            });
            definition = reviewed.definition;

            if (reviewed.suggestionCount === 0) {
              console.log('Nenhuma lacuna compatível com a assistência foi encontrada.');
            } else if (reviewed.appliedCount === 0) {
              console.log('Nenhuma sugestão foi aplicada. Gerando com a DSL original.');
            } else {
              console.log(`${reviewed.appliedCount} sugestões serão usadas na geração.`);
            }
          }

          const compiled = compileForm(definition);
          const formOutput = path.resolve(options.output);
          const componentsOutput = resolveComponentsOutput(process.cwd(), options.componentsOutput);
          const artifacts = generateReactArtifacts(compiled, {
            componentsImportPath: relativeImportPath(formOutput, componentsOutput),
          }).filter((artifact) => !options.runtimeOnly || artifact.category === 'runtime');
          const formArtifacts = artifacts.filter((artifact) => artifact.target === 'form');
          const sharedComponents = artifacts.filter(
            (artifact) => artifact.target === 'shared-component',
          );

          assertGeneratedArtifactsWritable(formArtifacts, formOutput, options.force);
          assertGeneratedArtifactsWritable(sharedComponents, componentsOutput, options.force, true);
          const writtenFiles = writeGeneratedArtifacts(formArtifacts, formOutput, options.force);
          const componentFiles = writeGeneratedArtifacts(
            sharedComponents,
            componentsOutput,
            options.force,
            true,
          );

          console.log(`Formulário React gerado com sucesso em ${formOutput}:`);
          writtenFiles.forEach((writtenFile) => console.log(`- ${writtenFile}`));
          console.log(`Componentes compartilhados disponíveis em ${componentsOutput}:`);
          componentFiles.forEach((componentFile) => console.log(`- ${componentFile}`));
        } catch (error) {
          console.error(formatError(error, file));
          process.exitCode = 1;
        }
      },
    );

  return program;
}

void (async () => {
  const program = buildCli();
  await program.parseAsync(process.argv);
})();

#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { compileForm } from '../compiler/compile-form.js';
import { generateReactArtifacts } from '../generator/react-code-generator.js';
import { writeGeneratedArtifacts } from '../generator/write-artifacts.js';
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
    .command('generate')
    .description('Gera componente React, validação, Storybook e teste de acessibilidade')
    .argument('<file>', 'Caminho do arquivo .form')
    .option('-o, --output <directory>', 'Diretório de saída', 'generated')
    .option('--runtime-only', 'Gera somente os arquivos necessários em produção', false)
    .option('--force', 'Substitui arquivos gerados existentes', false)
    .action((file: string, options: { output: string; runtimeOnly: boolean; force: boolean }) => {
      try {
        const absoluteInputPath = path.resolve(file);
        const source = readFileSync(absoluteInputPath, 'utf8');
        const definition = parseForm(source);
        validateFormDefinition(definition);
        const compiled = compileForm(definition);
        const artifacts = generateReactArtifacts(compiled).filter(
          (artifact) => !options.runtimeOnly || artifact.category === 'runtime',
        );
        const writtenFiles = writeGeneratedArtifacts(artifacts, options.output, options.force);

        console.log(`Formulário React gerado com sucesso em ${path.resolve(options.output)}:`);
        writtenFiles.forEach((writtenFile) => console.log(`- ${writtenFile}`));
      } catch (error) {
        console.error(formatError(error, file));
        process.exitCode = 1;
      }
    });

  return program;
}

void (async () => {
  const program = buildCli();
  await program.parseAsync(process.argv);
})();

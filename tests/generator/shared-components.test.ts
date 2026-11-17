import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateReactArtifacts } from '../../src/generator/react-code-generator.js';
import { writeGeneratedArtifacts } from '../../src/generator/write-artifacts.js';
import { parseForm } from '../../src/parser/parser.js';

const temporaryDirectories: string[] = [];

function definition(name: string) {
  return parseForm(`formulario "${name}"

campo email {
  rotulo "E-mail"
  tipo email
  obrigatorio verdadeiro
}

botao { texto "Enviar" }`);
}

afterEach(() => {
  temporaryDirectories
    .splice(0)
    .forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe('Componentes compartilhados entre formulários', () => {
  it('permite gerar dois formulários reutilizando uma única instalação de componentes', () => {
    const project = mkdtempSync(path.join(tmpdir(), 'formgen-shared-'));
    temporaryDirectories.push(project);
    const formsDirectory = path.join(project, 'src', 'forms');
    const componentsDirectory = path.join(project, 'src', 'components', 'formgen');

    for (const name of ['Contato', 'Login']) {
      const artifacts = generateReactArtifacts(definition(name), {
        componentsImportPath: '../components/formgen',
      }).filter((artifact) => artifact.category === 'runtime');
      writeGeneratedArtifacts(
        artifacts.filter((artifact) => artifact.target === 'form'),
        formsDirectory,
      );
      writeGeneratedArtifacts(
        artifacts.filter((artifact) => artifact.target === 'shared-component'),
        componentsDirectory,
        false,
        true,
      );
    }

    expect(existsSync(path.join(formsDirectory, 'ContatoForm.tsx'))).toBe(true);
    expect(existsSync(path.join(formsDirectory, 'LoginForm.tsx'))).toBe(true);
    expect(existsSync(path.join(componentsDirectory, 'Input.tsx'))).toBe(true);
  });
});

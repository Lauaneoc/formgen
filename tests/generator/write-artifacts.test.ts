import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeGeneratedArtifacts } from '../../src/generator/write-artifacts.js';

const start = '{/* formgen:safe-zone:start custom-content */}';
const end = '{/* formgen:safe-zone:end custom-content */}';
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'formgen-safe-zone-'));
  temporaryDirectories.push(directory);
  return directory;
}

function artifact(content: string) {
  return {
    fileName: 'Form.tsx',
    content,
    category: 'runtime' as const,
    target: 'form' as const,
  };
}

afterEach(() => {
  temporaryDirectories
    .splice(0)
    .forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe('Gravação de artefatos com zonas seguras', () => {
  it('preserva a personalização e atualiza o restante do arquivo', () => {
    const directory = temporaryDirectory();
    const target = path.join(directory, 'Form.tsx');
    const original = `versao antiga\n${start}\n<p>Conteúdo da pessoa</p>\n${end}\nrodape antigo\n`;
    const generated = `versao nova\n${start}\n${end}\nrodape novo\n`;
    writeFileSync(target, original, 'utf8');

    writeGeneratedArtifacts([artifact(generated)], directory, true);

    const result = readFileSync(target, 'utf8');
    expect(result).toContain('versao nova');
    expect(result).toContain('<p>Conteúdo da pessoa</p>');
    expect(result).toContain('rodape novo');
    expect(result).not.toContain('versao antiga');
    expect(result).not.toContain('rodape antigo');
  });

  it('interrompe a escrita quando uma zona existente não foi fechada', () => {
    const directory = temporaryDirectory();
    const target = path.join(directory, 'Form.tsx');
    const malformed = `conteudo original\n${start}\n<p>Não pode ser perdido</p>\n`;
    writeFileSync(target, malformed, 'utf8');

    expect(() =>
      writeGeneratedArtifacts([artifact(`conteudo novo\n${start}\n${end}\n`)], directory, true),
    ).toThrow('foi iniciada, mas não foi fechada');
    expect(readFileSync(target, 'utf8')).toBe(malformed);
  });

  it('não remove uma zona segura que deixou de existir no novo artefato', () => {
    const directory = temporaryDirectory();
    const target = path.join(directory, 'Form.tsx');
    const original = `${start}\n<p>Personalização</p>\n${end}\n`;
    writeFileSync(target, original, 'utf8');

    expect(() =>
      writeGeneratedArtifacts([artifact('novo arquivo sem zona\n')], directory, true),
    ).toThrow('não existe mais no conteúdo gerado');
    expect(readFileSync(target, 'utf8')).toBe(original);
  });

  it('reutiliza um componente compartilhado quando o conteúdo é idêntico', () => {
    const directory = temporaryDirectory();
    const target = path.join(directory, 'Input.tsx');
    const shared = {
      ...artifact('componente compartilhado\n'),
      fileName: 'Input.tsx',
      target: 'shared-component' as const,
    };
    writeFileSync(target, shared.content, 'utf8');

    expect(() => writeGeneratedArtifacts([shared], directory, false, true)).not.toThrow();
    expect(readFileSync(target, 'utf8')).toBe(shared.content);
  });

  it('protege um componente compartilhado modificado', () => {
    const directory = temporaryDirectory();
    const target = path.join(directory, 'Input.tsx');
    const shared = {
      ...artifact('versão do FormGen\n'),
      fileName: 'Input.tsx',
      target: 'shared-component' as const,
    };
    writeFileSync(target, 'personalização da pessoa\n', 'utf8');

    expect(() => writeGeneratedArtifacts([shared], directory, false, true)).toThrow(
      'nao sera sobrescrito',
    );
    expect(readFileSync(target, 'utf8')).toBe('personalização da pessoa\n');
  });
});

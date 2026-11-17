import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { relativeImportPath, resolveComponentsOutput } from '../../src/cli/component-paths.js';

const temporaryDirectories: string[] = [];

function temporaryProject(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'formgen-components-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  temporaryDirectories
    .splice(0)
    .forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe('Destino dos componentes compartilhados', () => {
  it('prioriza src/components e cria a subpasta formgen', () => {
    const project = temporaryProject();
    mkdirSync(path.join(project, 'src', 'components'), { recursive: true });

    expect(resolveComponentsOutput(project)).toBe(
      path.join(project, 'src', 'components', 'formgen'),
    );
  });

  it('reconhece uma pasta src/componentes existente', () => {
    const project = temporaryProject();
    mkdirSync(path.join(project, 'src', 'componentes'), { recursive: true });

    expect(resolveComponentsOutput(project)).toBe(
      path.join(project, 'src', 'componentes', 'formgen'),
    );
  });

  it('usa src/components/formgen quando nenhuma pasta existe', () => {
    const project = temporaryProject();
    expect(resolveComponentsOutput(project)).toBe(
      path.join(project, 'src', 'components', 'formgen'),
    );
  });

  it('respeita o destino explícito e calcula o import relativo', () => {
    const project = temporaryProject();
    const forms = path.join(project, 'src', 'forms');
    const components = resolveComponentsOutput(project, 'src/ui/formgen');

    expect(components).toBe(path.join(project, 'src', 'ui', 'formgen'));
    expect(relativeImportPath(forms, components)).toBe('../ui/formgen');
  });
});

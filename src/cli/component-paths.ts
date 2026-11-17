import { existsSync } from 'node:fs';
import path from 'node:path';

const conventionalComponentDirectories = [
  ['src', 'components'],
  ['src', 'componentes'],
  ['components'],
  ['componentes'],
];

export function resolveComponentsOutput(projectDirectory: string, explicitOutput?: string): string {
  if (explicitOutput) return path.resolve(projectDirectory, explicitOutput);

  const existing = conventionalComponentDirectories
    .map((segments) => path.join(projectDirectory, ...segments))
    .find((candidate) => existsSync(candidate));

  return path.join(existing ?? path.join(projectDirectory, 'src', 'components'), 'formgen');
}

export function relativeImportPath(fromDirectory: string, toDirectory: string): string {
  const relative = path.relative(path.resolve(fromDirectory), path.resolve(toDirectory));
  const normalized = relative.split(path.sep).join('/');
  if (!normalized) return '.';
  return normalized.startsWith('.') ? normalized : `./${normalized}`;
}

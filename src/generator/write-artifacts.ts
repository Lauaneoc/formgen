import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type GeneratedArtifact } from './react-code-generator.js';

interface SafeZone {
  name: string;
  contentStart: number;
  contentEnd: number;
  content: string;
}

const safeZoneMarker = /\{\/\*\s*formgen:safe-zone:(start|end)\s+([A-Za-z0-9_-]+)\s*\*\/\}/g;

function readSafeZones(content: string, filePath: string): SafeZone[] {
  const zones: SafeZone[] = [];
  const names = new Set<string>();
  let openZone: { name: string; contentStart: number } | undefined;
  let marker: RegExpExecArray | null;

  safeZoneMarker.lastIndex = 0;
  while ((marker = safeZoneMarker.exec(content)) !== null) {
    const [, kind, name] = marker;

    if (kind === 'start') {
      if (openZone) {
        throw new Error(
          `Zona segura inválida em ${filePath}: "${name}" foi iniciada dentro de "${openZone.name}".`,
        );
      }
      if (names.has(name)) {
        throw new Error(`Zona segura duplicada em ${filePath}: "${name}".`);
      }
      openZone = { name, contentStart: marker.index + marker[0].length };
      continue;
    }

    if (!openZone) {
      throw new Error(`Zona segura inválida em ${filePath}: fechamento de "${name}" sem início.`);
    }
    if (openZone.name !== name) {
      throw new Error(
        `Zona segura inválida em ${filePath}: esperado fechamento de "${openZone.name}", encontrado "${name}".`,
      );
    }

    zones.push({
      name,
      contentStart: openZone.contentStart,
      contentEnd: marker.index,
      content: content.slice(openZone.contentStart, marker.index),
    });
    names.add(name);
    openZone = undefined;
  }

  if (openZone) {
    throw new Error(
      `Zona segura inválida em ${filePath}: "${openZone.name}" foi iniciada, mas não foi fechada.`,
    );
  }
  if (content.includes('formgen:safe-zone:') && zones.length === 0) {
    throw new Error(`Marcadores de zona segura inválidos em ${filePath}.`);
  }

  return zones;
}

function preserveSafeZones(generated: string, existing: string, filePath: string): string {
  const existingZones = readSafeZones(existing, filePath);
  if (existingZones.length === 0) return generated;

  const generatedZones = readSafeZones(generated, `${filePath} (novo conteúdo)`);
  const existingByName = new Map(existingZones.map((zone) => [zone.name, zone]));
  const generatedNames = new Set(generatedZones.map((zone) => zone.name));
  const removedZone = existingZones.find((zone) => !generatedNames.has(zone.name));

  if (removedZone) {
    throw new Error(
      `A zona segura "${removedZone.name}" não existe mais no conteúdo gerado para ${filePath}. O arquivo não foi alterado.`,
    );
  }

  let result = generated;
  for (const zone of [...generatedZones].sort((a, b) => b.contentStart - a.contentStart)) {
    const previous = existingByName.get(zone.name);
    if (previous) {
      result = `${result.slice(0, zone.contentStart)}${previous.content}${result.slice(zone.contentEnd)}`;
    }
  }
  return result;
}

export function writeGeneratedArtifacts(
  artifacts: GeneratedArtifact[],
  outputDirectory: string,
  overwrite = false,
): string[] {
  const absoluteDirectory = path.resolve(outputDirectory);
  const targets = artifacts.map((artifact) => path.join(absoluteDirectory, artifact.fileName));

  if (!overwrite) {
    const existing = targets.find((target) => existsSync(target));
    if (existing) {
      throw new Error(`O arquivo gerado já existe: ${existing}. Use --force para substituí-lo.`);
    }
  }

  const contents = artifacts.map((artifact, index) => {
    const target = targets[index];
    if (!overwrite || !existsSync(target)) return artifact.content;
    return preserveSafeZones(artifact.content, readFileSync(target, 'utf8'), target);
  });

  mkdirSync(absoluteDirectory, { recursive: true });
  artifacts.forEach((_artifact, index) => {
    mkdirSync(path.dirname(targets[index]), { recursive: true });
    writeFileSync(targets[index], contents[index], 'utf8');
  });
  return targets;
}

import { exec as execCallback } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execCallback);
const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixtureRoot = path.join(projectRoot, 'examples', 'react-consumer');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'formgen-package-'));
const packageDirectory = path.join(temporaryRoot, 'package');
const consumerDirectory = path.join(temporaryRoot, 'consumer');
let completed = false;

async function run(command: string, cwd: string): Promise<void> {
  const result = await exec(command, { cwd, maxBuffer: 10 * 1024 * 1024 });
  if (result.stdout.trim()) console.log(result.stdout.trim());
  if (result.stderr.trim()) console.error(result.stderr.trim());
}

try {
  await mkdir(packageDirectory, { recursive: true });
  await run(`npm pack --pack-destination "${packageDirectory}"`, projectRoot);

  const tarballName = (await readdir(packageDirectory)).find((name) => name.endsWith('.tgz'));
  if (!tarballName) throw new Error('O npm pack não produziu o pacote esperado.');
  const tarballPath = path.join(packageDirectory, tarballName);

  const ignoredFixtureEntries = new Set(['node_modules', 'dist', 'package-lock.json']);
  await cp(fixtureRoot, consumerDirectory, {
    recursive: true,
    filter: (source) => !ignoredFixtureEntries.has(path.basename(source)),
  });
  await rm(path.join(consumerDirectory, 'src', 'generated'), { recursive: true, force: true });
  await rm(path.join(consumerDirectory, 'src', 'components', 'formgen'), {
    recursive: true,
    force: true,
  });
  const packageJsonPath = path.join(consumerDirectory, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  delete packageJson.dependencies.formgen;
  packageJson.devDependencies['@lauanedev/formgen'] = `file:${tarballPath.replace(/\\/g, '/')}`;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  await run('npm install', consumerDirectory);

  await run('npm run generate', consumerDirectory);
  await run('npm run build', consumerDirectory);

  const generatedFiles = await readdir(path.join(consumerDirectory, 'src', 'generated'));
  const generatedComponents = await readdir(
    path.join(consumerDirectory, 'src', 'components', 'formgen'),
  );
  const expectedFiles = ['CadastroDeClienteForm.tsx', 'useCadastroDeClienteForm.ts'];
  if (JSON.stringify(generatedFiles.sort()) !== JSON.stringify(expectedFiles.sort())) {
    throw new Error(`Arquivos de execução inesperados: ${generatedFiles.join(', ')}`);
  }

  const expectedComponents = [
    'Button.tsx',
    'Checkbox.tsx',
    'ErrorSummary.tsx',
    'Input.tsx',
    'Select.tsx',
    'Textarea.tsx',
  ];
  if (JSON.stringify(generatedComponents.sort()) !== JSON.stringify(expectedComponents.sort())) {
    throw new Error(`Componentes gerados inesperados: ${generatedComponents.join(', ')}`);
  }

  completed = true;
  console.log(
    'Pacote verificado em projeto React externo: instalação, geração e build concluídos.',
  );
} finally {
  if (completed) {
    await rm(temporaryRoot, { recursive: true, force: true });
  } else {
    console.error(`Projeto temporário preservado para diagnóstico: ${temporaryRoot}`);
  }
}

import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type FrameLocator, type Page } from 'playwright-core';

interface StorybookIndex {
  entries: Record<string, { name: string }>;
}

interface OpenStoryResult {
  page: Page;
  canvas: FrameLocator;
  browserErrors: string[];
}

const baseUrl = 'http://127.0.0.1:6006/';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const indexResponse = await fetch(`${baseUrl}index.json`);
if (!indexResponse.ok) {
  throw new Error(`Não foi possível carregar o índice do Storybook: HTTP ${indexResponse.status}.`);
}
const storybookIndex = (await indexResponse.json()) as StorybookIndex;
const stories = Object.entries(storybookIndex.entries).reduce<Record<string, string>>(
  (result, [id, entry]) => {
    result[entry.name] = id;
    return result;
  },
  {},
);

for (const expectedStory of ['Vazio', 'Preenchido', 'Com Erros']) {
  if (!stories[expectedStory]) {
    throw new Error(`História não encontrada no Storybook: ${expectedStory}.`);
  }
}

const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

async function openStory(name: string): Promise<OpenStoryResult> {
  const page = await context.newPage();
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  const query = new URLSearchParams({ path: `/story/${stories[name]}` });
  const url = `${baseUrl}?${query}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  const canvas = page.frameLocator('#storybook-preview-iframe');
  try {
    await canvas.getByRole('heading', { name: 'Verificação de Acessibilidade' }).waitFor();
  } catch (error) {
    const body = (await page.locator('body').innerText()).slice(0, 1000);
    throw new Error(
      `A história ${name} não carregou em ${url}. Conteúdo: ${body || '(vazio)'}. Erros: ${browserErrors.join('; ') || '(nenhum)'}`,
      { cause: error },
    );
  }
  return { page, canvas, browserErrors };
}

async function assertNoAutomaticViolations(
  { page }: OpenStoryResult,
  storyName: string,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include('#storybook-preview-iframe')
    .disableRules(['region', 'landmark-one-main'])
    .analyze();
  if (results.violations.length === 0) return;

  const summary = results.violations
    .map((violation) => `${violation.id}: ${violation.help}`)
    .join('; ');
  throw new Error(`Violações automáticas em ${storyName}: ${summary}`);
}

try {
  const empty = await openStory('Vazio');
  await assertNoAutomaticViolations(empty, 'Vazio');
  if ((await empty.canvas.getByLabel('Nome completo').inputValue()) !== '') {
    throw new Error('A história Vazio deveria iniciar sem nome preenchido.');
  }
  await empty.page.close();

  const filled = await openStory('Preenchido');
  await filled.canvas.getByLabel('Nome completo').waitFor();
  await filled.page.waitForTimeout(500);
  if ((await filled.canvas.getByLabel('Nome completo').inputValue()) === '') {
    throw new Error(
      `A história Preenchido não completou o campo de nome. Erros: ${filled.browserErrors.join('; ') || '(nenhum)'}`,
    );
  }
  if ((await filled.canvas.getByLabel('E-mail').inputValue()) !== 'pessoa@example.com') {
    throw new Error('A história Preenchido não completou o e-mail esperado.');
  }
  await assertNoAutomaticViolations(filled, 'Preenchido');
  await filled.page.close();

  const invalid = await openStory('Com Erros');
  await invalid.canvas.getByRole('alert').waitFor();
  const activeElement = await invalid.canvas
    .locator('body')
    .evaluate(() => document.activeElement?.id);
  if (activeElement !== 'nome') {
    throw new Error(`O foco deveria estar em nome, mas está em ${activeElement ?? 'nenhum'}.`);
  }
  await assertNoAutomaticViolations(invalid, 'Com Erros');
  await invalid.page.close();

  console.log('Storybook verificado: estados vazio, preenchido, com erros, foco e axe-core.');
} finally {
  await context.close();
  await browser.close();
}

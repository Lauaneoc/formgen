import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright-core';

const baseUrl = 'http://127.0.0.1:5173/';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDirectory = path.resolve('artifacts');

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ executablePath: edgePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

try {
  const desktop = await context.newPage();
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' });
  await desktop.getByRole('heading', { name: 'Cadastro de Cliente' }).waitFor();

  const accessibility = await new AxeBuilder({ page: desktop }).analyze();
  if (accessibility.violations.length > 0) {
    const summary = accessibility.violations
      .map(
        (violation) =>
          `${violation.id}: ${violation.help} [${violation.nodes.map((node) => node.target.join(' ')).join(', ')}]`,
      )
      .join('; ');
    throw new Error(`Violações de acessibilidade: ${summary}`);
  }

  const desktopOverflow = await desktop.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (desktopOverflow) throw new Error('A interface possui rolagem horizontal no desktop.');

  await desktop.getByRole('button', { name: 'JSON', exact: true }).click();
  await desktop.locator('.json-output').getByText('"Cadastro de Cliente"').waitFor();
  await desktop.getByRole('button', { name: 'Prévia', exact: true }).click();
  await desktop.getByRole('button', { name: 'Cadastrar' }).click();
  await desktop.getByRole('heading', { name: 'Revise os campos indicados' }).waitFor();

  const activeElement = await desktop.evaluate(() => document.activeElement?.id);
  if (activeElement !== 'preview-nome') {
    throw new Error(
      `O foco deveria estar em preview-nome, mas está em ${activeElement ?? 'nenhum'}.`,
    );
  }

  await desktop.screenshot({
    path: path.join(outputDirectory, 'formgen-desktop.png'),
    fullPage: true,
  });

  const editor = desktop.locator('.cm-content');
  await editor.fill('formulario "Inválido"');
  await desktop.getByText('Erro na especificação').waitFor();
  await desktop.getByText('Corrija a especificação para atualizar o resultado.').waitFor();

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobile.getByRole('heading', { name: 'Cadastro de Cliente' }).waitFor();

  const mobileOverflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (mobileOverflow) throw new Error('A interface possui rolagem horizontal no celular.');

  await mobile.screenshot({
    path: path.join(outputDirectory, 'formgen-mobile.png'),
    fullPage: true,
  });

  console.log('Verificação web concluída: desktop, celular, JSON, erros e foco.');
} finally {
  await context.close();
  await browser.close();
}

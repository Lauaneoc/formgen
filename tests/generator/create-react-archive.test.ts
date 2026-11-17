import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createReactArchive } from '../../src/generator/create-react-archive.js';
import { parseForm } from '../../src/parser/parser.js';

const source = `formulario "Contato"

campo email {
  rotulo "E-mail"
  tipo email
  obrigatorio verdadeiro
}

botao { texto "Enviar" }`;

describe('Arquivo ZIP React', () => {
  it('inclui somente os arquivos de producao, a DSL e as instrucoes', async () => {
    const archive = await createReactArchive(parseForm(source));
    const zip = await JSZip.loadAsync(archive.buffer);
    const files = Object.keys(zip.files);

    expect(archive.fileName).toBe('contato-react.zip');
    expect(files).toContain('src/forms/ContatoForm.tsx');
    expect(files).toContain('src/forms/useContatoForm.ts');
    expect(files).toContain('src/components/formgen/Input.tsx');
    expect(files).toContain('formulario.form');
    expect(files).toContain('README.md');
    expect(files.some((file) => file.endsWith('.stories.tsx'))).toBe(false);
    expect(files.some((file) => file.endsWith('.test.tsx'))).toBe(false);
    await expect(zip.file('src/forms/ContatoForm.tsx')!.async('string')).resolves.toContain(
      "from '../components/formgen/Input'",
    );
    await expect(zip.file('formulario.form')!.async('string')).resolves.toContain(
      'formulario "Contato"',
    );
  });
});

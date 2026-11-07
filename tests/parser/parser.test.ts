import { describe, expect, it } from 'vitest';
import { parseForm } from '../../src/parser/parser.js';

describe('Parser', () => {
  it('lê o nome do formulário', () => {
    const result = parseForm('formulario "Cadastro"\n\nbotao { texto "Enviar" }');
    expect(result.name).toBe('Cadastro');
  });

  it('lê campos e propriedades opcionais', () => {
    const result = parseForm(
      `formulario "Exemplo"\n\ncampo nome {\n  rotulo "Nome"\n  tipo texto\n  obrigatorio verdadeiro\n  ajuda "Ajuda"\n  placeholder "Digite"\n}\n\nbotao { texto "Enviar" }`,
    );
    expect(result.fields[0].id).toBe('nome');
    expect(result.fields[0].label).toBe('Nome');
    expect(result.fields[0].required).toBe(true);
    expect(result.fields[0].helpText).toBe('Ajuda');
  });

  it('converte verdadeiro e falso', () => {
    const result = parseForm(
      `formulario "Exemplo"\n\ncampo ativo {\n  rotulo "Ativo"\n  tipo checkbox\n  obrigatorio falso\n}\n\nbotao { texto "Enviar" }`,
    );
    expect(result.fields[0].required).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { compileForm } from '../../src/compiler/compile-form.js';
import { parseForm } from '../../src/parser/parser.js';

describe('Compilador', () => {
  it('gera o JSON intermediário correto', () => {
    const input = `formulario "Cadastro"\n\ndescricao "Descrição"\n\ncampo nome { rotulo "Nome" tipo texto obrigatorio verdadeiro }\n\nbotao { texto "Enviar" }`;
    const definition = parseForm(input);
    const compiled = compileForm(definition);
    expect(compiled.name).toBe('Cadastro');
    expect(compiled.fields[0].htmlType).toBe('text');
    expect(compiled.submitButton.text).toBe('Enviar');
  });
});

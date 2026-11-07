import { describe, expect, it } from 'vitest';
import { FormSemanticError } from '../../src/parser/parser-error.js';
import { parseForm } from '../../src/parser/parser.js';
import { validateFormDefinition } from '../../src/validators/semantic-validator.js';

describe('Validador semântico', () => {
  it('rejeita campos duplicados', () => {
    const input = `formulario "Exemplo"\n\ncampo nome { rotulo "Nome" tipo texto obrigatorio verdadeiro }\ncampo nome { rotulo "Nome 2" tipo texto obrigatorio falso }\n\nbotao { texto "Enviar" }`;
    const definition = parseForm(input);
    expect(() => validateFormDefinition(definition)).toThrow(FormSemanticError);
  });

  it('rejeita tipos inválidos', () => {
    const input = `formulario "Exemplo"\n\ncampo nome { rotulo "Nome" tipo invalido obrigatorio verdadeiro }\n\nbotao { texto "Enviar" }`;
    const definition = parseForm(input);
    expect(() => validateFormDefinition(definition)).toThrow(FormSemanticError);
  });

  it('rejeita propriedades incompatíveis com o tipo', () => {
    const input = `formulario "Exemplo"\n\ncampo nome { rotulo "Nome" tipo texto obrigatorio verdadeiro minimo 1 }\n\nbotao { texto "Enviar" }`;
    const definition = parseForm(input);
    expect(() => validateFormDefinition(definition)).toThrow(FormSemanticError);
  });
});

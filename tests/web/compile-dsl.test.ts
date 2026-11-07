import { describe, expect, it } from 'vitest';
import { compileDsl } from '../../web/src/compile-dsl.js';

describe('Compilação da interface web', () => {
  it('reutiliza o parser e o validador para uma DSL válida', () => {
    const result = compileDsl(
      'formulario "Contato" campo email { rotulo "E-mail" tipo email obrigatorio verdadeiro } botao { texto "Enviar" }',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.fields[0].htmlType).toBe('email');
    }
  });

  it('devolve a mensagem de erro para uma DSL inválida', () => {
    const result = compileDsl('formulario "Contato"');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('pelo menos um campo');
    }
  });
});

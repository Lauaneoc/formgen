import { describe, expect, it } from 'vitest';
import { Lexer } from '../../src/lexer/tokenizer.js';

describe('Lexer', () => {
  it('tokeniza um exemplo básico', () => {
    const lexer = new Lexer('formulario "Cadastro"');
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe('IDENTIFIER');
    expect(tokens[1].type).toBe('STRING');
    expect(tokens[2].type).toBe('EOF');
  });
});

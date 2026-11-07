export type TokenType =
  | 'EOF'
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COLON'
  | 'DOT'
  | 'COMMA';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export function createToken(type: TokenType, value: string, line: number, column: number): Token {
  return { type, value, line, column };
}

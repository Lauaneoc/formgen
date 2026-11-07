import { createToken, Token, TokenType } from './token.js';

export class Lexer {
  private text: string;
  private position = 0;
  private line = 1;
  private column = 1;

  constructor(text: string) {
    this.text = text;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      const char = this.peek();

      if (/\s/.test(char)) {
        this.advance();
        continue;
      }

      if (char === '{') {
        tokens.push(this.makeToken('LBRACE'));
        continue;
      }

      if (char === '}') {
        tokens.push(this.makeToken('RBRACE'));
        continue;
      }

      if (char === '[') {
        tokens.push(this.makeToken('LBRACKET'));
        continue;
      }

      if (char === ']') {
        tokens.push(this.makeToken('RBRACKET'));
        continue;
      }

      if (char === ',') {
        tokens.push(this.makeToken('COMMA'));
        continue;
      }

      if (char === '"') {
        tokens.push(this.readString());
        continue;
      }

      if (/[0-9]/.test(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      throw new Error(
        `Caractere inesperado '${char}' na linha ${this.line}, coluna ${this.column}`,
      );
    }

    tokens.push(createToken('EOF', '', this.line, this.column));
    return tokens;
  }

  private readString(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    this.advance();

    let value = '';

    while (!this.isAtEnd() && this.peek() !== '"') {
      const char = this.advance();
      value += char;
    }

    if (this.isAtEnd()) {
      throw new Error(`String não fechada na linha ${startLine}, coluna ${startColumn}`);
    }

    this.advance();
    return createToken('STRING', value, startLine, startColumn);
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';

    while (!this.isAtEnd() && /[0-9]/.test(this.peek())) {
      value += this.advance();
    }

    return createToken('NUMBER', value, startLine, startColumn);
  }

  private readIdentifier(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';

    while (!this.isAtEnd() && /[a-zA-Z0-9_]/.test(this.peek())) {
      value += this.advance();
    }

    const lowerValue = value.toLowerCase();
    if (lowerValue === 'verdadeiro' || lowerValue === 'falso') {
      return createToken('BOOLEAN', lowerValue, startLine, startColumn);
    }

    return createToken('IDENTIFIER', value, startLine, startColumn);
  }

  private makeToken(type: TokenType): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.advance();
    return createToken(type, char, startLine, startColumn);
  }

  private advance(): string {
    const char = this.text[this.position];
    this.position += 1;
    if (char === '\n') {
      this.line += 1;
      this.column = 1;
    } else {
      this.column += 1;
    }
    return char;
  }

  private peek(): string {
    return this.text[this.position] ?? '';
  }

  private isAtEnd(): boolean {
    return this.position >= this.text.length;
  }
}

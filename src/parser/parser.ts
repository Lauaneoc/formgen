import { Lexer } from '../lexer/tokenizer.js';
import { type Token } from '../lexer/token.js';
import { FormSyntaxError } from './parser-error.js';
import { htmlTypeMap, type FieldType } from '../schema/field-types.js';
import { type FormDefinition, type FormField } from '../schema/form-schema.js';

interface ParsedField {
  id: string;
  label: string;
  domainType: string;
  required: boolean;
  helpText?: string;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  options?: string[];
}

interface ParsedForm {
  name: string;
  description?: string;
  fields: ParsedField[];
  submitButton: { text: string };
}

export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(text: string) {
    const lexer = new Lexer(text);
    this.tokens = lexer.tokenize();
  }

  parse(): FormDefinition {
    const form = this.parseForm();
    const normalized = this.normalizeForm(form);
    return normalized;
  }

  private parseForm(): ParsedForm {
    this.expectIdentifier('formulario');
    const formName = this.expectString();
    const description = this.parseOptionalDescription();
    const fields: ParsedField[] = [];
    let submitButton: { text: string } | undefined;

    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.type === 'IDENTIFIER' && token.value.toLowerCase() === 'campo') {
        this.advance();
        fields.push(this.parseField());
        continue;
      }

      if (token.type === 'IDENTIFIER' && token.value.toLowerCase() === 'botao') {
        submitButton = this.parseButton();
        continue;
      }

      throw new FormSyntaxError(
        `Bloco inesperado "${token.value}" na linha ${token.line}, coluna ${token.column}.`,
      );
    }

    return {
      name: formName,
      description,
      fields,
      submitButton: submitButton ?? { text: '' },
    };
  }

  private parseOptionalDescription(): string | undefined {
    if (this.matchIdentifier('descricao')) {
      return this.expectString();
    }
    return undefined;
  }

  private parseField(): ParsedField {
    const id = this.expectIdentifier();
    this.expectToken('LBRACE');

    const field: ParsedField = {
      id: id.value,
      label: '',
      domainType: 'texto',
      required: true,
    };

    while (!this.matchToken('RBRACE')) {
      if (this.isAtEnd()) {
        throw new FormSyntaxError(`Era esperado o fechamento "}" do campo "${field.id}".`);
      }

      const property = this.expectIdentifier();
      const propertyName = property.value.toLowerCase();
      if (propertyName === 'rotulo') {
        field.label = this.expectString();
      } else if (propertyName === 'tipo') {
        field.domainType = this.expectFieldType();
      } else if (propertyName === 'obrigatorio') {
        field.required = this.expectBoolean();
      } else if (propertyName === 'ajuda') {
        field.helpText = this.expectString();
      } else if (propertyName === 'placeholder') {
        field.placeholder = this.expectString();
      } else if (propertyName === 'padrao') {
        field.defaultValue = this.expectValue();
      } else if (propertyName === 'minimo') {
        field.min = this.expectNumber();
      } else if (propertyName === 'maximo') {
        field.max = this.expectNumber();
      } else if (propertyName === 'tamanho_minimo') {
        field.minLength = this.expectNumber();
      } else if (propertyName === 'tamanho_maximo') {
        field.maxLength = this.expectNumber();
      } else if (propertyName === 'opcoes') {
        field.options = this.expectStringArray();
      } else {
        throw new FormSyntaxError(
          `Propriedade desconhecida "${property.value}" no campo "${field.id}".`,
        );
      }
    }

    return field;
  }

  private parseButton(): { text: string } {
    this.expectIdentifier('botao');
    this.expectToken('LBRACE');
    const button: { text: string } = { text: '' };

    while (!this.matchToken('RBRACE')) {
      if (this.isAtEnd()) {
        throw new FormSyntaxError('Era esperado o fechamento "}" do botão.');
      }
      const property = this.expectIdentifier();
      if (property.value.toLowerCase() === 'texto') {
        button.text = this.expectString();
      } else {
        throw new FormSyntaxError(`Propriedade desconhecida "${property.value}" no botão.`);
      }
    }

    return button;
  }

  private normalizeForm(parsed: ParsedForm): FormDefinition {
    const fields: FormField[] = parsed.fields.map((field) => {
      const domainType = field.domainType as FieldType;
      return {
        id: field.id,
        label: field.label,
        domainType,
        htmlType: htmlTypeMap[domainType] ?? 'text',
        required: field.required,
        ...(field.helpText ? { helpText: field.helpText } : {}),
        ...(field.placeholder ? { placeholder: field.placeholder } : {}),
        ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
        ...(field.min !== undefined ? { min: field.min } : {}),
        ...(field.max !== undefined ? { max: field.max } : {}),
        ...(field.minLength !== undefined ? { minLength: field.minLength } : {}),
        ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
        ...(field.options ? { options: field.options } : {}),
      } satisfies FormField;
    });

    return {
      name: parsed.name,
      ...(parsed.description ? { description: parsed.description } : {}),
      fields,
      submitButton: parsed.submitButton,
    };
  }

  private expectIdentifier(expected?: string): Token {
    const token = this.peek();
    if (token.type !== 'IDENTIFIER') {
      throw new FormSyntaxError(
        `Era esperado um identificador na linha ${token.line}, coluna ${token.column}.`,
      );
    }
    if (expected && token.value.toLowerCase() !== expected.toLowerCase()) {
      throw new FormSyntaxError(
        `Era esperado "${expected}" na linha ${token.line}, coluna ${token.column}.`,
      );
    }
    this.advance();
    return token;
  }

  private matchIdentifier(expected: string): boolean {
    const token = this.peek();
    if (token.type === 'IDENTIFIER' && token.value.toLowerCase() === expected.toLowerCase()) {
      this.advance();
      return true;
    }
    return false;
  }

  private expectToken(type: Token['type']): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new FormSyntaxError(
        `Era esperado ${type} na linha ${token.line}, coluna ${token.column}.`,
      );
    }
    this.advance();
    return token;
  }

  private matchToken(type: Token['type']): boolean {
    const token = this.peek();
    if (token.type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  private expectString(): string {
    const token = this.peek();
    if (token.type !== 'STRING') {
      throw new FormSyntaxError(
        `Era esperado um valor textual na linha ${token.line}, coluna ${token.column}.`,
      );
    }
    this.advance();
    return token.value;
  }

  private expectBoolean(): boolean {
    const token = this.peek();
    if (token.type !== 'BOOLEAN') {
      throw new FormSyntaxError(
        `Era esperado um valor booleano na linha ${token.line}, coluna ${token.column}.`,
      );
    }
    this.advance();
    return token.value === 'verdadeiro';
  }

  private expectNumber(): number {
    const token = this.peek();
    if (token.type !== 'NUMBER') {
      throw new FormSyntaxError(
        `Era esperado um número na linha ${token.line}, coluna ${token.column}.`,
      );
    }
    this.advance();
    return Number(token.value);
  }

  private expectFieldType(): string {
    const token = this.peek();
    if (token.type !== 'IDENTIFIER') {
      throw new FormSyntaxError(
        `Era esperado um tipo de campo na linha ${token.line}, coluna ${token.column}.`,
      );
    }
    const value = token.value.toLowerCase();
    this.advance();
    return value;
  }

  private expectStringArray(): string[] {
    this.expectToken('LBRACKET');
    const values: string[] = [];

    while (!this.matchToken('RBRACKET')) {
      if (this.isAtEnd()) {
        throw new FormSyntaxError('Era esperado o fechamento "]" da lista de opções.');
      }

      values.push(this.expectString());

      if (this.matchToken('COMMA')) {
        continue;
      }

      if (this.peek().type === 'RBRACKET') {
        this.matchToken('RBRACKET');
        break;
      }
    }

    return values;
  }

  private expectValue(): string | number | boolean {
    const token = this.peek();
    if (token.type === 'STRING') {
      this.advance();
      return token.value;
    }
    if (token.type === 'NUMBER') {
      this.advance();
      return Number(token.value);
    }
    if (token.type === 'BOOLEAN') {
      this.advance();
      return token.value === 'verdadeiro';
    }
    throw new FormSyntaxError(`Valor inválido na linha ${token.line}, coluna ${token.column}.`);
  }

  private peek(): Token {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const token = this.peek();
    this.current += 1;
    return token;
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }
}

export function parseForm(text: string): FormDefinition {
  const parser = new Parser(text);
  return parser.parse();
}

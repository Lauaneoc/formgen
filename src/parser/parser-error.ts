export class FormSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormSyntaxError';
  }
}

export class FormSemanticError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormSemanticError';
  }
}

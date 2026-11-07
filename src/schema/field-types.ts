export const allowedFieldTypes = [
  'texto',
  'email',
  'senha',
  'numero',
  'data',
  'telefone',
  'cpf',
  'cnpj',
  'textarea',
  'selecao',
  'checkbox',
] as const;

export type FieldType = (typeof allowedFieldTypes)[number];

export const htmlTypeMap: Record<FieldType, string> = {
  texto: 'text',
  email: 'email',
  senha: 'password',
  numero: 'number',
  data: 'date',
  telefone: 'tel',
  cpf: 'text',
  cnpj: 'text',
  textarea: 'textarea',
  selecao: 'select',
  checkbox: 'checkbox',
};

export const numericFieldTypes = new Set<FieldType>(['numero']);
export const textualFieldTypes = new Set<FieldType>([
  'texto',
  'email',
  'senha',
  'data',
  'telefone',
  'cpf',
  'cnpj',
  'textarea',
]);

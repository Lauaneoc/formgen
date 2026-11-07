import { FormSemanticError } from '../parser/parser-error.js';
import {
  allowedFieldTypes,
  htmlTypeMap,
  numericFieldTypes,
  textualFieldTypes,
  type FieldType,
} from '../schema/field-types.js';
import { type FormField, type FormDefinition } from '../schema/form-schema.js';

export function validateFormDefinition(definition: FormDefinition): void {
  if (definition.fields.length === 0) {
    throw new FormSemanticError('O formulário deve conter pelo menos um campo.');
  }

  if (!definition.submitButton?.text) {
    throw new FormSemanticError('O formulário deve conter um botão de envio.');
  }

  const seenIds = new Set<string>();

  for (const field of definition.fields) {
    if (seenIds.has(field.id)) {
      throw new FormSemanticError(
        `O identificador de campo duplicado "${field.id}" não é permitido.`,
      );
    }
    seenIds.add(field.id);

    validateIdentifier(field.id);
    validateFieldCompatibility(field);
  }
}

function validateIdentifier(id: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(id)) {
    throw new FormSemanticError(
      `O identificador "${id}" é inválido. Use apenas letras minúsculas, números e underscore, e não comece com número.`,
    );
  }
}

function validateFieldCompatibility(field: FormField): void {
  const { domainType, min, max, minLength, maxLength, options } = field;

  if (!allowedFieldTypes.includes(domainType)) {
    throw new FormSemanticError(`O tipo de campo "${domainType}" não é suportado.`);
  }

  if ((min !== undefined || max !== undefined) && !numericFieldTypes.has(domainType)) {
    throw new FormSemanticError(
      `A propriedade "minimo"/"maximo" não pode ser utilizada no campo "${field.id}" para o tipo "${domainType}".`,
    );
  }

  if ((minLength !== undefined || maxLength !== undefined) && !textualFieldTypes.has(domainType)) {
    throw new FormSemanticError(
      `A propriedade "tamanho_minimo"/"tamanho_maximo" não pode ser utilizada no campo "${field.id}" para o tipo "${domainType}".`,
    );
  }

  if (domainType === 'selecao' && (!options || options.length === 0)) {
    throw new FormSemanticError(`O campo "${field.id}" do tipo "selecao" deve declarar opções.`);
  }

  if (domainType !== 'selecao' && options && options.length > 0) {
    throw new FormSemanticError(
      `O campo "${field.id}" não pode declarar opções para o tipo "${domainType}".`,
    );
  }

  if (min !== undefined && max !== undefined && min > max) {
    throw new FormSemanticError(
      `O valor de "minimo" não pode ser maior que "maximo" no campo "${field.id}".`,
    );
  }

  if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
    throw new FormSemanticError(
      `O valor de "tamanho_minimo" não pode ser maior que "tamanho_maximo" no campo "${field.id}".`,
    );
  }

  if (!htmlTypeMap[domainType as FieldType]) {
    throw new FormSemanticError(`O tipo "${domainType}" não é suportado.`);
  }
}

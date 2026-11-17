import { type FormDefinition } from '../schema/form-schema.js';

function quote(value: string): string {
  return `"${value}"`;
}

function serializeDefaultValue(value: string | number | boolean): string {
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'boolean') return value ? 'verdadeiro' : 'falso';
  return String(value);
}

export function serializeFormDefinition(definition: FormDefinition): string {
  const lines = [`formulario ${quote(definition.name)}`, ''];

  if (definition.description) {
    lines.push(`descricao ${quote(definition.description)}`, '');
  }

  for (const field of definition.fields) {
    lines.push(`campo ${field.id} {`);
    lines.push(`  rotulo ${quote(field.label)}`);
    lines.push(`  tipo ${field.domainType}`);
    lines.push(`  obrigatorio ${field.required ? 'verdadeiro' : 'falso'}`);
    if (field.helpText) lines.push(`  ajuda ${quote(field.helpText)}`);
    if (field.placeholder) lines.push(`  placeholder ${quote(field.placeholder)}`);
    if (field.defaultValue !== undefined) {
      lines.push(`  padrao ${serializeDefaultValue(field.defaultValue)}`);
    }
    if (field.min !== undefined) lines.push(`  minimo ${field.min}`);
    if (field.max !== undefined) lines.push(`  maximo ${field.max}`);
    if (field.minLength !== undefined) lines.push(`  tamanho_minimo ${field.minLength}`);
    if (field.maxLength !== undefined) lines.push(`  tamanho_maximo ${field.maxLength}`);
    if (field.options) {
      lines.push(`  opcoes [${field.options.map((option) => quote(option)).join(', ')}]`);
    }
    lines.push('}', '');
  }

  lines.push('botao {', `  texto ${quote(definition.submitButton.text)}`, '}');
  return `${lines.join('\n')}\n`;
}

import { describe, expect, it } from 'vitest';
import {
  applyAssistanceSuggestions,
  detectAssistanceGaps,
  validateAssistanceSuggestions,
} from '../../src/ai/form-assistance.js';
import { serializeFormDefinition } from '../../src/compiler/serialize-form.js';
import { parseForm } from '../../src/parser/parser.js';

const source = `formulario "Contato"

campo email {
  rotulo "E-mail"
  tipo email
  obrigatorio verdadeiro
}

campo aceite {
  rotulo "Aceito os termos"
  tipo checkbox
  obrigatorio verdadeiro
}

botao { texto "Enviar" }`;

describe('Assistencia de IA', () => {
  it('detecta somente lacunas compativeis com cada controle', () => {
    const gaps = detectAssistanceGaps(parseForm(source));

    expect(gaps.map((gap) => gap.key)).toEqual([
      'form.description',
      'field.email.helpText',
      'field.email.placeholder',
      'field.aceite.helpText',
    ]);
  });

  it('rejeita propriedades nao solicitadas e sugestoes duplicadas', () => {
    const definition = parseForm(source);

    expect(() =>
      validateAssistanceSuggestions(definition, [
        { key: 'field.email.label', value: 'Novo rotulo', reason: 'Alterar o campo' },
      ]),
    ).toThrow('propriedade nao solicitada');

    expect(() =>
      validateAssistanceSuggestions(definition, [
        { key: 'field.email.placeholder', value: 'nome@exemplo.com', reason: 'Exemplo' },
        { key: 'field.email.placeholder', value: 'email@exemplo.com', reason: 'Exemplo' },
      ]),
    ).toThrow('sugestao duplicada');
  });

  it('aplica apenas as sugestoes aprovadas e gera uma DSL valida', () => {
    const definition = parseForm(source);
    const assisted = applyAssistanceSuggestions(definition, [
      {
        key: 'form.description',
        value: 'Envie uma mensagem para nossa equipe',
        reason: 'Contextualiza o formulario',
      },
      {
        key: 'field.email.placeholder',
        value: 'nome@exemplo.com',
        reason: 'Mostra o formato esperado',
      },
    ]);
    const reparsed = parseForm(serializeFormDefinition(assisted));

    expect(reparsed.description).toBe('Envie uma mensagem para nossa equipe');
    expect(reparsed.fields[0].placeholder).toBe('nome@exemplo.com');
    expect(reparsed.fields[0].helpText).toBeUndefined();
    expect(reparsed.fields[0].required).toBe(true);
    expect(reparsed.fields[1].domainType).toBe('checkbox');
  });
});

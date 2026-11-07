import { type FormEvent, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { type FormDefinition, type FormField } from '../../../src/schema/form-schema.js';

interface PreviewFormProps {
  definition: FormDefinition;
}

type FieldErrors = Record<string, string>;

function stringValue(data: FormData, field: FormField): string {
  return String(data.get(field.id) ?? '').trim();
}

function validateField(data: FormData, field: FormField): string | undefined {
  const value = stringValue(data, field);

  if (field.required && field.domainType === 'checkbox' && !data.has(field.id)) {
    return `${field.label} é obrigatório.`;
  }
  if (field.required && field.domainType !== 'checkbox' && value.length === 0) {
    return `${field.label} é obrigatório.`;
  }
  if (!value && !field.required) return undefined;

  if (field.domainType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Informe um endereço de e-mail válido.';
  }
  if (field.domainType === 'cpf' && value.replace(/\D/g, '').length !== 11) {
    return 'O CPF deve conter 11 números.';
  }
  if (field.domainType === 'cnpj' && value.replace(/\D/g, '').length !== 14) {
    return 'O CNPJ deve conter 14 números.';
  }
  if (field.domainType === 'numero') {
    const number = Number(value);
    if (!Number.isFinite(number)) return `${field.label} deve ser um número.`;
    if (field.min !== undefined && number < field.min) return `O valor mínimo é ${field.min}.`;
    if (field.max !== undefined && number > field.max) return `O valor máximo é ${field.max}.`;
  }
  if (field.minLength !== undefined && value.length < field.minLength) {
    return `Use pelo menos ${field.minLength} caracteres.`;
  }
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    return `Use no máximo ${field.maxLength} caracteres.`;
  }

  return undefined;
}

function FieldControl({ field, error }: { field: FormField; error?: string }) {
  const controlId = `preview-${field.id}`;
  const helpId = field.helpText ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const common = {
    id: controlId,
    name: field.id,
    'aria-required': field.required,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
  };

  return (
    <div
      className={`preview-field${field.domainType === 'checkbox' ? ' preview-field--checkbox' : ''}`}
    >
      {field.domainType === 'checkbox' ? (
        <div className="checkbox-row">
          <input {...common} type="checkbox" defaultChecked={Boolean(field.defaultValue)} />
          <label htmlFor={controlId}>
            {field.label} {field.required && <span aria-hidden="true">*</span>}
          </label>
        </div>
      ) : (
        <>
          <label htmlFor={controlId}>
            {field.label} {field.required && <span aria-hidden="true">*</span>}
          </label>
          {field.helpText && (
            <p className="field-help" id={helpId}>
              {field.helpText}
            </p>
          )}
          {field.domainType === 'textarea' ? (
            <textarea
              {...common}
              defaultValue={String(field.defaultValue ?? '')}
              placeholder={field.placeholder}
              minLength={field.minLength}
              maxLength={field.maxLength}
            />
          ) : field.domainType === 'selecao' ? (
            <select {...common} defaultValue={String(field.defaultValue ?? '')}>
              <option value="">Selecione</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              {...common}
              type={field.htmlType}
              defaultValue={String(field.defaultValue ?? '')}
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              minLength={field.minLength}
              maxLength={field.maxLength}
            />
          )}
        </>
      )}
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

export function PreviewForm({ definition }: PreviewFormProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextErrors = Object.fromEntries(
      definition.fields
        .map((field) => [field.id, validateField(data, field)] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
    );

    setErrors(nextErrors);
    setSubmitted(Object.keys(nextErrors).length === 0);

    const firstError = definition.fields.find((field) => nextErrors[field.id]);
    if (firstError) {
      requestAnimationFrame(() => document.getElementById(`preview-${firstError.id}`)?.focus());
    }
  }

  return (
    <form className="preview-form" onSubmit={handleSubmit} noValidate aria-label={definition.name}>
      <header className="form-heading">
        <h1>{definition.name}</h1>
        {definition.description && <p>{definition.description}</p>}
      </header>

      {Object.keys(errors).length > 0 && (
        <section className="error-summary" role="alert" aria-labelledby="error-summary-title">
          <h2 id="error-summary-title">Revise os campos indicados</h2>
          <ul>
            {definition.fields.map(
              (field) =>
                errors[field.id] && (
                  <li key={field.id}>
                    <a href={`#preview-${field.id}`}>{errors[field.id]}</a>
                  </li>
                ),
            )}
          </ul>
        </section>
      )}

      <div className="form-fields">
        {definition.fields.map((field) => (
          <FieldControl key={field.id} field={field} error={errors[field.id]} />
        ))}
      </div>

      <button className="submit-button" type="submit">
        {definition.submitButton.text}
      </button>

      {submitted && (
        <p className="submit-success" role="status">
          <CheckCircle2 aria-hidden="true" size={18} /> Formulário validado com sucesso.
        </p>
      )}
    </form>
  );
}

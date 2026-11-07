import {
  IndentationText,
  Project,
  QuoteKind,
  type SourceFile,
  VariableDeclarationKind,
} from 'ts-morph';
import { type FormDefinition, type FormField } from '../schema/form-schema.js';

export interface GeneratedArtifact {
  fileName: string;
  content: string;
  category: 'runtime' | 'storybook' | 'test';
}

interface GeneratorNames {
  componentName: string;
  dataTypeName: string;
  hookName: string;
  schemaName: string;
}

const manipulationSettings = {
  indentationText: IndentationText.TwoSpaces,
  quoteKind: QuoteKind.Single,
} as const;

function toPascalCase(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  const result = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('');

  return result && /^[A-Za-z]/.test(result) ? result : `Formulario${result}`;
}

function namesFor(definition: FormDefinition): GeneratorNames {
  const baseName = toPascalCase(definition.name);
  const componentName = baseName.endsWith('Form') ? baseName : `${baseName}Form`;
  const stem = `${componentName[0]?.toLowerCase() ?? 'f'}${componentName.slice(1)}`;

  return {
    componentName,
    dataTypeName: `${componentName}Data`,
    hookName: `use${componentName}`,
    schemaName: `${stem}Schema`,
  };
}

function createProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    manipulationSettings,
  });
}

function print(file: SourceFile): string {
  file.formatText({ indentSize: 2 });
  return `${file.getFullText().trimEnd()}\n`;
}

function stringLiteral(value: string): string {
  return JSON.stringify(value);
}

function errorMessage(field: FormField, detail = 'é obrigatório'): string {
  return stringLiteral(`${field.label} ${detail}.`);
}

function stringSchema(field: FormField): string {
  let schema = 'z.string()';

  if (field.required) {
    schema += `.min(1, ${errorMessage(field)})`;
  }
  if (field.domainType === 'email') {
    schema += `.email(${errorMessage(field, 'deve ser um e-mail válido')})`;
  }
  if (field.domainType === 'cpf') {
    schema += `.regex(/^\\d{11}$/, ${errorMessage(field, 'deve conter 11 números')})`;
  }
  if (field.domainType === 'cnpj') {
    schema += `.regex(/^\\d{14}$/, ${errorMessage(field, 'deve conter 14 números')})`;
  }
  if (field.minLength !== undefined) {
    schema += `.min(${field.minLength}, ${errorMessage(field, `deve ter pelo menos ${field.minLength} caracteres`)})`;
  }
  if (field.maxLength !== undefined) {
    schema += `.max(${field.maxLength}, ${errorMessage(field, `deve ter no máximo ${field.maxLength} caracteres`)})`;
  }
  if (!field.required) {
    schema += ".optional().or(z.literal(''))";
  }

  return schema;
}

function numberSchema(field: FormField): string {
  let number = `z.number({ invalid_type_error: ${errorMessage(field, 'deve ser um número')} })`;
  if (field.min !== undefined) {
    number += `.min(${field.min}, ${errorMessage(field, `deve ser maior ou igual a ${field.min}`)})`;
  }
  if (field.max !== undefined) {
    number += `.max(${field.max}, ${errorMessage(field, `deve ser menor ou igual a ${field.max}`)})`;
  }
  if (!field.required) {
    number += '.optional()';
  }

  return number;
}

function fieldSchema(field: FormField): string {
  if (field.domainType === 'numero') {
    return numberSchema(field);
  }
  if (field.domainType === 'checkbox') {
    return field.required
      ? `z.boolean().refine(Boolean, { message: ${errorMessage(field)} })`
      : 'z.boolean().optional()';
  }
  if (field.domainType === 'selecao' && field.options && field.options.length > 0) {
    const values = field.options.map(stringLiteral).join(', ');
    const validValue = field.required
      ? `[${values}].includes(value)`
      : `value === '' || [${values}].includes(value)`;
    const selection = `z.string().refine((value) => ${validValue}, { message: ${errorMessage(field, 'deve ter uma opção válida')} })`;
    return field.required ? selection : `${selection}.optional()`;
  }

  return stringSchema(field);
}

function defaultValues(definition: FormDefinition): string {
  const entries = definition.fields.map((field) => {
    const fallback =
      field.domainType === 'checkbox' ? false : field.domainType === 'numero' ? undefined : '';
    const value = field.defaultValue ?? fallback;
    return `${field.id}: ${value === undefined ? 'undefined' : JSON.stringify(value)}`;
  });
  return `{ ${entries.join(', ')} }`;
}

function generateHook(
  project: Project,
  definition: FormDefinition,
  names: GeneratorNames,
): GeneratedArtifact {
  const fileName = `${names.hookName}.ts`;
  const file = project.createSourceFile(fileName);

  file.addImportDeclaration({
    moduleSpecifier: '@hookform/resolvers/zod',
    namedImports: ['zodResolver'],
  });
  file.addImportDeclaration({ moduleSpecifier: 'react-hook-form', namedImports: ['useForm'] });
  file.addImportDeclaration({ moduleSpecifier: 'zod', namedImports: ['z'] });

  file.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: names.schemaName,
        initializer: (writer) => {
          writer.write('z.object({').newLine();
          writer.indent(() => {
            definition.fields.forEach((field) =>
              writer.writeLine(`${field.id}: ${fieldSchema(field)},`),
            );
          });
          writer.write('})');
        },
      },
    ],
  });

  file.addTypeAlias({
    isExported: true,
    name: names.dataTypeName,
    type: `z.infer<typeof ${names.schemaName}>`,
  });

  file.addFunction({
    isExported: true,
    name: names.hookName,
    statements: (writer) => {
      writer.writeLine(`return useForm<${names.dataTypeName}>({`);
      writer.indent(() => {
        writer.writeLine(`resolver: zodResolver(${names.schemaName}),`);
        writer.writeLine(`defaultValues: ${defaultValues(definition)},`);
        writer.writeLine("mode: 'onBlur',");
      });
      writer.writeLine('});');
    },
  });

  return { fileName, content: print(file), category: 'runtime' };
}

function describedBy(field: FormField): string {
  if (field.helpText) {
    return `{errors.${field.id} ? "${field.id}-help ${field.id}-error" : "${field.id}-help"}`;
  }
  return `{errors.${field.id} ? "${field.id}-error" : undefined}`;
}

function registerExpression(field: FormField): string {
  if (field.domainType === 'numero') {
    return `{register(${stringLiteral(field.id)}, { setValueAs: (value) => value === '' ? undefined : Number(value) })}`;
  }
  return `{register(${stringLiteral(field.id)})}`;
}

function writeField(writer: import('ts-morph').CodeBlockWriter, field: FormField): void {
  const label = stringLiteral(field.label);
  const commonProps = [
    `id=${stringLiteral(field.id)}`,
    `label={${label}}`,
    `error={errors.${field.id}?.message}`,
    `registration=${registerExpression(field)}`,
    `aria-required={${field.required}}`,
    `aria-invalid={Boolean(errors.${field.id})}`,
    `aria-describedby=${describedBy(field)}`,
  ];

  if (field.required) commonProps.push('required');
  if (field.helpText) commonProps.push(`helpText={${stringLiteral(field.helpText)}}`);

  if (field.domainType === 'textarea') {
    if (field.placeholder) commonProps.push(`placeholder=${stringLiteral(field.placeholder)}`);
    writer.writeLine(`<Textarea ${commonProps.join(' ')} />`);
  } else if (field.domainType === 'selecao') {
    writer.writeLine(`<Select ${commonProps.join(' ')}>`);
    writer.indent(() => {
      writer.writeLine('<option value="">Selecione</option>');
      field.options?.forEach((option) => {
        writer.writeLine(
          `<option value=${stringLiteral(option)}>{${stringLiteral(option)}}</option>`,
        );
      });
    });
    writer.writeLine('</Select>');
  } else if (field.domainType === 'checkbox') {
    writer.writeLine(`<Checkbox ${commonProps.join(' ')} />`);
  } else {
    const attributes = [`type=${stringLiteral(field.htmlType)}`, ...commonProps];
    if (field.placeholder) attributes.push(`placeholder=${stringLiteral(field.placeholder)}`);
    if (field.min !== undefined) attributes.push(`min={${field.min}}`);
    if (field.max !== undefined) attributes.push(`max={${field.max}}`);
    writer.writeLine(`<Input ${attributes.join(' ')} />`);
  }
}

function generateComponent(
  project: Project,
  definition: FormDefinition,
  names: GeneratorNames,
): GeneratedArtifact {
  const fileName = `${names.componentName}.tsx`;
  const file = project.createSourceFile(fileName);

  file.addImportDeclaration({
    isTypeOnly: true,
    moduleSpecifier: 'react-hook-form',
    namedImports: ['SubmitErrorHandler', 'SubmitHandler'],
  });
  file.addImportDeclaration({
    moduleSpecifier: `./${names.hookName}`,
    namedImports: [names.hookName],
  });
  file.addImportDeclaration({
    isTypeOnly: true,
    moduleSpecifier: `./${names.hookName}`,
    namedImports: [names.dataTypeName],
  });
  if (
    definition.fields.some(
      (field) => !['textarea', 'selecao', 'checkbox'].includes(field.domainType),
    )
  ) {
    file.addImportDeclaration({ moduleSpecifier: './components/Input', namedImports: ['Input'] });
  }
  if (definition.fields.some((field) => field.domainType === 'selecao')) {
    file.addImportDeclaration({ moduleSpecifier: './components/Select', namedImports: ['Select'] });
  }
  if (definition.fields.some((field) => field.domainType === 'textarea')) {
    file.addImportDeclaration({
      moduleSpecifier: './components/Textarea',
      namedImports: ['Textarea'],
    });
  }
  if (definition.fields.some((field) => field.domainType === 'checkbox')) {
    file.addImportDeclaration({
      moduleSpecifier: './components/Checkbox',
      namedImports: ['Checkbox'],
    });
  }
  file.addImportDeclaration({ moduleSpecifier: './components/Button', namedImports: ['Button'] });
  file.addImportDeclaration({
    moduleSpecifier: './components/ErrorSummary',
    namedImports: ['ErrorSummary'],
  });

  file.addInterface({
    isExported: true,
    name: `${names.componentName}Props`,
    properties: [
      { name: 'onSubmit', type: `SubmitHandler<${names.dataTypeName}>` },
      { name: 'className', type: 'string', hasQuestionToken: true },
    ],
  });

  file.addFunction({
    isExported: true,
    name: names.componentName,
    parameters: [{ name: '{ onSubmit, className }', type: `${names.componentName}Props` }],
    statements: (writer) => {
      writer.writeLine(
        `const { register, handleSubmit, formState: { errors } } = ${names.hookName}();`,
      );
      writer.writeLine(`const onInvalid: SubmitErrorHandler<${names.dataTypeName}> = () => {`);
      writer.indent(() => {
        writer.writeLine('requestAnimationFrame(() => {');
        writer.indent(() => {
          writer.writeLine(
            'document.querySelector<HTMLElement>(\'[aria-invalid="true"]\')?.focus();',
          );
        });
        writer.writeLine('});');
      });
      writer.writeLine('};').blankLine();
      writer.writeLine('return (');
      writer.indent(() => {
        writer.writeLine(
          `<form className={\`w-full max-w-2xl space-y-5 text-zinc-900 \${className ?? ''}\`} onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate aria-label=${stringLiteral(definition.name)}>`,
        );
        writer.indent(() => {
          writer.writeLine(
            `<h1 className="text-2xl font-bold text-zinc-950">{${stringLiteral(definition.name)}}</h1>`,
          );
          if (definition.description) {
            writer.writeLine(
              `<p className="text-sm text-zinc-600">{${stringLiteral(definition.description)}}</p>`,
            );
          }
          writer.writeLine('{Object.keys(errors).length > 0 && (');
          writer.indent(() => {
            writer.writeLine(
              '<ErrorSummary titleId="form-errors-title" title="Corrija os seguintes erros" role="alert" aria-labelledby="form-errors-title" tabIndex={-1}>',
            );
            writer.indent(() => {
              writer.writeLine('<ul className="mt-2 list-disc space-y-1 pl-5">');
              writer.indent(() => {
                definition.fields.forEach((field) => {
                  writer.writeLine(
                    `{errors.${field.id} && <li><a className="font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700" href="#${field.id}">{${stringLiteral(field.label)}}: {errors.${field.id}.message}</a></li>}`,
                  );
                });
              });
              writer.writeLine('</ul>');
            });
            writer.writeLine('</ErrorSummary>');
          });
          writer.writeLine(')}');
          writer.writeLine('{/* formgen:safe-zone:start custom-content */}');
          writer.writeLine('{/* formgen:safe-zone:end custom-content */}');
          definition.fields.forEach((field) => writeField(writer, field));
          writer.writeLine(
            `<Button type="submit">{${stringLiteral(definition.submitButton.text)}}</Button>`,
          );
        });
        writer.writeLine('</form>');
      });
      writer.writeLine(');');
    },
  });

  return { fileName, content: print(file), category: 'runtime' };
}

function generateUiComponents(project: Project): GeneratedArtifact[] {
  const components: Array<[string, string]> = [
    [
      'Input.tsx',
      `import type { InputHTMLAttributes } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  helpText?: string;
  error?: string;
  registration: UseFormRegisterReturn;
}

export function Input({ id, label, helpText, error, registration, required, className, ...inputProps }: InputProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-zinc-900" htmlFor={id}>
        {label} {required && <span className="text-red-700" aria-hidden="true">*</span>}
      </label>
      {helpText && <p id={\`${'${id}'}-help\`} className="text-sm text-zinc-600">{helpText}</p>}
      <input id={id} required={required} {...registration} {...inputProps} className={\`min-h-11 w-full rounded-md border bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-100 \${error ? 'border-red-700' : 'border-zinc-400'} \${className ?? ''}\`} />
      {error && <p id={\`${'${id}'}-error\`} className="text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}`,
    ],
    [
      'Textarea.tsx',
      `import type { TextareaHTMLAttributes } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
  label: string;
  helpText?: string;
  error?: string;
  registration: UseFormRegisterReturn;
}

export function Textarea({ id, label, helpText, error, registration, required, className, ...textareaProps }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-zinc-900" htmlFor={id}>{label} {required && <span className="text-red-700" aria-hidden="true">*</span>}</label>
      {helpText && <p id={\`${'${id}'}-help\`} className="text-sm text-zinc-600">{helpText}</p>}
      <textarea id={id} required={required} {...registration} {...textareaProps} className={\`min-h-28 w-full resize-y rounded-md border bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 \${error ? 'border-red-700' : 'border-zinc-400'} \${className ?? ''}\`} />
      {error && <p id={\`${'${id}'}-error\`} className="text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}`,
    ],
    [
      'Select.tsx',
      `import type { SelectHTMLAttributes } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: string;
  helpText?: string;
  error?: string;
  registration: UseFormRegisterReturn;
}

export function Select({ id, label, helpText, error, registration, required, className, children, ...selectProps }: SelectProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-zinc-900" htmlFor={id}>{label} {required && <span className="text-red-700" aria-hidden="true">*</span>}</label>
      {helpText && <p id={\`${'${id}'}-help\`} className="text-sm text-zinc-600">{helpText}</p>}
      <select id={id} required={required} {...registration} {...selectProps} className={\`min-h-11 w-full rounded-md border bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 \${error ? 'border-red-700' : 'border-zinc-400'} \${className ?? ''}\`}>{children}</select>
      {error && <p id={\`${'${id}'}-error\`} className="text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}`,
    ],
    [
      'Checkbox.tsx',
      `import type { InputHTMLAttributes } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  id: string;
  label: string;
  helpText?: string;
  error?: string;
  registration: UseFormRegisterReturn;
}

export function Checkbox({ id, label, helpText, error, registration, required, className, ...inputProps }: CheckboxProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <input id={id} type="checkbox" required={required} {...registration} {...inputProps} className={\`mt-0.5 size-5 rounded border-zinc-400 text-blue-700 outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 \${className ?? ''}\`} />
        <label className="text-sm font-semibold text-zinc-900" htmlFor={id}>{label} {required && <span className="text-red-700" aria-hidden="true">*</span>}</label>
      </div>
      {helpText && <p id={\`${'${id}'}-help\`} className="text-sm text-zinc-600">{helpText}</p>}
      {error && <p id={\`${'${id}'}-error\`} className="text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}`,
    ],
    [
      'Button.tsx',
      `import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, children, ...buttonProps }: ButtonProps) {
  return <button {...buttonProps} className={\`min-h-11 rounded-md border border-emerald-800 bg-emerald-700 px-5 py-2 font-bold text-white outline-none transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 \${className ?? ''}\`}>{children}</button>;
}`,
    ],
    [
      'ErrorSummary.tsx',
      `import type { HTMLAttributes, ReactNode } from 'react';

export interface ErrorSummaryProps extends HTMLAttributes<HTMLDivElement> {
  titleId: string;
  title: string;
  children: ReactNode;
}

export function ErrorSummary({ titleId, title, children, className, ...summaryProps }: ErrorSummaryProps) {
  return (
    <div {...summaryProps} className={\`border-l-4 border-red-700 bg-red-50 p-4 text-red-950 outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 \${className ?? ''}\`}>
      <h2 id={titleId} className="font-bold">{title}</h2>
      {children}
    </div>
  );
}`,
    ],
  ];

  return components.map(([fileName, content]) => {
    const file = project.createSourceFile(`components/${fileName}`, content);
    return { fileName: `components/${fileName}`, content: print(file), category: 'runtime' };
  });
}

function generateStory(project: Project, names: GeneratorNames): GeneratedArtifact {
  const fileName = `${names.componentName}.stories.tsx`;
  const file = project.createSourceFile(fileName);
  file.addImportDeclaration({
    isTypeOnly: true,
    moduleSpecifier: '@storybook/react',
    namedImports: ['Meta', 'StoryObj'],
  });
  file.addImportDeclaration({
    moduleSpecifier: `./${names.componentName}`,
    namedImports: [names.componentName],
  });
  file.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'meta',
        initializer: `{ title: 'Formulários/${names.componentName}', component: ${names.componentName}, args: { onSubmit: (data) => console.log(data) } } satisfies Meta<typeof ${names.componentName}>`,
      },
    ],
  });
  file.addExportAssignment({ expression: 'meta', isExportEquals: false });
  file.addTypeAlias({ name: 'Story', type: 'StoryObj<typeof meta>' });
  file.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{ name: 'Vazio', type: 'Story', initializer: '{}' }],
  });
  return { fileName, content: print(file), category: 'storybook' };
}

function generateAccessibilityTest(project: Project, names: GeneratorNames): GeneratedArtifact {
  const fileName = `${names.componentName}.test.tsx`;
  const file = project.createSourceFile(fileName);
  file.addImportDeclaration({
    moduleSpecifier: '@testing-library/react',
    namedImports: ['render'],
  });
  file.addImportDeclaration({ moduleSpecifier: 'jest-axe', namedImports: ['axe'] });
  file.addImportDeclaration({
    moduleSpecifier: 'vitest',
    namedImports: ['describe', 'expect', 'it', 'vi'],
  });
  file.addImportDeclaration({
    moduleSpecifier: `./${names.componentName}`,
    namedImports: [names.componentName],
  });
  file.addStatements((writer) => {
    writer.writeLine(`describe('${names.componentName}', () => {`);
    writer.indent(() => {
      writer.writeLine("it('não possui violações automáticas de acessibilidade', async () => {");
      writer.indent(() => {
        writer.writeLine(
          `const { container } = render(<${names.componentName} onSubmit={vi.fn()} />);`,
        );
        writer.writeLine('const results = await axe(container);');
        writer.writeLine('expect(results.violations).toEqual([]);');
      });
      writer.writeLine('});');
    });
    writer.writeLine('});');
  });
  return { fileName, content: print(file), category: 'test' };
}

export function generateReactArtifacts(definition: FormDefinition): GeneratedArtifact[] {
  const project = createProject();
  const names = namesFor(definition);

  return [
    generateComponent(project, definition, names),
    generateHook(project, definition, names),
    ...generateUiComponents(project),
    generateStory(project, names),
    generateAccessibilityTest(project, names),
  ];
}

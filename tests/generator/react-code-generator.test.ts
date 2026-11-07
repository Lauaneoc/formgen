import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { generateReactArtifacts } from '../../src/generator/react-code-generator.js';
import { parseForm } from '../../src/parser/parser.js';

const source = `formulario "Cadastro de cliente"

descricao "Crie uma conta"

campo nome {
  rotulo "Nome completo"
  tipo texto
  obrigatorio verdadeiro
  ajuda "Informe nome e sobrenome"
  tamanho_minimo 3
}

campo email {
  rotulo "E-mail"
  tipo email
  obrigatorio verdadeiro
}

campo idade {
  rotulo "Idade"
  tipo numero
  obrigatorio falso
  minimo 18
}

campo estado {
  rotulo "Estado"
  tipo selecao
  obrigatorio verdadeiro
  opcoes ["Bahia", "Sergipe"]
}

botao { texto "Cadastrar" }`;

describe('Gerador React via AST', () => {
  it('gera os artefatos previstos e os componentes Tailwind', () => {
    const artifacts = generateReactArtifacts(parseForm(source));
    expect(artifacts.map((artifact) => artifact.fileName)).toEqual([
      'CadastroDeClienteForm.tsx',
      'useCadastroDeClienteForm.ts',
      'components/Input.tsx',
      'components/Textarea.tsx',
      'components/Select.tsx',
      'components/Checkbox.tsx',
      'components/Button.tsx',
      'components/ErrorSummary.tsx',
      'CadastroDeClienteForm.stories.tsx',
      'CadastroDeClienteForm.test.tsx',
    ]);
  });

  it('inclui validação, acessibilidade e gerenciamento de foco', () => {
    const artifacts = generateReactArtifacts(parseForm(source));
    const component = artifacts[0].content;
    const hook = artifacts[1].content;

    expect(component).toContain('aria-invalid={Boolean(errors.nome)}');
    expect(component).not.toContain('.css');
    expect(component).toContain("import { Input } from './components/Input'");
    expect(component).toContain('className={`w-full max-w-2xl space-y-5');
    expect(component).toContain(
      'aria-describedby={errors.nome ? "nome-help nome-error" : "nome-help"}',
    );
    expect(component).toContain('role="alert"');
    expect(component).toContain('<Input type="text"');
    expect(component).toContain('registration={register("nome")}');
    expect(component).toContain('querySelector<HTMLElement>(\'[aria-invalid="true"]\')');
    expect(hook).toContain('zodResolver(cadastroDeClienteFormSchema)');
    expect(hook).toContain('nome: z.string().min(1');
    expect(hook).toContain('.min(3,');
    expect(component).toContain(
      'registration={register("idade", { setValueAs: (value) => value === \'\' ? undefined : Number(value) })}',
    );
    expect(hook).toContain('idade: z.number');
    expect(hook).toContain('estado: z.string().refine');
    expect(hook).toContain('idade: undefined');
  });

  it('é determinístico para a mesma definição', () => {
    const definition = parseForm(source);
    expect(generateReactArtifacts(definition)).toEqual(generateReactArtifacts(definition));
  });

  it('gera arquivos com sintaxe TypeScript e TSX válida', () => {
    const artifacts = generateReactArtifacts(parseForm(source));

    for (const artifact of artifacts) {
      const result = ts.transpileModule(artifact.content, {
        fileName: artifact.fileName,
        reportDiagnostics: true,
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      });
      const errors = (result.diagnostics ?? [])
        .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

      expect(errors, artifact.fileName).toEqual([]);
    }
  });
});

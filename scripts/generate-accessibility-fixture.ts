import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateReactArtifacts } from '../src/generator/react-code-generator.js';
import { writeGeneratedArtifacts } from '../src/generator/write-artifacts.js';
import { parseForm } from '../src/parser/parser.js';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDirectory = path.join(projectRoot, 'tests', 'generated-a11y');

const source = `formulario "Verificação de Acessibilidade"

descricao "Formulário gerado para validação automatizada"

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

botao {
  texto "Enviar"
}`;

const artifacts = generateReactArtifacts(parseForm(source)).filter(
  (artifact) =>
    artifact.category === 'runtime' ||
    artifact.category === 'storybook' ||
    artifact.category === 'test',
);

writeGeneratedArtifacts(artifacts, outputDirectory, true);

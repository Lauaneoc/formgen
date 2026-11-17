import JSZip from 'jszip';
import { serializeFormDefinition } from '../compiler/serialize-form.js';
import { type FormDefinition } from '../schema/form-schema.js';
import { generateReactArtifacts } from './react-code-generator.js';

export interface ReactArchive {
  buffer: Buffer;
  fileName: string;
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'formulario';
}

export async function createReactArchive(definition: FormDefinition): Promise<ReactArchive> {
  const zip = new JSZip();
  const artifacts = generateReactArtifacts(definition, {
    componentsImportPath: '../components/formgen',
  }).filter((artifact) => artifact.category === 'runtime');
  const component = artifacts.find(
    (artifact) => !artifact.fileName.includes('/') && artifact.fileName.endsWith('Form.tsx'),
  );

  artifacts.forEach((artifact) => {
    const directory = artifact.target === 'form' ? 'src/forms' : 'src/components/formgen';
    zip.file(`${directory}/${artifact.fileName}`, artifact.content);
  });
  zip.file('formulario.form', serializeFormDefinition(definition));
  zip.file(
    'README.md',
    `# Formulário gerado pelo FormGen

## Dependências

\`\`\`bash
npm install react-hook-form @hookform/resolvers zod
npm install --save-dev tailwindcss @tailwindcss/vite
\`\`\`

O formulário está em \`src/forms\` e os componentes compartilhados em
\`src/components/formgen\`. Eles usam classes do Tailwind CSS. Importe
\`${component?.fileName ?? 'o componente de formulário gerado'}\` no projeto e forneça a função
\`onSubmit\`.

O arquivo \`formulario.form\` preserva a especificação usada na geração.
`,
  );

  return {
    buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
    fileName: `${slugify(definition.name)}-react.zip`,
  };
}

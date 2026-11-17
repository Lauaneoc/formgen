# FormGen

## Objetivo

FormGen é um projeto open source em fase inicial para gerar formulários web acessíveis a partir de uma mini-DSL em português.

## Estado atual

Nesta primeira versão, o projeto implementa:

- leitura de arquivos .form;
- lexer e parser básicos;
- validações sintáticas e semânticas;
- geração de um JSON intermediário;
- geração estática de formulários e componentes React via TypeScript AST;
- editor web da DSL com validação e pré-visualização em tempo real;
- assistência de IA para sugerir descrições, textos de ajuda e placeholders ausentes;
- download em ZIP dos componentes React prontos para uso;
- CLI com os comandos compile, validate e generate.

## Tecnologias

- Node.js
- TypeScript
- npm
- Vitest
- Zod
- ts-morph
- Commander
- ESLint
- Prettier

## Instalação

Para desenvolver o próprio FormGen:

```bash
npm install
```

### Uso em outro projeto React

Instale o FormGen como dependência de desenvolvimento:

```bash
npm install --save-dev @lauanedev/formgen
npm install react-hook-form @hookform/resolvers zod
npm install --save-dev tailwindcss @tailwindcss/vite
```

Enquanto o pacote ainda não estiver publicado, também é possível gerar e instalar o pacote
local:

```bash
npm pack
npm install --save-dev caminho/para/lauanedev-formgen-0.1.1.tgz
```

Crie um arquivo `.form` e execute:

```bash
npx formgen generate forms/cadastro.form --output src/generated --runtime-only
```

Opcionalmente, `--assist` consulta a API pública do FormGen em
`https://formgen-xmg1.onrender.com`, apresenta cada sugestão no terminal e usa apenas as sugestões
aprovadas para gerar o React. A DSL original não é alterada e nenhum arquivo `.assistido.form` é
necessário. O serviço gratuito pode levar alguns segundos para despertar após um período sem uso.
Para indicar outra API:

```bash
npx formgen generate forms/cadastro.form --assist \
  --api-url https://api.formgen.exemplo \
  --output src/generated
```

Em automações sem terminal interativo, use `--accept-all`. A URL também pode ser definida
pela variável `FORMGEN_API_URL`.

O modo `--runtime-only` gera o componente TSX, o hook de validação e os componentes
acessíveis estilizados com classes Tailwind. Nenhum arquivo CSS específico do formulário
é gerado. O projeto consumidor precisa carregar o Tailwind, por exemplo com
`@import "tailwindcss";` em seu CSS global.
Sem essa opção, também são gerados a história do Storybook e o teste com jest-axe.

O formulário e o hook são gravados no diretório informado em `--output`. Os componentes
acessíveis compartilhados são instalados em `src/components/formgen`. Se o projeto usar
`src/componentes`, o FormGen reconhece essa pasta. Para escolher outro local:

```bash
npx formgen generate forms/cadastro.form \
  --output src/forms \
  --components-output src/ui/formgen \
  --runtime-only
```

Componentes compartilhados idênticos são reutilizados. Se um desses arquivos tiver sido
modificado, o FormGen não o sobrescreve sem a opção explícita `--force`.

## Execução

```bash
npm run dev -- compile caminho/arquivo.form
```

### Interface web

Crie um arquivo `.env` na raiz, sem enviá-lo ao Git, e configure:

```text
OPENAI_API_KEY=sua-chave
OPENAI_MODEL=seu-modelo
FORMGEN_AI_REQUESTS_PER_HOUR=10
```

A chave é lida apenas pelo servidor. Ela não é incluída no JavaScript enviado ao navegador
nem no pacote npm.

```bash
npm run web:dev
```

A interface fica disponível em `http://127.0.0.1:5173/` e oferece prévia responsiva,
visualização do JSON, exemplos, revisão das sugestões da IA e download dos arquivos React
em ZIP. O ZIP inclui os arquivos de produção, a DSL utilizada e instruções de instalação.

A IA só pode preencher lacunas identificadas pelo FormGen. Campos, rótulos, tipos,
obrigatoriedade e regras de validação não podem ser alterados pela resposta do modelo.

### API

Durante o desenvolvimento da interface, o Vite disponibiliza o mesmo contrato da API em
`/v1/assistance/suggestions`. Para executar a API independente:

```bash
npm run api:dev
```

Ela fica disponível em `http://127.0.0.1:8787/`. Os endpoints iniciais são:

```text
GET  /health
POST /v1/assistance/suggestions
POST /v1/generation/react
```

Para compilar e executar a versão de produção:

```bash
npm run api:build
npm run api:start
```

Em uma hospedagem Node.js, use `npm run api:build` como comando de build e `npm start`
como comando de inicialização. A API também reconhece as variáveis padrão `HOST` e `PORT`
fornecidas pela plataforma.

Quando a interface e a API estiverem em endereços diferentes, configure
`VITE_FORMGEN_API_URL` no build web e autorize a origem em `FORMGEN_ALLOWED_ORIGINS`.

## Sintaxe da DSL

```text
formulario "Nome do formulário"

descricao "Descrição"

campo nome {
  rotulo "Nome completo"
  tipo texto
  obrigatorio verdadeiro
  ajuda "Ajuda"
  placeholder "Digite"
}

botao {
  texto "Enviar"
}
```

## Tipos disponíveis

- texto
- email
- senha
- numero
- data
- telefone
- cpf
- cnpj
- textarea
- selecao
- checkbox

## Regras semânticas

- o identificador do campo deve usar apenas letras minúsculas, números e underscore;
- campos duplicados não são permitidos;
- minimo/maximo só podem ser usados em campos numéricos;
- tamanho_minimo/tamanho_maximo só podem ser usados em campos textuais;
- opcoes é obrigatório para selecao;
- valores booleanos aceitam verdadeiro e falso.

## Comandos da CLI

```bash
formgen compile arquivo.form
formgen compile arquivo.form --output resultado.json
formgen validate arquivo.form
formgen generate arquivo.form --output generated
formgen generate arquivo.form --assist --output generated
formgen generate arquivo.form --assist --accept-all --output generated
formgen generate arquivo.form --output src/forms --components-output src/ui/formgen
formgen generate arquivo.form --output generated --runtime-only
formgen generate arquivo.form --output generated --force
```

O comando `assist` continua disponível para quem quiser salvar uma DSL revisada em um
arquivo separado, mas ele não faz parte do fluxo principal de geração.

## Verificação da interface

Com o servidor web em execução:

```bash
npm run web:build
npm run web:verify
```

A verificação cobre desktop, celular, validação do formulário, gerenciamento de foco e
auditoria automatizada com axe-core.

## Testes

```bash
npm test
npm run scripts:check
```

Antes da suíte, o FormGen gera uma fixture React temporária a partir da DSL. O teste gerado
é executado com Testing Library, jsdom e jest-axe no estado inicial e após a validação,
além de verificar o foco no primeiro campo inválido.

## Storybook

```bash
npm run storybook
```

O FormGen gera histórias para os estados vazio, preenchido e com erros. O Storybook inclui
o painel oficial de acessibilidade, executa axe-core sobre cada história e permite revisar
interações, foco, teclado e diferentes dimensões de viewport.

Para validar a versão estática:

```bash
npm run build-storybook
```

Com o Storybook em execução na porta 6006, a verificação de navegador pode ser executada
com `npm run storybook:verify`. Ela abre os três estados, executa axe-core e confere
preenchimento, mensagens de erro e gerenciamento de foco.

## Estrutura do projeto

```text
src/
  ai/
  cli/
  lexer/
  parser/
  schema/
  validators/
  compiler/
  generator/
  utils/
tests/
web/
server/
```

## Limitações atuais

- os artefatos gerados precisam ser executados em um projeto React configurado;
- alterações fora das zonas seguras podem ser substituídas ao usar `--force`;
- a assistência de IA requer uma chave da OpenAI e um modelo configurado;
- o limite por IP é mantido em memória e deve migrar para armazenamento compartilhado ao
  executar mais de uma instância da API.

## Próximos passos

- publicação da API e da interface web;
- avaliação comparativa e auditoria com Lighthouse.

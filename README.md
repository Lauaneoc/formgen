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

Enquanto o pacote ainda não estiver publicado no npm, gere o pacote local:

```bash
npm pack
```

No projeto React que utilizará o formulário:

```bash
npm install --save-dev caminho/para/formgen-0.1.0.tgz
npm install react-hook-form @hookform/resolvers zod
npm install --save-dev tailwindcss @tailwindcss/vite
```

Crie um arquivo `.form` e execute:

```bash
npx formgen generate forms/cadastro.form --output src/generated --runtime-only
```

O modo `--runtime-only` gera o componente TSX, o hook de validação e os componentes
acessíveis estilizados com classes Tailwind. Nenhum arquivo CSS específico do formulário
é gerado. O projeto consumidor precisa carregar o Tailwind, por exemplo com
`@import "tailwindcss";` em seu CSS global.
Sem essa opção, também são gerados a história do Storybook e o teste com jest-axe.

## Execução

```bash
npm run dev -- compile caminho/arquivo.form
```

### Interface web

```bash
npm run web:dev
```

A interface fica disponível em `http://127.0.0.1:5173/` e oferece prévia responsiva,
visualização do JSON, exemplos e download da representação intermediária.

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
formgen generate arquivo.form --output generated --runtime-only
formgen generate arquivo.form --output generated --force
```

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
```

## Estrutura do projeto

```text
src/
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
```

## Limitações atuais

- os artefatos gerados precisam ser executados em um projeto React configurado;
- alterações fora das zonas seguras podem ser substituídas ao usar `--force`;
- o pacote ainda é privado e não foi publicado no npm;
- não há integração com APIs.

## Próximos passos

- download dos arquivos React em `.zip` pela interface;
- publicação do pacote no npm;
- assistência de IA com guardrails;
- avaliação comparativa e auditoria com Lighthouse.

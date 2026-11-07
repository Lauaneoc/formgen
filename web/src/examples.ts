export interface DslExample {
  id: string;
  name: string;
  source: string;
}

export const examples: DslExample[] = [
  {
    id: 'cadastro',
    name: 'Cadastro de cliente',
    source: `formulario "Cadastro de Cliente"

descricao "Formulário para cadastro de novos clientes"

campo nome {
  rotulo "Nome completo"
  tipo texto
  obrigatorio verdadeiro
  ajuda "Informe seu nome completo"
  placeholder "Digite seu nome"
  tamanho_minimo 3
}

campo email {
  rotulo "E-mail"
  tipo email
  obrigatorio verdadeiro
  ajuda "Utilize um endereço de e-mail válido"
}

campo idade {
  rotulo "Idade"
  tipo numero
  obrigatorio falso
  minimo 18
  maximo 120
}

campo estado {
  rotulo "Estado"
  tipo selecao
  obrigatorio verdadeiro
  opcoes ["Bahia", "São Paulo", "Minas Gerais"]
}

botao {
  texto "Cadastrar"
}`,
  },
  {
    id: 'login',
    name: 'Login',
    source: `formulario "Login"

descricao "Acesse sua conta"

campo usuario {
  rotulo "Usuário"
  tipo texto
  obrigatorio verdadeiro
}

campo senha {
  rotulo "Senha"
  tipo senha
  obrigatorio verdadeiro
  tamanho_minimo 8
}

botao {
  texto "Entrar"
}`,
  },
  {
    id: 'pesquisa',
    name: 'Pesquisa rápida',
    source: `formulario "Pesquisa de satisfação"

descricao "Conte como foi sua experiência"

campo avaliacao {
  rotulo "Nota"
  tipo numero
  obrigatorio verdadeiro
  minimo 1
  maximo 5
}

campo comentario {
  rotulo "Comentário"
  tipo textarea
  obrigatorio falso
  tamanho_maximo 300
  placeholder "Escreva seu comentário"
}

campo retorno {
  rotulo "Desejo receber retorno"
  tipo checkbox
  obrigatorio falso
}

botao {
  texto "Enviar avaliação"
}`,
  },
];

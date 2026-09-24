# Texto dos termos em preto (aceite e tela de informações)

Correção visual pontual. Nenhuma regra, dado, texto ou fluxo muda.

## Onde o texto dos termos aparece hoje

Só em duas telas do portal, e nas duas o corpo dos termos está em cinza
(`text-muted-foreground`, um tom médio que cansa a leitura):

- Aceite: `src/routes/sorteios-publico.termos.tsx` — cada seção (Regras, Como participar,
  Validade, Como será realizado, Informações, Prêmios, Outras condições).
- Informações: `src/routes/sorteios-publico.informacoes.tsx` — o cartão "Termos e condições",
  com as mesmas sete seções.

## O que muda

Uma cor nova e semântica só para o conteúdo dos termos, preta no portal, em vez de uma cor
solta no componente (assim o tema continua consistente e o modo escuro não quebra):

- `src/styles.css`: adicionar `--texto-termos` preto no tema claro, um tom claro equivalente no
  tema escuro, e registrá-la no bloco de tokens para gerar a classe de texto correspondente.
- `src/routes/sorteios-publico.termos.tsx`: título e texto de cada seção do termos passam a usar
  essa cor.
- `src/routes/sorteios-publico.informacoes.tsx`: idem, dentro do cartão dos termos.

Rótulos, subtítulos, situação, período, data do sorteio, valor por cupom e descrições de
prêmios continuam como estão (cinza) — o preto é apenas para o texto dos termos.

## Verificação

Typecheck e build, conferindo no CSS final que a classe dos termos resolve para preto.
As duas telas exigem sessão de participante válida, então a conferência visual no preview fica
com você: abrir o aceite e a tela "Informações do sorteio" e ver o texto dos termos preto.

## Fora do escopo

Termos administrados em Sorteios, aceite e auditoria, notas, cupons, saldo, painel,
cadastramento, administração de sorteios, WhatsApp, Bot, Z-API, Conexões e demais módulos.

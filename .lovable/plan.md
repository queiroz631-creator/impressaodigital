# Preparação da arquitetura de módulos

Etapa apenas estrutural: nenhuma funcionalidade nova, nenhuma regra de negócio alterada, nenhuma migration, nenhuma rota renomeada ou removida.

## Como o sistema está hoje

- O menu lateral é uma lista fixa dentro de `src/components/AppLayout.tsx` (11 itens, sem grupos), com um único controle de acesso: `adminOnly` em "Configurar Preços", resolvido por `useIsAdmin`.
- As páginas ficam todas em `src/routes` (arquivo por tela) e o login/sessão vem de `src/hooks/useAuth.tsx`.
- Já existem componentes compartilhados suficientes (botões, cards, diálogos, tabelas, `PageHeader`) — nada será duplicado.

## O que será feito

**1. Catálogo central de módulos (novo arquivo `src/lib/modulos.ts`)**

Um único lugar descrevendo grupos (Operação, Comunicação, Marketing, Administração) e, dentro deles, cada módulo com: identificador, nome, descrição, ícone, ordem, ativo, rota, chave de permissão do módulo e do item (ex.: `modulo.operacao`, `calculadora.visualizar`) e o tipo de acesso (administrativo ou público). É só configuração — nenhuma lógica de negócio.

**2. Menu agrupado, com o visual atual**

O menu passa a ser gerado por esse catálogo e ganha os títulos de grupo (OPERAÇÃO, COMUNICAÇÃO, MARKETING, ADMINISTRAÇÃO), mantendo exatamente o estilo, as cores, o contador de não lidas do WhatsApp, o botão Sair e o comportamento no celular. Dashboard continua acima dos grupos.

**3. Itens que ainda não têm página**

Catálogo, Sorteios, Promoções, Conexões e Usuários existem no catálogo como planejados e **não aparecem** no menu nesta etapa (ficam marcados como inativos), para não criar links quebrados. Quando cada página for criada, basta ligar o item.

**4. Preparação para permissões**

O menu passa a consultar uma única função de verificação que hoje devolve apenas a regra atual (administrador vê tudo; "Configurar Preços" só para administrador). Futuramente, essa função será ligada aos perfis de usuário sem tocar no menu.

**5. Preparação para isolamento e módulos públicos**

Criação de `src/modules/` apenas com a marcação dos espaços de cada módulo e um documento curto explicando a convenção (rotas, componentes, hooks e serviços por módulo) e a diferença entre módulo administrativo e módulo público. Nenhuma página existente será movida.

## Detalhes técnicos

- Novos arquivos: `src/lib/modulos.ts` (tipos + registro), `src/hooks/usePermissoes.ts` (wrapper sobre `useIsAdmin`, mesma regra de hoje), `src/modules/README.md` (convenção de isolamento e módulos públicos vs. administrativos).
- Modificado: `src/components/AppLayout.tsx` — a constante `itens` sai e o `nav` passa a iterar grupos do registro; markup e classes preservados.
- Rotas em `src/routes` só aceitam caminhos existentes na tipagem do roteador, então o registro guarda a rota como texto e o menu só renderiza itens ativos, mantendo o typecheck limpo.
- Sem alterações em banco, backend do WhatsApp, Z-API, Gemini, Storage, `.env` ou segredos.
- Ao final: typecheck e build, e conferência de que login, menu e as rotas atuais continuam funcionando.

## Ponto a confirmar depois

Quando Usuários/Conexões/Catálogo/Sorteios forem criados, decidir se as páginas nascem em `src/modules/<modulo>` com rotas finas em `src/routes` — é o caminho de menor risco e não exige mexer no que já funciona.

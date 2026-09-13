# Módulos

Convenção arquitetural para os futuros módulos do sistema. **Nenhuma página
existente foi movida** — esta pasta começa vazia e cada módulo ganha sua
estrutura apenas quando for efetivamente implementado.

## Convenção

Quando um módulo for criado, ele vive em `src/modules/<id>/` com seus
artefatos próprios, e a rota fina correspondente fica em `src/routes/`
(apenas registrando o caminho e importando a página do módulo):

```text
src/modules/<id>/
├── components/   # componentes do módulo
├── hooks/        # hooks do módulo
├── lib/          # serviços e regras do módulo (*.server.ts quando for servidor)
└── paginas/      # páginas importadas pelas rotas em src/routes/
```

O catálogo de módulos (id, nome, ícone, ordem, permissões, rota principal)
está em `src/lib/modulos.ts`; a verificação de permissões em
`src/hooks/usePermissoes.ts`.

## Administrativo vs. público

- **Módulos administrativos** (Operação, Comunicação, Administração): rodam
  dentro do painel, atrás do login, e usam o `AppLayout`.
- **Módulos públicos** (ex.: Catálogo, Sorteios — futuramente em subdomínios
  próprios): páginas sem login, com layout próprio e dados públicos.
  A distinção já está marcada no campo `acesso` de cada módulo em
  `src/lib/modulos.ts`, mas nenhuma página pública será criada nesta etapa.

## Regras

- Não criar pastas vazias aqui: cada módulo só ganha estrutura na sua
  implementação.
- Um módulo não importa código interno de outro módulo; o compartilhado
  fica em `src/components/`, `src/hooks/` e `src/lib/`.
- Cada módulo terá suas próprias tabelas e permissões (`modulo.<id>` e
  `<item>.visualizar`), ligadas ao sistema de usuários/perfis futuro.

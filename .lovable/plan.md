# Aba "Chave Key" em Administração › Configurações

## O que o usuário verá

Uma nova aba **Chave Key** ao lado de Empresa, PIX e prazo, Impressão, Link do orçamento e IA.

Nela, um primeiro cartão: **Chave Key sincronização**

- Campo **Chave** (mostrado oculto, com botão para revelar e botão para copiar).
- Campo **URL base do sistema** (ex.: `https://impressaodigital.lovable.app`) usada junto com essa chave.
- Botão **Gerar chave** (cria uma chave aleatória forte na hora) e botão **Salvar**.
- Botão **Copiar dados de conexão**, que copia chave + URL prontos para colar no app de sincronização da loja.
- Aviso de quando foi salva pela última vez e por quem.

A aba já nasce preparada para receber outras chaves do sistema no futuro (a lista é montada a partir de um cadastro de chaves, não de campos fixos).

Acesso restrito a quem tem permissão de gestão, como as outras abas de Administração.

## Como a chave passa a valer

O app de sincronização hoje é autenticado por uma chave guardada na configuração do servidor. Depois dessa mudança, a chave salva nesta tela passa a ser a válida; a chave antiga do servidor continua aceita como reserva, para o app da loja não parar antes de ser atualizado.

## Detalhes técnicos

- Migração nova: tabela `public.sistema_chaves` (`id`, `nome` único, `valor`, `url_base`, `atualizado_em`, `atualizado_por`), `GRANT` para `authenticated`/`service_role`, RLS habilitada, política de leitura/escrita só para `has_role(auth.uid(),'admin')` ou `tem_permissao(...,'gestao')` conforme o padrão já usado nas outras tabelas de configuração. Linha inicial `sincronizacao` inserida vazia. Mesma migração gravada em `supabase/migrations/` com nome datado.
- `src/lib/sistema-chaves.functions.ts`: `estadoChaves` (devolve URL, últimos 4 dígitos e data — nunca a chave completa em listagem), `verChave` (devolve o valor completo, exige gestão), `salvarChave`, `gerarChave` — todas com `requireSupabaseAuth` e checagem de permissão, gravando com `supabaseAdmin` importado dentro do handler.
- `src/components/ConfiguracaoChaves.tsx`: componente da aba, no mesmo padrão de `ConfiguracaoIA.tsx` (react-query + `useServerFn` + sonner).
- `src/routes/configuracoes.tsx`: novo `TabsTrigger value="chaves"` + `TabsContent` renderizando o componente.
- `src/lib/sorteios-sync-token.server.ts`: `tokenLojamixSyncValido` passa a ser assíncrona — lê `sistema_chaves.valor` de `sincronizacao` e compara em tempo constante; se não houver chave salva, cai para `LOJAMIX_SYNC_TOKEN`. Os chamadores em `src/routes/api/public/sorteios/sync/*` passam a usar `await`.
- Nada é registrado em log e nenhuma rota pública devolve a chave.

# FOTO EXPRESS — correção técnica da primeira entrega

## Objetivo
Corrigir exclusivamente os oito pontos da auditoria, sem iniciar editor, revisão, montagem, renderização, PDF/JPG ou portal do cliente. Não atualizar dependências, não criar dados de teste e não publicar.

## Correções no banco
Criar uma migration incremental e não destrutiva, aplicada pelo fluxo oficial e espelhada com o mesmo SQL em `supabase/migrations/`, contendo:

1. **Datas de atualização**
   - Criar uma função de trigger exclusiva do FOTO EXPRESS que escreva em `atualizado_em`.
   - Substituir somente os cinco triggers incorretos de formatos, trabalhos, itens, configurações e textos.
   - Manter a função global `set_updated_at` intacta.

2. **Coerência entre item e arquivo**
   - Adicionar unicidade composta em arquivo `(id, trabalho_id)`.
   - Adicionar FK composta em item `(arquivo_id, trabalho_id)` para impedir qualquer associação entre trabalhos diferentes.
   - Manter as FKs atuais e validar a nova regra sobre os dados existentes; a leitura confirmou que atualmente há 0 vínculos incoerentes.

3. **Fila de limpeza do Storage**
   - Criar uma tabela técnica `foto_express_limpezas_storage`, fechada por RLS e acessada apenas pelas funções autorizadas, para registrar original/thumbnail, motivo, tentativas, situação e último erro.
   - Incluir `GRANT` explícito para `service_role`, RLS habilitada e nenhum acesso direto do navegador.
   - Criar funções `SECURITY DEFINER`, com `search_path` fixo e verificação de `foto_express.fotos.enviar` ou `foto_express.fotos.excluir`, para:
     - registrar upload e criar arquivo + item de forma atômica;
     - excluir itens selecionados sob bloqueio de linha;
     - detectar com segurança se o arquivo ainda possui referências;
     - mover arquivos sem referências para a fila antes de remover o registro ativo;
     - concluir ou registrar falha da limpeza após a tentativa no Storage.
   - Bloquear concorrência entre duplicação/inserção e exclusão por meio de locks no registro do arquivo e validação dentro da transação.

## Storage
- Preservar os três buckets e todos os objetos existentes.
- Confirmar/configurar idempotentemente, pela administração nativa do Storage:
  - `foto-express-originais`: privado, 20 MB, JPG/PNG/WEBP;
  - `foto-express-thumbnails`: privado, 2 MB, JPG/PNG/WEBP;
  - `foto-express-impressoes`: privado, 100 MB.
- A leitura atual confirmou que os três buckets já existem, estão privados e têm os limites corretos; falta apenas a restrição de tipos.
- Espelhar a criação idempotente e os mesmos limites/tipos no provisionamento de Storage da VPS, sem apagar ou recriar buckets.

> A plataforma não permite inserir ou atualizar `storage.buckets` por migration SQL. Por isso, a migration oficial conterá as regras, funções e fila do banco; a existência/configuração dos buckets será garantida pela API nativa do Storage e pelo script idempotente de provisionamento da VPS. Isso evita uma migration inválida sem reduzir a garantia pedida.

## Fluxos seguros

### Upload
1. O navegador valida e envia original e thumbnail, mantendo o progresso atual.
2. Uma função autenticada no servidor registra arquivo + item por uma única função transacional do banco.
3. Se a criação do item falhar, a operação não deixa registro ativo: cria uma limpeza pendente e tenta remover ambos os objetos.
4. Falhas de remoção ficam registradas para nova tentativa e são informadas na tela; nada fica órfão silenciosamente.

### Exclusão
1. A tela envia apenas os IDs selecionados para uma função autenticada no servidor.
2. O banco valida a permissão, bloqueia os arquivos envolvidos e exclui os itens em uma transação.
3. Arquivo ainda compartilhado permanece intacto.
4. Arquivo sem referências sai da tabela ativa e entra na fila de limpeza na mesma transação.
5. Somente depois do commit o servidor remove original e thumbnail; sucesso conclui a fila, falha permanece registrada para repetição.
6. O navegador deixa de contar referências ou apagar diretamente registros/objetos.

## Interface e permissões
- Em **Formatos**, continuar permitindo leitura a quem possui `foto_express.visualizar`.
- Mostrar “Novo formato”, editar e ativar/desativar somente para quem possui `foto_express.formatos.gerenciar` (administradores continuam liberados pelo mecanismo atual).
- Manter as políticas RLS como autoridade final; esconder controles não substitui a proteção do banco.
- Restaurar exclusivamente `errorComponent: ErrorComponent` na configuração global, sem alterar a tela ou outro comportamento global.

## Arquivos previstos
- Nova migration incremental criada pelo gerenciador da plataforma e cópia SQL idêntica em `supabase/migrations/`.
- Novo módulo de funções autenticadas do FOTO EXPRESS para upload, exclusão e limpeza.
- `src/modules/foto-express/paginas/GaleriaPagina.tsx`: usar os fluxos seguros e mostrar falhas de limpeza.
- `src/modules/foto-express/paginas/FormatosPagina.tsx`: aplicar a permissão de gerenciamento aos controles.
- `src/routes/__root.tsx`: restaurar apenas o componente global de erro.
- `deploy/corrigir-storage.sql` e/ou script de provisionamento equivalente: incluir os buckets do FOTO EXPRESS de forma idempotente para a VPS.
- Tipos gerados do banco, `roadmap.md` e `AGENTS.md` apenas no necessário para registrar a fila e o fluxo transacional.

## Verificações
- Confirmar os novos triggers e testar que `atualizado_em` muda sem erro.
- Confirmar a FK composta e a rejeição de item/arquivo de trabalhos distintos usando transação revertida, sem deixar dados de teste.
- Confirmar bucket privado, limite e tipos aceitos; nenhum objeto existente será removido.
- Validar upload normal e simular falha na criação do item, verificando limpeza ou pendência registrada.
- Validar exclusão de item único e de duplicações lógicas: compartilhado permanece; último item gera limpeza pós-commit.
- Simular falha de Storage e confirmar que a pendência fica registrada e pode ser repetida.
- Validar Formatos com permissão de leitura e com permissão de gerenciamento.
- Conferir desktop e celular, typecheck/build automáticos e logs do preview.
- Confirmar que `package.json`, lockfiles e versões de pacotes permaneceram inalterados.
- Não executar limpeza no banco de produção, não criar dados permanentes e não fazer deploy/publicação.

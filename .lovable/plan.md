# Currículo Vitae — novo módulo

Novo módulo integrado ao sistema atual (mesmo layout, menu, autenticação e tabela de clientes já existente). Nenhuma funcionalidade atual é removida.

## Como o cliente e o currículo se relacionam

- A tabela `clientes` continua exatamente como está: o telefone permanece único e é o cadastro de contato.
- O CPF fica na tabela de currículos, não no cliente.
- Um mesmo cliente (mesmo telefone) pode ter vários currículos — por exemplo, familiares que usam o mesmo número.
- Cada currículo tem um CPF diferente: o CPF é único entre os currículos e é o que identifica a pessoa do currículo.
- O atendimento por WhatsApp continua funcionando como hoje, sem alteração.

## Banco de dados

- `curriculos`: `cliente_id` (vários currículos por cliente), `cpf` único (somente números), status rascunho/completo, dados pessoais, documentação, habilitação, escolaridade, objetivo, exibir data de atualização, `created_at`/`updated_at`/`completed_at`.
- `curriculo_telefones`, `curriculo_cursos`, `curriculo_experiencias`: listas ordenáveis ligadas ao currículo.
- `habilidades_curriculo` (catálogo, já com as 3 habilidades padrão) e `curriculo_habilidades` (seleção por currículo, incluindo habilidades personalizadas).
- `curriculo_links`: token aleatório seguro, `expires_at` (24h), `ativo`, `used_at`.
- Nenhuma alteração em `clientes` além do reaproveitamento do cadastro existente.
- Acesso: leitura/escrita apenas para usuários autenticados; o link público não usa acesso direto ao banco, e sim funções de servidor que validam o token.


## Telas

**Menu lateral**: novo item "Currículo Vitae" (ícone de documento), entre Orçamentos e Histórico.

**Listagem `/curriculos`**: título "CURRÍCULO VITAE", subtítulo "Gerencie os currículos cadastrados dos clientes". Colunas Nome, Telefone principal, Data de nascimento, Última alteração, Ações. Pesquisa em tempo real por nome, telefone ou CPF (busca no banco), filtro Todos/Rascunhos/Completos, ordenação por nome, nascimento ou última alteração (padrão: última alteração desc), paginação de 20 por página, cards no mobile. Botão "+ NOVO CURRÍCULO".

**Formulário em 8 etapas** (mesmo componente para criar e editar, com indicador de progresso):
1. Dados pessoais — Nome*, CPF*, Telefone principal*, telefones adicionais, nascimento, estado civil, e-mail. Ao avançar, o CPF é validado; se já existir cliente, mostra "Cliente encontrado." e preenche nome/telefone; se já houver currículo, oferece abrir/continuar. Caso contrário cria cliente + currículo em RASCUNHO imediatamente.
2. Documentação — possui documentação completa (Sim/Não) e habilitação com categorias A/B/AB/C/D/E.
3. Escolaridade — lista fixa; campo Curso aparece nas opções de Ensino Superior.
4. Cursos complementares — vários, curso* e instituição opcional, editar/remover.
5. Experiência profissional — várias: empresa, cargo, período (com exemplos de formato) e atividades.
6. Objetivo — sugerido (lista configurável), personalizado ou não informar.
7. Habilidades — checkboxes do catálogo + criar nova habilidade.
8. Revisão — prévia por seção com botão Editar que volta à etapa, switch "Exibir data da última atualização" (padrão desligado) e "Salvar currículo" (marca COMPLETO e grava `completed_at`).

Cada etapa salva no banco ao avançar; fechar e reabrir continua de onde parou.

**Ver detalhe**: currículo completo renderizado no padrão profissional A4, sem seções vazias e sem CPF.

**Imprimir / Gerar PDF**: layout A4 limpo (nome, contatos, objetivo, formação, cursos, experiência, habilidades, informações adicionais, e a data de atualização só quando ativada). Usa a mesma base de impressão e o jsPDF já presentes no sistema. Ambas exigem usuário autenticado.

**Enviar WhatsApp**: diálogo com cliente, telefone e mensagem editável; o PDF é gerado, guardado no armazenamento privado e enviado pela integração Z-API existente. Sem telefone: "Este cliente não possui telefone cadastrado." Confirmação antes do envio.

**Gerar link para o cliente**: cria token seguro válido por 24h (invalida o anterior), mostra "Link válido até ..." e botão copiar.

## Link público `/curriculo/publico/$token`

Página enxuta com nome da empresa, "Preencha seu currículo", indicador "Etapa X de 7" e as mesmas 7 etapas de preenchimento (sem revisão administrativa), salvando a cada avanço. Nunca exibe CPF, nem botões de imprimir/PDF/WhatsApp. Token expirado mostra "Este link expirou. Solicite um novo link ao atendimento."

## Segurança

- Toda leitura/escrita pública passa por funções de servidor que validam token ativo e não expirado e trabalham apenas com o currículo daquele token — o cliente não pode trocar ids pela URL nem alterar `cliente_id`, `status`, datas ou token.
- PDF, impressão, envio por WhatsApp, listagem e geração de link só existem em rotas autenticadas; não há URL pública de PDF/impressão/download.
- CPF nunca aparece em currículo, prévia, impressão, PDF, imagem, WhatsApp ou link público — apenas no formulário administrativo.
- Alteração de CPF para um já usado por outro cliente é bloqueada: "Este CPF já está cadastrado para outro cliente."
- Auditoria: ações relevantes (criar, editar, gerar link, invalidar link, enviar WhatsApp) registradas com usuário, currículo, ação e data/hora.

## Detalhes técnicos

- Migração única: coluna `cpf` + índice único parcial em `clientes`, remoção de `clientes_telefone_normalizado_key`, novas tabelas com GRANTs e RLS, seed das habilidades padrão e dos objetivos sugeridos.
- Rotas novas: `src/routes/curriculos.tsx` (lista), `src/routes/curriculos.$id.tsx` (formulário/detalhe) e `src/routes/curriculo.publico.$token.tsx`.
- Server functions: `src/lib/curriculo.functions.ts` (administrativo, com `requireSupabaseAuth`) e `src/lib/curriculo-publico.functions.ts` (token-based, sem auth) apoiadas por `curriculo.server.ts`.
- PDF em `src/lib/curriculo-pdf.ts` (jsPDF, A4) e impressão via o serviço de impressão existente.
- Ajuste em `src/routes/api/public/whatsapp/webhook.ts` e `src/lib/bot.server.ts` para tratar múltiplos clientes com o mesmo telefone pedindo o CPF.
- Após implementar: verificação de tipos, RLS, constraints e testes de ponta a ponta (criação por etapas, continuidade, link expirado, bloqueio de PDF/impressão pelo link).

# Aba "Fluxos" no Bot (substitui "Menu principal")

Transformar a aba **Menu principal** da página `/bot` em **FLUXOS**: um construtor de conversas onde o administrador cria fluxos, etapas e opções sem alterar código. Nada mais da página muda (Geral, Horários, Mensagens, Respostas, Inatividade, Simulador continuam iguais), e os módulos existentes (calculadora, currículo, pedidos, atendimento humano, Z-API) continuam sendo usados como estão.

## O que existe hoje (verificado)

- A aba "Menu principal" edita `bot_menu_opcoes` (nome, ação fixa, mensagem, ordem, palavras-chave em `bot_palavras_chave`).
- O motor (`src/lib/bot-motor.ts`) é uma máquina de estados fixa: saudação → menu → confirmação → ação.
- O fluxo de orçamento é código fixo em `src/lib/bot.server.ts` (arquivos → tipo → formato → material → cópias → frente/verso → acabamento → cálculo com `src/lib/calc.ts`), e existem as ações currículo, consultar pedido e transferir para atendente.

## Banco (3 tabelas novas, nada é removido)

- `bot_fluxos`: nome, descrição, ícone, mensagem inicial, ativo, ordem, é_inicial.
- `bot_fluxo_etapas`: fluxo_id, nome, ordem, mensagem, tipo_resposta, ação, configuração (jsonb), próxima_etapa_id, ativo.
- `bot_fluxo_opcoes`: etapa_id, título, valor, ordem, ação, destino_fluxo_id, destino_etapa_id, configuração, ativo.

As opções de menu atuais (`bot_menu_opcoes`) são migradas na mesma migração para um fluxo padrão **Atendimento Inicial** (uma opção por card, apontando para o fluxo correspondente), marcado como fluxo inicial. Também são criados os fluxos padrão **Fazer Orçamento**, **Consultar Pedido**, **Currículo** e **Falar com Atendente**, cada um com as etapas equivalentes ao que o bot já faz hoje. Nada de dado fictício: só o que já existia.

## Tela (aba FLUXOS)

- Cabeçalho "FLUXOS — Configure as conversas que o Bot poderá realizar" + botão destacado **+ ADICIONAR FLUXO** e o seletor **Fluxo inicial**.
- Cards por fluxo: ícone, nome, descrição, contagem de etapas/opções, selo Ativo/Inativo e botões **CONFIGURAR**, **EDITAR**, **DUPLICAR**, **ATIVAR/DESATIVAR**, **EXCLUIR**.
- **Novo/Editar fluxo** (dialog): nome*, descrição, ícone, mensagem inicial, ativo. Após criar, abre direto o configurador.
- **Configurar fluxo**: lista vertical das etapas (nome, tipo de resposta, ação, próxima etapa) com editar, mover ↑↓, excluir e **+ ADICIONAR ETAPA**; dentro da etapa, lista de opções com título, ação, destino, editar/excluir/↑↓ e **+ ADICIONAR OPÇÃO**.
- **Visualização**: lista vertical INÍCIO → etapas → FINALIZAR na aba "Visualização" do configurador.
- **TESTAR FLUXO**: abre o simulador já existente, iniciado nesse fluxo, sem enviar nada pelo WhatsApp.
- Exclusão bloqueada quando o fluxo é destino de outro: mensagem "Este fluxo está sendo utilizado por outros fluxos e não pode ser excluído", com a lista de quem usa e a opção de desativar.
- Fluxos inativos não aparecem como destino nem são iniciados pelo bot; atendimentos em andamento continuam.

## Tipos de resposta e ações

Tipos: Nenhuma, Texto, Número, Arquivo, CPF, Nome, Telefone, Sim/Não, Escolha de opção, Confirmação.

Ações: Enviar mensagem, Aguardar resposta, Salvar informação, Receber arquivo, Analisar arquivos, Contar páginas, Iniciar orçamento, Consultar pedido, Iniciar currículo, Gerar link, Enviar orçamento, Transferir para atendente, Criar atendimento pendente, Iniciar fluxo, Voltar ao início do fluxo, Finalizar atendimento.

Cada ação chama o módulo existente (calculadora, currículo, pedidos, links, fila humana). O orçamento continua sendo calculado pela calculadora atual — nenhum cálculo novo.

## Motor

- O bot passa a executar o fluxo inicial configurado; cada mensagem avança a etapa atual gravada no contexto da conversa.
- Uma etapa envia sua mensagem (com botões quando a Z-API suportar, senão lista numerada), aguarda a resposta conforme o tipo, executa a ação e segue para a próxima etapa, outra etapa, outro fluxo, atendimento humano ou finalização.
- Ações que hoje são código (orçamento, currículo, pedido, atendente) continuam entrando pelos mesmos pontos de `bot.server.ts`; quando um fluxo delega ao orçamento, a máquina de estados atual assume até terminar e devolve o controle ao fluxo.
- Respostas automáticas, horários, saudação diária, inatividade e finalização continuam funcionando como hoje.

## Detalhes técnicos

- Migração nova com RLS + GRANTs no padrão do projeto e seed a partir de `bot_menu_opcoes`; `bot_menu_opcoes`/`bot_palavras_chave` permanecem (usadas por palavras-chave/respostas).
- Novos arquivos: `src/components/bot/FluxosPainel.tsx`, `FluxoDialog.tsx`, `FluxoConfigurador.tsx`, `EtapaDialog.tsx`, `OpcaoDialog.tsx`, `src/lib/bot-fluxos.ts` (tipos + catálogo de tipos/ações, puro), `src/lib/bot-fluxos.functions.ts` (CRUD/duplicação autenticados).
- Alterados: `src/components/ConfiguracaoBot.tsx` (aba renomeada e novo painel), `src/lib/bot-motor.ts` (execução por fluxo), `src/lib/bot-dados.server.ts` (carregar fluxos), `src/lib/bot.server.ts` (despacho das ações), `src/lib/bot.functions.ts` (simulador por fluxo).
- Sem dados mockados; ao final, verificação de TypeScript/build e relatório com arquivos alterados/criados, estrutura de banco e o passo a passo de criar fluxo, etapas, opções, destino para outro fluxo, fluxo inicial e teste.

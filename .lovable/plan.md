# Corrigir troca de conexão na Configuração do Bot

## Resultado

- Ao trocar a conexão no topo da página **Configuração do Bot**, todas as abas passam a mostrar e alterar somente o bot da conexão escolhida.
- A conexão selecionada terá um indicador visual com a cor cadastrada, tanto no campo fechado quanto na lista de opções.
- A troca continuará disponível apenas conforme as permissões atuais: administrador escolhe a conexão; atendente usa somente a conexão vinculada.

## Correção do isolamento

Hoje, **Geral**, **Horários** e parte de **Inatividade** já consultam a conexão escolhida. Porém, **Fluxos**, **Primeiro contato**, **Respostas automáticas**, **Números**, **Status WhatsApp** e **Simulador** ainda consultam dados sem informar a conexão, fazendo parecer que o bot não mudou.

A correção irá:

- repassar a conexão selecionada para todos esses painéis;
- incluir a conexão nas chaves de atualização da tela, para recarregar imediatamente ao trocar;
- filtrar todas as consultas pela conexão atual;
- gravar `conexao_id` ao criar novos fluxos, regras, respostas, números e publicações de status;
- manter etapas, opções e palavras-chave limitadas aos registros pertencentes aos fluxos ou respostas da conexão escolhida;
- limpar formulários e edições abertas ao trocar de conexão, evitando salvar algo iniciado em outra conexão;
- enviar a conexão atual ao simulador, para ele testar exatamente o bot selecionado.

## Indicador de cor

- Exibir um pequeno círculo com a cor cadastrada ao lado do nome da conexão.
- Mostrar o círculo no seletor fechado e em cada opção da lista.
- Manter nome e telefone atuais, sem mudar o restante do visual da página.

## Detalhes técnicos

- `ConfiguracaoBot` será a fonte única da conexão atual e passará `conexaoId` aos painéis internos.
- As consultas usarão chaves no formato `[..., conexaoId]` e filtros por `conexao_id` ou pelos IDs pais já filtrados.
- `simularBot` e `simularFluxo` receberão a conexão validada e carregarão os dados correspondentes.
- As ações existentes de editar, duplicar, ordenar e excluir permanecerão, mas restritas aos registros já carregados da conexão atual.
- Nenhuma alteração em credenciais, webhook, conversas, permissões ou outros módulos.
- Não será necessária alteração no banco: as tabelas envolvidas já possuem o vínculo necessário, direto ou por relacionamento.

## Verificação

- Alternar entre **Impressão Digital** e **Queiroz Papelaria** e confirmar que Geral, Horários, Fluxos, Primeiro contato, Respostas, Números, Status e Simulador mudam juntos.
- Confirmar que uma conexão sem cadastros mostra listas vazias, sem reutilizar dados da outra.
- Criar um registro temporário em cada tipo necessário, conferir o vínculo correto e removê-lo após o teste.
- Validar o indicador de cor em tela larga e estreita.
- Executar verificação de tipos, lint e build.
- Não fazer commit nem push.

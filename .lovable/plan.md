# Corrigir troca de conexão e proteger a Configuração do Bot

## Resultado

- Ao trocar a conexão no topo da página **Configuração do Bot**, todas as abas mostrarão e alterarão somente o bot da conexão escolhida.
- O seletor mostrará um círculo com a cor cadastrada ao lado do nome da conexão, no campo fechado e em cada opção.
- Nenhuma leitura ou alteração confiará apenas na conexão enviada pela tela.

## Problema confirmado

- **Geral**, **Horários** e parte de **Inatividade** já filtram pela conexão escolhida.
- **Fluxos**, **Primeiro contato**, **Respostas automáticas**, **Números**, **Status WhatsApp** e **Simulador** ainda fazem consultas gerais ou usam a primeira configuração encontrada.
- As regras atuais do banco para várias tabelas do bot permitem acesso amplo a qualquer usuário autenticado. Portanto, somente acrescentar filtros na tela não atenderia à segurança solicitada.
- As tabelas já possuem `conexao_id` direto ou relacionamento com um registro pai que possui esse vínculo.

## Autorização obrigatória no servidor

Criar um ponto central de validação para toda operação do bot:

1. validar a sessão autenticada;
2. consultar o papel real em `user_roles` por `has_role`;
3. confirmar que a conexão recebida existe e está autorizada;
4. permitir ao administrador a conexão válida conforme as regras administrativas;
5. permitir ao atendente somente a conexão vinculada em `profiles.conexao_id`, com perfil ativo;
6. rejeitar qualquer `conexaoId` diferente antes de consultar ou alterar dados.

Todas as leituras, criações, edições, duplicações, ordenações e exclusões da Configuração do Bot passarão por funções protegidas no servidor. Em operações sobre etapas, opções, palavras-chave ou IDs existentes, o servidor também confirmará que o registro pai pertence à conexão autorizada. IDs e `conexao_id` enviados pela tela nunca serão considerados prova de acesso.

## Isolamento completo por conexão

Aplicar a conexão validada em:

- configuração geral, horários e inatividade;
- fluxos, etapas e opções;
- regras de primeiro contato;
- respostas automáticas e palavras-chave;
- números atendidos pelo bot;
- publicações e agenda do Status WhatsApp;
- simulador do bot e simulador de fluxos.

Ao criar novos registros, o servidor gravará o `conexao_id` autorizado. Ao trocar de conexão, a tela limpará formulários, edições e estado do simulador, mudará as chaves de atualização e recarregará todos os painéis.

## Proteção no banco

Criar uma migration versionada para substituir as regras amplas atuais das tabelas do bot por regras por conexão:

- administrador autorizado pode acessar os registros permitidos;
- atendente ativo acessa somente registros da conexão vinculada;
- etapas e opções são protegidas pela conexão do fluxo pai;
- palavras-chave são protegidas pela conexão da resposta/opção pai;
- `WITH CHECK` impede inserir ou mover registros para outra conexão.

A camada do banco será uma segunda proteção; a validação explícita no servidor continuará obrigatória.

## Indicador visual

- Mostrar um pequeno círculo com `conexao.cor` ao lado do nome.
- Preservar o nome, telefone, tamanho e disposição atual do seletor.
- Não alterar o restante do visual da página.

## Verificação

- Administrador: alternar entre **Impressão Digital** e **Queiroz Papelaria** e confirmar que todas as abas e simuladores mudam juntas.
- Atendente: confirmar acesso somente à conexão vinculada.
- Segurança: tentar enviar manualmente o ID da outra conexão em leitura, criação, edição, duplicação, ordenação e exclusão; todas devem retornar erro de autorização sem alterar dados.
- Confirmar no banco que registros criados ficam vinculados à conexão correta e remover os dados temporários de teste.
- Validar o indicador de cor em tela larga e estreita.
- Executar verificação de tipos, lint e build.
- Não alterar credenciais, webhooks, conversas ou outros módulos; não fazer commit nem push.

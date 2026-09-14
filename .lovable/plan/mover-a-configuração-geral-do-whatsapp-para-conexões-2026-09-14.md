# Mover a configuração geral do WhatsApp para Conexões

## Resultado

- Remover a aba **WhatsApp** da página **Configurações** do módulo administrativo.
- Levar o campo **Endereço do sistema** para a página **Conexões**.
- Adicionar, ao lado de **Nova conexão**, um botão **Configuração** que abre uma janela.
- A janela permitirá informar o endereço, salvar e usar o endereço atual, mantendo os avisos já existentes.
- Remover os botões **Abrir Conexões** e **Abrir Configuração do Bot**; eles não serão recriados na nova janela.

## Regras preservadas

- O endereço continuará sendo salvo no mesmo campo `whatsapp_config.app_url`.
- Nenhuma conexão, credencial, webhook ou configuração do bot será alterada ao abrir ou salvar a janela.
- As ações dos cartões de conexão e a página de Configuração do Bot permanecem como estão.
- Nenhuma alteração no banco e nenhuma migration.

## Detalhes técnicos

- Extrair a interface do endereço para um componente reutilizável em `src/modules/comunicacao/conexoes/`.
- Abrir esse componente em um `Dialog` controlado por `ConexoesPainel.tsx`, acionado pelo novo botão ao lado de **Nova conexão**.
- Remover de `src/routes/configuracoes.tsx` a aba WhatsApp, o cartão antigo e os imports que ficarem sem uso.
- Manter a consulta e a gravação atuais de `app_url`, inclusive o tratamento de erro e a opção **Usar este endereço**.

## Verificação

- Conferir que **Configurações** mantém as demais abas sem mudanças.
- Conferir que **Conexões → Configuração** abre, carrega, salva e fecha corretamente.
- Confirmar que os dois botões removidos não aparecem mais.
- Executar verificação de tipos, lint e build, além da conferência visual em telas larga e estreita.
- Não fazer commit nem push.

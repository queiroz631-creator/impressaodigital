# Liberar manualmente o site no QZ Tray

## Diagnóstico confirmado

O QZ Tray está instalado, ativo e recebendo a chamada `connect`. A integração atual não configura `setCertificatePromise` nem `setSignaturePromise`, então o QZ identifica o acesso como **An anonymous request** e mostra **Invalid Certificate**. Isso não é falha de porta ou da impressora.

## Procedimento no computador da loja

1. Fechar a janela **Details** mostrada na imagem.
2. Voltar ao aviso principal de autorização do QZ Tray.
3. Marcar **Remember this decision / Lembrar esta decisão**.
4. Clicar em **Allow / Permitir**.
5. Manter o QZ Tray aberto na bandeja do Windows.
6. No sistema, abrir **Configurações → Impressão**, clicar em **Reconectar/Buscar impressoras** e executar o teste.

## Se a decisão anterior foi bloqueada

1. Abrir o menu do ícone do QZ Tray na bandeja do Windows.
2. Entrar no gerenciador de sites/autorização.
3. Remover a decisão bloqueada para `calculadoraimpressao.lovable.app` e, se usado, para o endereço de preview.
4. Recarregar o sistema e aceitar novamente, marcando a opção para lembrar.

## Limitação aceita

Essa solução vale somente para o computador e perfil do Windows onde a permissão foi salva. O alerta **Invalid Certificate** pode continuar aparecendo nos detalhes porque o sistema seguirá sem certificado assinado, mas a impressão direta poderá funcionar após a autorização persistente. Limpar ou reinstalar as configurações do QZ exigirá nova autorização.

## Validação

- Confirmar que o status muda para **QZ Tray conectado**.
- Confirmar que as impressoras locais aparecem na busca.
- Enviar uma etiqueta térmica de teste e verificar que não abre a caixa de impressão do navegador.

# QZ Tray conecta e depois cai sozinho

## O que foi verificado

Na integração atual (`src/lib/impressora.ts`) a conexão é aberta uma única vez e nada monitora o socket depois disso:

- não há nenhum tratador de fechamento (`websocket.setClosedCallbacks` / `setErrorCallbacks`);
- não há keep-alive: se a página fica ociosa (ou o navegador suspende a aba), o agente encerra a sessão por inatividade e o sistema só descobre na hora de imprimir;
- a tela de Configurações consulta o status apenas uma vez ao montar (`useEffect` sem intervalo), então o indicador continua "conectado" mesmo depois da queda;
- quando o socket cai, `conectarQz()` até tenta de novo, mas o estado interno (`conexaoEmAndamento`, `ultimoErro`) não é limpo, e a impressão falha em vez de reabrir a conexão.

## Correções

### 1. Detectar a queda em vez de ignorá-la
- Registrar tratadores de fechamento e de erro do socket do QZ logo após conectar.
- Ao detectar queda: limpar o estado interno de conexão, guardar o motivo real (fechamento normal, timeout, agente encerrado) e disparar um evento que a interface possa ouvir.

### 2. Manter a conexão viva
- Enviar um "ping" leve ao agente em intervalo regular (chamada pública de versão) enquanto a página estiver visível; parar quando a aba fica em segundo plano e retomar ao voltar.
- Reconectar automaticamente após uma queda, com poucas tentativas espaçadas, sem abrir sockets em paralelo.

### 3. Reconectar na hora de imprimir
- Antes de cada impressão (etiqueta, teste e perfis de documento), confirmar que o socket está realmente pronto; se não estiver, reconectar e só então enviar — em vez de cair direto para a janela do navegador.

### 4. Status ao vivo em Configurações → Impressão
- O indicador passa a refletir a queda em tempo real (ouvindo o evento acima e revalidando periodicamente enquanto a aba estiver visível).
- Mostrar o motivo da desconexão e manter o botão "Reconectar/Buscar impressoras".

## Detalhes técnicos
- `src/lib/impressora.ts`: callbacks `websocket.setClosedCallbacks`/`setErrorCallbacks`, heartbeat com `setInterval` + `visibilitychange`, reset de `conexaoEmAndamento`, reconexão com backoff, `garantirConexao()` usada por `imprimirViaQz`, `imprimirDocumentos` e `testarPerfil`, e um `assinarQueda`/`CustomEvent` para a interface.
- `src/routes/configuracoes.tsx`: assinar o evento de queda, revalidar status periodicamente, exibir motivo.
- `src/components/ImprimirEtiqueta.tsx`: revalidar o status ao abrir o diálogo.

## Fora do escopo
- Certificado assinado do QZ Tray (segue como solicitação anônima autorizada manualmente).
- Mudança de biblioteca de impressão.

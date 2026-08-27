# Integração real do QZ Tray (impressão térmica direta)

## Objetivo
Carregar o script `qz-tray.js` na aplicação, conectar ao agente local do QZ Tray instalado na máquina, exibir o status da conexão em Configurações e imprimir diretamente na impressora térmica (sem a janela do navegador). Se o agente não estiver disponível, manter o fallback atual com `window.print()` em 80mm.

## Estado atual (verificado)
- `window.qz` está ausente no preview: o script do QZ Tray não é carregado em lugar nenhum.
- `src/lib/impressora.ts` já possui a camada de abstração (qz → navegador), mas nunca encontra o agente.
- Configurações já salvam nome(s) de impressora e largura 80mm.

## O que será feito

### 1. Carregar o script do QZ Tray
- Adicionar a dependência `qz-tray` via npm e importá-la dinamicamente (apenas no navegador, dentro de `useEffect`/função) em `src/lib/impressora.ts`, atribuindo a `window.qz` para manter compatibilidade com o código existente.
- Nada de import estático: o módulo só é carregado no cliente para não quebrar o SSR.

### 2. Conexão automática e assinatura
- Implementar `iniciarQz()` que:
  - carrega o script;
  - configura `qz.security.setCertificatePromise` e `setSignaturePromise`;
  - tenta conectar via websocket (`qz.websocket.connect()`);
  - usa `retries`/`delay` para suportar o agente iniciando depois da página.
- Modo sem certificado (padrão): instruir o usuário a marcar "Allow unsigned requests" no QZ Tray, ou aceitar o prompt de permissão na primeira impressão. O sistema tenta conectar sem assinatura primeiro.
- Suporte opcional a certificado próprio: se existir o segredo `QZ_PRIVATE_KEY` (configurável depois), uma server function assina as requisições. Nesta etapa fica como TODO documentado, sem bloquear o uso.

### 3. Status da conexão em Configurações → Impressora
- Indicador visual: "QZ Tray conectado" (verde) / "QZ Tray não detectado" (amarelo) / "Usando impressão do navegador".
- Botão "Reconectar" e lista das impressoras encontradas pelo agente (com botão para definir como padrão).
- Link para download do QZ Tray (https://qz.io/download/) quando não detectado.

### 4. Impressão direta
- `imprimirEtiqueta` e `testarImpressora` passam a montar o texto completo da etiqueta (hoje o QZ recebe string vazia no fluxo da etiqueta): extrair o texto do preview `#etiqueta-print` antes de enviar via `qz.print` com `type: "raw"`.
- Adicionar comandos ESC/POS básicos (corte de papel `\x1D\x56\x00` e alimentação) quando configurado nas preferências da impressora.
- Fallback inalterado: se o agente falhar, continua abrindo `window.print()` com o layout 80mm.

### 5. Ajustes no diálogo de impressão
- Em `src/components/ImprimirEtiqueta.tsx`, mostrar se a impressão será direta (QZ) ou via navegador, ao lado do seletor de impressora.
- Quando QZ ativo, "Imprimir na padrão" imprime sem abrir janela do navegador.

## Arquivos alterados
- `src/lib/impressora.ts` — carregamento dinâmico do qz-tray, conexão, status, ESC/POS, geração do texto da etiqueta.
- `src/routes/configuracoes.tsx` — aba Impressora com status de conexão, reconectar, lista de impressoras e instruções.
- `src/components/ImprimirEtiqueta.tsx` — indicação do método de impressão.
- `package.json` — dependência `qz-tray`.

## Fora do escopo
- Certificado/assinatura própria do QZ Tray (será etapa futura, com segredo dedicado).
- Impressão via rede sem agente local (IPP/CUPS) — não suportado em navegador.

## Como o usuário valida
1. Instalar o QZ Tray na máquina e mantê-lo em execução.
2. Abrir Configurações → Impressora: status deve ficar verde e listar as impressoras.
3. Clicar em "Testar impressora": sai etiqueta de teste direto na térmica.
4. Na tela de Pedidos, imprimir uma etiqueta: impressão direta, sem janela do navegador.

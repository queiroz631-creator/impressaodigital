# Migrar a impressão local para PrintNode

## Por que PrintNode é melhor que QZ Tray aqui

O problema atual não é o código: é o QZ Tray exigir uma conexão WebSocket direta do navegador para o agente na máquina (`ws://localhost:8181`), com certificado e prompt de permissão. É exatamente isso que vem falhando.

O PrintNode inverte o caminho: o agente instalado no PC se conecta **para fora**, na nuvem do PrintNode. O sistema não fala com a máquina — manda o trabalho de impressão para uma API HTTPS. Não há porta local, certificado, firewall nem prompt.

E, ao contrário do PrintBridge, o PrintNode cobre tudo que o sistema já usa hoje:

| Recurso usado hoje | QZ Tray | PrintBridge | PrintNode |
| --- | --- | --- | --- |
| Etiqueta térmica 80mm (ESC/POS + corte) | sim | não (só imagem) | sim (`raw_base64`) |
| PDF com perfil de impressão | sim | não | sim (`pdf_base64`) |
| Bandeja, duplex, cor, qualidade, cópias | sim | não | sim (opções do job) |
| Listar impressoras do PC | sim | limitado | sim (via API) |
| Funciona sem configurar o PC | não | parcial | sim |
| Imprime de qualquer lugar (celular, outro PC) | não | não | sim |

## E o JSPrintManager?

O JSPrintManager (Neodynamic) é um concorrente direto do QZ Tray e, em recursos, dá para fazer tudo que o sistema precisa: comandos raw ESC/POS, impressão de PDF, duplex, bandeja (tray), cor, papel, listar impressoras — e ainda scan de documentos, que não usamos.

| Ponto | QZ Tray | JSPrintManager |
| --- | --- | --- |
| Arquitetura | agente local + WebSocket `ws://localhost:8181` | agente local + WebSocket `ws://localhost:23443` |
| O problema atual de conexão | ocorre aqui | **pode ocorrer igual** — mesmo modelo navegador→localhost |
| Etiqueta térmica ESC/POS | sim | sim |
| PDF com bandeja, duplex, cor, cópias, papel | sim | sim |
| Custo | gratuito (assinatura opcional) | **licença paga** por site + por servidor (tem trial de avaliação) |
| Licença no cliente | não precisa | não precisa (cliente é livre), mas a licença é por domínio do site |

Conclusão: trocar QZ por JSPrintManager é trocar seis por meia dúzia **na arquitetura** — ambos dependem de WebSocket do navegador para o agente na máquina, que é exatamente o ponto que vem falhando. O que muda: JSPM é pago (licença por domínio/servidor) e tem suporte comercial; QZ é gratuito e open source. Não resolve a dor atual e ainda adiciona custo de licença.

Por isso a recomendação continua sendo o **PrintNode**, cuja arquitetura (agente → nuvem → API HTTPS) elimina a classe inteira de problema que está acontecendo com o QZ Tray.

Pontos de atenção honestos:
- É **serviço pago** por assinatura (o primeiro mês é gratuito e ilimitado para testar). O QZ é gratuito.
- Depende de internet. Sem internet, nem o sistema nem a impressão funcionam — na prática o sistema já é online, então não muda muito.
- Impressão não é mais instantânea/local: passa pela nuvem (normalmente 1–3 segundos).

Minha recomendação: **migrar para PrintNode e manter o QZ Tray como opção alternativa** nas configurações, sem apagar o que já existe. Assim você testa no mês gratuito e, se não gostar, volta o seletor para QZ.

## O que será feito

### 1. Chave de acesso
Pedir a API Key do PrintNode e guardá-la como segredo do backend. Ela nunca fica no navegador — todas as chamadas saem do servidor.

### 2. Configurações → Impressão
- Novo seletor de motor de impressão: **PrintNode / QZ Tray / Navegador**.
- Botão "Buscar impressoras": lista as impressoras que o agente PrintNode reportou, com o status de cada computador (online/offline).
- Escolha da impressora térmica e da impressora de documentos, salvas nas configurações.
- Botão de teste para cada uma, mostrando o erro real quando falha.

### 3. Etiqueta térmica 80mm
Os mesmos comandos ESC/POS que já são gerados hoje passam a ser enviados como job `raw_base64`. O corte de papel e a formatação continuam idênticos.

### 4. Perfis de impressão por material
Os perfis existentes (bandeja, frente e verso, cor, qualidade, cópias, tamanho) são traduzidos para as opções de job do PrintNode e enviados junto com o PDF. Os perfis já cadastrados continuam valendo — só muda para onde o trabalho é enviado.

### 5. Acompanhamento
Tela mostra o estado do job retornado pelo PrintNode (enviado, impresso, erro), em vez de "mandei e não sei o que aconteceu".

## Detalhes técnicos

- Segredo `PRINTNODE_API_KEY`, lido apenas dentro do `.handler()` de server functions.
- Novo `src/lib/printnode.functions.ts` com: `listarImpressorasPrintNode`, `imprimirRawPrintNode` (ESC/POS em base64) e `imprimirPdfPrintNode` (PDF em base64 + `options`).
- Autenticação HTTP Basic na API `https://api.printnode.com` (`/printers`, `/printjobs`).
- `src/lib/impressora.ts` ganha um despachante por motor: `printnode` → server function; `qz` → caminho atual intocado; `navegador` → fallback atual.
- `opcoesDoPerfil` ganha um irmão `opcoesPrintNode` mapeando duplex → `duplex: long-edge/short-edge`, bandeja → `bin`, qualidade → `dpi`, cor → `color`, cópias → `copies`, tamanho → `paper`.
- Novas colunas em `configuracoes`: `motor_impressao`, `printnode_impressora_termica`, `printnode_impressora_documentos`; nova coluna `printnode_printer_id` em perfis de impressão.
- Nada do código QZ é removido nesta etapa.

## Primeiro passo

Criar a conta em printnode.com, instalar o PrintNode Client no PC do balcão e gerar a API Key. Sem isso não dá para testar de verdade.

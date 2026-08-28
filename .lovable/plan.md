# Perfil de impressão com opções vindas do driver

Hoje o modal "Novo perfil" tem campos digitados à mão (mídia, bandeja, tamanho). A ideia é: ao escolher a impressora, o sistema consulta o driver pelo QZ Tray e preenche as listas com o que aquela impressora realmente oferece.

## Como fica a tela

Em Configurações → Impressão → Perfis de impressão, no modal do perfil:

1. **Impressora** — lista das impressoras encontradas no PC. Ao selecionar, o sistema busca os detalhes do driver e mostra "Lendo opções da impressora..." e depois "Opções lidas do driver".
2. **Origem do documento (bandeja)** — vira lista com as bandejas informadas pelo driver (Bandeja 1, Manual, Automática...), com opção "Outra (digitar)".
3. **Qualidade** — lista com as densidades/DPI reais suportadas pela impressora (ex.: 300 dpi, 600 dpi, 1200 dpi) em vez de Rascunho/Normal/Alta fixos; se o driver não informar, mantém os três níveis atuais.
4. **Tamanho do documento** — lista de tamanhos com a área máxima que o driver aceita como limite; tamanhos maiores que a impressora suporta ficam marcados como indisponíveis. "Personalizado" continua, validando contra o limite do driver.
5. **Tipo de papel / mídia, Cor, Frente e verso, Orientação** — continuam como listas de opções (o QZ Tray não enumera esses itens no driver), mas com um botão **"Imprimir teste"** já existente para conferir o resultado, e aviso na tela de que esses três são enviados ao driver no momento da impressão.
6. **Botão "Recarregar opções do driver"** e um bloco recolhível "Detalhes do driver" mostrando nome do driver, conexão, bandejas, densidades e tamanho máximo, exatamente como o QZ Tray reporta.

Sem QZ Tray conectado, o modal continua funcionando com os campos digitáveis de hoje e mostra o aviso de que as opções do driver não puderam ser lidas.

## Observação honesta

O QZ Tray expõe do driver apenas: nome do driver, conexão, **bandejas**, **densidades (DPI)** e **tamanho máximo do papel**. Tipos de papel/mídia, cor, duplex e orientação não são listáveis por API — nenhuma biblioteca de navegador consegue isso; elas continuam como opções fixas enviadas ao driver na hora de imprimir.

## Detalhes técnicos

- `src/lib/impressora.ts`: nova função `detalhesImpressora(nome)` usando `qz.printers.detail(nome)` (QZ 2.2), normalizando `{ driver, connection, trays[], density[], size }` e reaproveitando `garantirConexao` + `ultimoErroQz` para erros.
- `src/components/PerfisImpressao.tsx`: estado `detalhes` carregado ao trocar a impressora do rascunho; bandeja e qualidade viram `Select` com fallback para `Input`; badge de status da leitura; bloco de detalhes.
- `src/lib/perfil-impressao.ts`: aceitar `qualidade` como DPI numérico opcional (`densidade_dpi`) além dos três níveis atuais, mantendo compatibilidade com perfis já salvos.
- Migração: coluna `perfis_impressao.densidade_dpi integer null`.

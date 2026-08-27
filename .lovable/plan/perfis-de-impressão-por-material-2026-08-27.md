# Perfis de impressão por material

Criar perfis de impressão reutilizáveis (papel, qualidade, bandeja, tamanho, cor, frente e verso), vinculá-los aos materiais e usá-los na impressão real via QZ Tray.

## 1. Cadastro dos perfis (Configurações → Impressora)

Novo bloco "Perfis de impressão" com lista + modal de edição. Cada perfil tem:

- Nome do perfil (ex.: "Couché 180g A4 Alta")
- Impressora (escolhida entre as detectadas pelo QZ Tray, ou "usar a padrão")
- Tipo de papel / mídia (texto livre, conforme o driver: Comum, Couché, Etiqueta...)
- Qualidade (Rascunho / Normal / Alta) — mapeada para densidade/DPI
- Origem do documento / bandeja (lista das bandejas informadas pelo driver ou texto livre)
- Tamanho do documento (A3, A4, A5 ou personalizado em mm)
- Cor (Colorido / Preto e branco)
- Frente e verso (Não / Borda longa / Borda curta)
- Cópias padrão e orientação (retrato/paisagem)
- Perfil ativo

Ações: criar, editar, duplicar, excluir, reordenar e "Imprimir página de teste" usando o perfil.

## 2. Vínculo com o material

Em Configurar Preços → Materiais, no modal de valores de cada material, um seletor "Perfil de impressão" (opcional, 1 perfil por material). Na tabela principal aparece o nome do perfil vinculado.

## 3. Impressão usando o perfil

- Na tela de Pedidos/Orçamentos, botão "Imprimir documentos" por item: pega o perfil do material do item e envia os arquivos anexados daquele orçamento à impressora pelo QZ Tray, aplicando papel, tamanho, cor, bandeja, qualidade, frente e verso e cópias.
- Se o material não tiver perfil, abre um seletor para escolher um perfil na hora.
- Sem QZ Tray conectado, mostra o mesmo aviso já existente hoje (motivo da falha) e permite cair na impressão pelo navegador, que só respeita tamanho/cor.
- A impressão de recibo/etiqueta térmica continua exatamente como está.

### Observação importante sobre os arquivos

Hoje os arquivos anexados na calculadora são usados só para contar páginas e não ficam guardados. Para imprimir o documento depois (na tela de Pedidos), os PDFs precisam ser salvos no armazenamento do sistema quando o orçamento é gerado. O plano inclui esse envio para um bucket privado `orcamento-arquivos`, com o caminho registrado no orçamento. Se preferir imprimir apenas na hora, sem guardar arquivo, é só avisar que removo essa parte.

## Detalhes técnicos

- Nova tabela `perfis_impressao` (nome, impressora, midia, qualidade, bandeja, tamanho/lados/cor, copias, orientacao, ativo, ordem) com GRANTs e RLS iguais aos de `materiais`; coluna `materiais.perfil_impressao_id` (nullable, FK).
- `src/lib/impressora.ts`: nova função `imprimirDocumentos(perfil, arquivos)` montando `qz.configs.create` com `colorType`, `duplex`, `size` + `units: 'mm'`, `copies`, `orientation`, `printerTray`/`jobName` e `density`, imprimindo via `qz.print` com dados `pdf` em base64. Reaproveita `conectarQz`, `statusQz`, `listarImpressoras` e o mesmo formato `ResultadoImpressao` para erros.
- Hook `usePerfisImpressao` em `src/hooks/useDados.ts`.
- Upload dos PDFs em bucket privado com URL assinada na hora de imprimir.

# Nº da Sorte — Etapa 5: Auditoria, testes integrados e preparação para produção

Sem publicar, sem alterar a `main`, sem dados de teste no banco da loja, sem mexer em outros módulos.

## 0. Isolamento (primeiro passo, obrigatório)

- Confirmado: a prévia usa o mesmo banco da loja. Portanto nenhum teste que grave dados roda nela.
- Criar um **rascunho isolado** do projeto, que tem banco e storage próprios, com a mesma estrutura (migrações aplicadas do zero). Todos os testes integrados, de carga e de tela rodam lá, com dados sintéticos (CPFs gerados válidos, telefones fictícios).
- Antes de qualquer gravação, o script confere que está apontando para o banco do rascunho; se não estiver, aborta.
- Se o rascunho isolado não puder ser criado, paro aqui e reporto o impedimento; a auditoria de código e banco (somente leitura) continua.

## 1. Auditoria somente leitura (código + banco atual)

- Conferir que o ajuste de intervalo existe de fato: colunas, restrição, histórico, função de ampliação e tela.
- Revisar rotas, funções do servidor, tabelas, RLS, GRANTs, funções privilegiadas, índices e permissões das 8 migrações do módulo; comparar o histórico aplicado com os arquivos da VPS.
- Classificar achados em Crítico / Alto / Médio / Baixo. Já previsto como risco Alto: **CPF + telefone bastam para entrar e reabrir o comprovante** (não há código enviado ao telefone). Proposta: código de 6 dígitos por WhatsApp (Z-API existente), só para reabrir comprovante e para cliente premiado; implementar nesta etapa se aprovado (ver pergunta abaixo).
- Verificar também: limite de consultas por cliente/campanha (hoje há limite por IP; confirmar o do banco), CSV injection, horário de Brasília nos gráficos, link do QR não confirmando entrega.

## 2. Correções

- Corrigir os itens Críticos e Altos com migrações aditivas (cópia idêntica em `supabase/migrations/`) e ajustes de código, respeitando a arquitetura atual.
- Migrações novas aplicadas apenas no rascunho isolado até sua aprovação; nada em produção nesta etapa.

## 3. Testes integrados (no rascunho isolado)

Scripts automatizados por grupo, mantidos no projeto:
- Geração: prefixo/5 dígitos/zeros, unicidade, intervalo pequeno e quase cheio, falha sem geração parcial, geração simultânea, ampliação 1209999 → 1219999 preservando números.
- Cliente: novo, existente, CPF/telefone inválidos, duplicado, sem sobrescrever cadastro, CPF de terceiro.
- Consulta e reserva: premiado/não premiado/inexistente/outra campanha/repetido/já reservado, campanha suspensa/encerrada/fora do período, limites; concorrência (2 clientes no mesmo número, 1 cliente em 2 números, requisições repetidas).
- Regra do ganhador: bloqueio na mesma campanha em outra sessão/aparelho; liberado em outra campanha; reabrir comprovante não conta como participação.
- Comprovante e retirada: QR sem dados pessoais, código curto independente, revogação, entrega dupla simultânea (só uma vale), vencidos e exceção com justificativa.
- Permissões: administrador, funcionário com e sem permissão, visitante — sempre pelo servidor.
- Estatísticas: cenários controlados conferindo os 14 indicadores após cada passo; CSV real (UTF‑8 com BOM, filtros, CPF mascarado, injeção bloqueada).
- Carga: 1.000 e 10.000 participantes, 100.000 consultas, várias campanhas; medir tempos e consultas lentas.

## 4. Telas

- Abrir com login real no rascunho: painel (todas as abas), página pública e comprovante, em computador, tablet e celular, com capturas de tela.

## 5. Implantação e reversão (somente documento)

- `deploy/NUMERO_SORTE_PRODUCAO.md`: branch/commit aprovado, backup do banco e storage, espaço, variáveis, ordem das migrações, build, reinício PM2, checagens de saúde, logs e monitoramento.
- Reversão separada para código, migrações (todas aditivas: desativar sem apagar), dados e arquivos.

## 6. Relatório final

Seções A–H do documento, com contagem de testes, problemas e classificação final. Se algo não puder ser validado, fica como pendência e o módulo não é declarado pronto.

## Detalhes técnicos

- Rascunho via drafts (backend isolado); sessão de teste criada no próprio rascunho.
- Testes de banco em vitest com cliente do rascunho e guarda de URL; testes puros continuam nos arquivos `tests/numero-sorte-*`.
- Concorrência simulada com chamadas paralelas às funções do banco (`numero_sorte_consultar`, `numero_sorte_confirmar_entrega`, geração).

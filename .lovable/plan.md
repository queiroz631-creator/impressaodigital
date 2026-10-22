# Nº da Sorte — Etapa 3: Comprovante e Retirada

## O que já existe (conferido no código)
- Premiação reservada fica registrada com cliente, número, prêmio, data e prazo; situações: reservado, entregue, vencido, cancelado.
- A página pública já mostra "Parabéns" com os dados do prêmio para o cliente identificado (nome + CPF + telefone conferido).
- A aba "Retirada de Prêmios" existe no painel, mas ainda mostra só um aviso.
- Gerador de QR Code já instalado. Falta leitor de QR pela câmera.

## O que será feito

**Comprovante do cliente**
- Ao ganhar, o sistema cria um comprovante único com QR Code e código curto (ex.: K7M9-P2Q4), sem CPF, telefone ou número da sorte.
- Mostra campanha, nome, número premiado, prêmio (com imagem), condições, data, prazo, local, situação e as mensagens pedidas.
- Botões: baixar PDF, salvar imagem, compartilhar (celular e WhatsApp), copiar código.
- Recuperação: quem já ganhou volta à página, informa nome + CPF + telefone (os dois precisam conferir com o cadastro) e reabre o mesmo comprovante — sem nova premiação.

**Retirada na loja (painel)**
- Leitor de QR pela câmera (liga só ao clicar, desliga ao ler) ou digitação do código.
- Mostra cliente, CPF e telefone mascarados, prêmio, condições, prazos e situação em destaque.
- "CONFIRMAR ENTREGA DO PRÊMIO" abre janela de conferência; ao confirmar, registra quem entregou e quando. Segunda tentativa mostra "Este prêmio já foi entregue." com os dados da entrega.
- Prêmio vencido: retirada bloqueada; quem tiver a permissão de exceção pode liberar com justificativa.
- Revogação do comprovante com justificativa (gera um novo para o mesmo cliente).
- Histórico de retiradas com filtros por campanha, cliente, número, prêmio, situação e período.

**Segurança**
- O link do QR (`/numero-da-sorte/validar/...`) só abre o painel de retirada para funcionário logado; nunca entrega sozinho.
- Limite de tentativas na validação manual e registro de atividade suspeita.
- Tudo registrado na auditoria.

## Detalhes técnicos
- Migração `numero_sorte_etapa3` (também em `supabase/migrations/`):
  - `numero_sorte_comprovantes`: premiacao_id, token_hash e codigo_hash (SHA-256), token cifrado só para reexibir ao titular, ativo, revogado_em/por/motivo; índice único parcial "um ativo por premiação".
  - `numero_sorte_retiradas`: premiacao_id UNIQUE, entregue_em, entregue_por, excecao_prazo, justificativa.
  - Funções SECURITY DEFINER: `numero_sorte_emitir_comprovante` (idempotente), `numero_sorte_validar_retirada` (por token ou código, checa `tem_permissao`, rate limit por usuário), `numero_sorte_confirmar_entrega` (FOR UPDATE, revalida situação/prazo, insere retirada, marca entregue, inativa comprovante, auditoria — retorna estado existente se já entregue), `numero_sorte_vencer_premiacoes` (marca vencidos; chamada também na validação), `numero_sorte_revogar_comprovante`.
  - RLS + GRANT; leitura só via permissões.
- Permissões novas em `src/lib/modulos.ts`: `numero_sorte.retiradas.visualizar`, `.retiradas.confirmar`, `.retiradas.excecao`, `.auditoria.visualizar` (`.retiradas.validar` já existe).
- Tokens: 32 bytes aleatórios (token) e 8 caracteres de alfabeto sem ambíguos (código), gerados no servidor.
- Server functions: públicas em `numero-sorte-publico.functions.ts` (obter comprovante pela sessão); painel em `src/lib/numero-sorte-retirada.functions.ts` com `requireSupabaseAuth`.
- Interface: `ComprovantePublico.tsx`, `RetiradaPainel.tsx`, rota `numero-da-sorte.validar.$token.tsx`; leitor via biblioteca `html5-qrcode` (carregada só no navegador); PDF/imagem via `src/lib/pdf.ts` e canvas existentes.
- Testes automáticos: geração/formato de código e token, máscaras, regras puras de situação/prazo/exceção. Cenários com banco (entrega dupla, simultânea, outra pessoa) ficam documentados para o banco de testes — sem dados fictícios em produção.
- Nada publicado; Etapa 4 não iniciada.

# Nº da Sorte — Etapa 2: página pública, cadastro e consulta

Usa as campanhas, prêmios e números da Etapa 1 sem mexer neles. Sorteios e FOTO EXPRESS não mudam.

## O que o cliente vê

Endereço `/numero-da-sorte/<nº da campanha>` (ex.: `/numero-da-sorte/12`), sem login, pensado para celular.

1. **Campanha:** banner, nome, descrição, período, regulamento e como participar.
   - Programada: "ainda não começou". Suspensa: "pausada temporariamente". Encerrada: "campanha encerrada". Rascunho: página não encontrada. Fora do período não há consulta.
2. **Identificação:** nome completo, telefone e CPF, aceite do regulamento (obrigatório), aceite de marketing separado (opcional) e aviso de privacidade.
3. **Consulta:** campo só com números. O número precisa ser desta campanha (ex.: na campanha 12, começa com 12 + 5 dígitos).
   - Não premiado: "Que pena! Seu número não foi contemplado nesta campanha." Pode tentar outro dentro do limite.
   - Premiado: "Parabéns", com prêmio, imagem, descrição, condições, prazo e local, e o aviso "Guarde esta informação! Seu comprovante de retirada será disponibilizado após a confirmação da premiação." Sem QR de retirada (fica para a Etapa 3).
   - Já ganhou nesta campanha: "Você já foi contemplado nesta campanha e não poderá participar novamente." Mostra só o próprio prêmio. Em outras campanhas ativas, participa normalmente.

## Cadastro do cliente

Usa o mesmo cadastro de clientes de Sorteios e FOTO EXPRESS e segue a regra do portal de Sorteios:
- valida o CPF, normaliza o telefone e grava o nome em CAIXA ALTA, sem acentos;
- CPF já cadastrado: o telefone informado precisa conferir. Se não conferir, aparece "Os dados informados não correspondem ao cadastro" e nada muda;
- CPF novo com telefone de um cadastro sem CPF: usa esse cadastro e preenche só o que está vazio;
- telefone que pertence a outro CPF: bloqueia;
- nenhum dado existente é sobrescrito e nenhum dado de outra pessoa aparece na tela.

Depois da identificação, uma sessão protegida (cookie seguro, válida por algumas horas) libera a consulta. O navegador não recebe CPF nem identificadores internos.

## Segurança contra fraudes (no servidor e no banco)

- Limite de consultas por cliente/campanha: usa o valor da Etapa 1. Sem valor configurado, o padrão é **10 consultas**.
- Limites por aparelho/IP (ex.: 20 por hora), por cliente (5 por minuto) e por campanha (teto por minuto), com bloqueio temporário e registro de atividade suspeita.
- Os números premiados nunca saem do servidor. Só existe a consulta de um número por vez, depois das validações.
- Reserva do prêmio numa única operação travada no banco: uma unidade só pode ir para um cliente, e o cliente só pode ganhar um prêmio por campanha, mesmo com cliques simultâneos.
- Mensagens públicas genéricas, sem detalhes internos.

## Painel administrativo

- **Campanhas:** enviar, ver, trocar e remover o banner. Link público com botão copiar, QR Code da campanha e botão para baixar o QR em PNG.
- **Prêmios:** enviar, trocar e remover a imagem.
- **Participações:** lista com campanha, cliente, telefone mascarado, número, data, resultado e situação. Filtros por campanha, data e resultado. Só para quem tem permissão de ver participantes.

## Pontos assumidos (confirme se quiser outro valor)

- 10 consultas por cliente por campanha quando não houver limite configurado.
- O endereço público usa o número da campanha.
- O prêmio fica reservado na hora, sem confirmação extra por WhatsApp/SMS.

## Detalhes técnicos

**Migração** (também copiada para `supabase/migrations/` com nome datado):
- `numero_sorte_participacoes` (campanha, cliente, aceites, ip_hash, criado_em; único campanha+cliente).
- `numero_sorte_consultas` (campanha, cliente, código informado, resultado `nao_premiado|premiado|repetida|bloqueada|invalida`, numero_id, criado_em).
- `numero_sorte_premiacoes` (campanha, cliente, numero_id, premio_id, reservado_em, prazo_em; **UNIQUE(campanha_id, cliente_id)** e **UNIQUE(numero_id)**).
- `numero_sorte_sessoes` (hash SHA-256 do token, campanha, cliente, expira_em) e `numero_sorte_tentativas` (chave, janela, contagem), sem acesso direto pelo navegador.
- Funções SECURITY DEFINER: `numero_sorte_identificar_cliente` (lógica CPF → telefone, com `pg_advisory_xact_lock`) e `numero_sorte_consultar` (trava a campanha e o cliente com advisory lock e `FOR UPDATE` no número; checa situação/período, premiação anterior e limite; reserva, marca a unidade como `reservado` e registra a consulta).
- RLS e GRANT: leitura das novas tabelas só por `tem_permissao(..., 'numero_sorte.participantes.visualizar')`. Escrita só pelas funções.
- Bucket público `numero-sorte-divulgacao` (JPG/PNG/WebP, até 5 MB), upload só por quem gerencia campanhas/prêmios. Contém apenas banners e imagens de prêmios.

**Código**
- `src/lib/numero-sorte-publico.functions.ts` + `.server.ts`: campanha pública (só campos de divulgação), identificar, consultar, meu prêmio; cookie HttpOnly próprio; rate limit com IP com hash.
- `src/lib/numero-sorte.functions.ts`: participações com filtros, upload/remoção de imagens.
- Rota `src/routes/numero-da-sorte.$campanha.tsx` com head() próprio, e telas em `src/modules/numero-sorte/publico/`.
- Biblioteca `qrcode` para o QR da campanha.
- Validação do código ligado à campanha em `codigo.ts` (`codigoPertenceCampanha`).

**Testes**
- Testes automáticos (vitest) para formato 6/7/8 dígitos, sufixo com zeros, número de outra campanha, CPF inválido, normalização e limite padrão.
- Os cenários de banco (novo/reaproveitado, suspensa/encerrada, premiado, reservado, já premiado, outra campanha, limite, concorrência, acesso sem login, rajada automatizada) serão conferidos com dados temporários e removidos no fim, se o seu ambiente permitir. Como o banco do preview é o de produção, nesse caso eles não rodam lá e ficam documentados como roteiro para o banco de testes.

Sem publicar, sem deploy, sem Etapa 3.

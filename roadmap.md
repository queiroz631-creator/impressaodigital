# Roadmap

## Em andamento: Deploy em VPS Hostinger
- [x] `deploy/setup-vps.sh` — instalação inicial da VPS
- [x] `deploy/deploy.sh` — script de atualização/publicação
- [x] `deploy/nginx.conf` — proxy reverso (app + Supabase)
- [x] `deploy/ecosystem.config.cjs` — configuração PM2
- [x] `deploy/.env.example` — variáveis necessárias
- [x] `deploy/README.md` — passo a passo em português
- [x] `deploy/aplicar-migracoes.sh` + `deploy/migrations-baseline.txt` — migrações
      automáticas do banco no deploy (baseline sem reaplicar as antigas)

## Etapa 2 — Usuários, Perfis e Permissões (concluída)
- [x] `descricao` em perfis_acesso, chaves padronizadas, perfis Administrador/Atendente/Financeiro
- [x] Gatilho `profiles_bloquear_escalada` (só administrador muda perfil/situação/conexão)
- [x] `usePermissoes` ligado ao banco; menu filtrado por permissão
- [x] Proteção centralizada de página via `AppLayout permissao="..."`
- [x] Página `/usuarios` com abas Usuários e Perfis
- [ ] Testar com um segundo usuário (Atendente) — pendente, sem criar usuário automaticamente

## Etapa 3 — Múltiplas conexões de WhatsApp (concluída)
- [x] Conexão inicial renomeada para "Impressão Digital" (histórico preservado)
- [x] Isolamento no banco: administrador OU conexão do usuário; sem vínculo, sem acesso
- [x] Página `/conexoes` (só administrador): criar, editar, testar, reconfigurar webhook, copiar, excluir
- [x] Webhook por conexão (`/api/public/whatsapp/webhook/<token>`); endereço antigo continua válido
- [x] Envio sempre pela conexão da conversa (texto, arquivo, mensagem rápida, currículo, orçamento)
- [x] Bot, fila, inatividade e status por conexão; um único cron de cada rotina
- [x] Seletor de conexão no WhatsApp e na Configuração do Bot; vínculo do atendente na tela Usuários
- [ ] Colar as credenciais da Z-API da Impressão Digital na tela Conexões (hoje usa as variáveis do servidor)
- [ ] Reconfigurar o webhook da conexão atual quando quiser migrar para o novo endereço

## Correção — Configuração do Bot por conexão
- [x] Isolar todas as abas e simuladores pela conexão selecionada
- [x] Validar no servidor todo acesso e alteração pela conexão autorizada
- [x] Reforçar RLS das tabelas do bot por conexão
- [x] Mostrar a cor cadastrada no seletor de conexão
- [x] Validar administrador, tela e compilação
- [ ] Validar com um usuário atendente vinculado — pendente por falta de sessão desse perfil

## Correção — Respostas rápidas na conexão sem fluxo inicial
- [x] Exceção: sem fluxo inicial ativo, palavra-chave reconhecida entra na triagem com confirmação SIM/NÃO
- [x] Nunca enviar mensagem em branco (menu sem opções)
- [x] Palavra-chave volta a ser atendida depois do aviso de fora do horário (nunca em atendimento humano)
- [x] Reconhecimento sempre com as respostas rápidas da conexão da conversa
- [ ] Testar pelo WhatsApp real da Queiroz Papelaria (envio depende do número)

## Módulo Sorteios — Etapa 1 (fundação, concluída)
- [x] `clientes.cpf` (11 dígitos, dígito verificador, único quando preenchido) e `clientes.data_nascimento`
- [x] Tabelas: sorteios, sorteio_termos, sorteio_participantes, sorteio_notas_base,
      sorteio_notas, sorteio_cupons, sorteio_historico, sorteio_premios,
      sorteio_ganhadores, sorteio_sincronizacoes, sorteio_auditoria
- [x] RLS por `public.pode_sorteios()` (admin ou permissão `sorteios.visualizar`)
- [x] Gatilho: nota CANCELADA cancela seus cupons (nunca o contrário), sem recálculo de saldo
- [x] `src/modules/sorteios/` (types, validations, services/saldo.ts, README)
- [x] Etapa 2: telas administrativas do módulo

## Módulo Sorteios — Etapa 2 (administração, concluída)
- [x] Menu Sorteios no grupo Marketing abrindo /sorteios
- [x] Permissão `sorteios.gerenciar` no catálogo (concedida manualmente; admin já tem acesso)
- [x] Telas: lista, novo, painel, editar, termos, prêmios, participantes, notas, cupons
- [x] Situações: RASCUNHO → ATIVO → ENCERRADO → SORTEADO; CANCELADO; sem retorno
- [x] Proteção de dados críticos (número, datas de início/fim, valor por cupom) com movimentação
- [x] Termos com várias versões e uma única versão atual (troca atômica no banco)
- [x] Auditoria de criação, alteração, mudança de situação, termos e prêmios
- [x] Validação no servidor em toda gravação (permissão, situação e movimentação relidas)
- [ ] Etapa 4: geração de cupons, números aleatórios, API local e sincronização

## Módulo Sorteios — Etapa 3 (portal público, concluída e verificada)
- [x] Rotas públicas `/sorteios-publico` (CPF, telefone, cadastro, termos, painel, notas, cupons, informações)
- [x] Sessão do participante em cookie HttpOnly (2h, renovação "lembrar neste dispositivo" 30 dias)
- [x] Tabelas `sorteio_sessoes` e `sorteio_tentativas` (somente servidor; limite de tentativas por IP)
- [x] Cadastro/complemento de cliente + participação atômicos no banco (`sorteio_portal_criar_participacao`)
- [x] Registro e correção de nota PENDENTE, sem validação automática nem cupons
- [x] Sorteio em RASCUNHO nunca exposto; mais de um ATIVO bloqueia o portal
- [x] URL pública centralizada (`SORTEIOS_PUBLIC_URL`), redirecionamento do domínio e docs no deploy
- [x] Rodar os testes funcionais + testes de segurança e limpar dados de teste (27 verificações aprovadas)

## Módulo Sorteios — Etapa 5 (infraestrutura de sincronização, concluída)
- [x] Fila de itens de sincronização (fechada; só o servidor lê) com sequência usada como marca d'água
- [x] Cursores por consumidor, avançando somente após confirmação da API da loja
- [x] Recebimento de notas em lotes; `base_sincronizada_em` só na confirmação
- [x] Validação orientada a evento: apenas o sorteio do lote confirmado
- [x] Clientes nos dois sentidos: identificador permanente da loja + marca de origem (sem eco/loop)
- [x] Reconciliação de 15 minutos como rede de segurança (antes 1 minuto)

## Módulo Sorteios — Etapa 6 (API local + SQL Server Lojamix, concluída)
- [x] API local (Python/FastAPI): config, banco, consultas, serviços, rotas, normalização, estado — pasta restaurada em 15/09/2026 a partir do `api-local.zip` enviado pelo usuário (versão com GUI, serviço Windows e instalador); backup da versão anterior em `api-local-backup-2026-09-15.zip`
- [x] Leitura incremental de notas por `id_nota_fiscal`; data de emissão só para o período do sorteio
- [x] Somente pessoa física; pessoa jurídica e CNPJ fora da base de notas
- [x] Lotes idempotentes: marcador local avança só após a confirmação (gravação atômica em JSON)
- [x] Revisão de situação recicla a faixa já enviada: cancelamento posterior sempre é detectado
- [x] Sistema: `sorteio_notas_base.situacao`/`cancelada_em`, rota de situação e rota do sorteio ativo
- [x] Clientes nos dois sentidos com normalização (CAIXA ALTA, sem acentos) e cursor oficial
- [x] Clientes: enviar só pessoa física + CPF válido + telefone + nota no período (duas passagens, marcadores independentes, reconciliação de elegibilidade)
- [ ] Preencher o `.env` da API local na máquina da loja e confirmar os nomes das colunas de cliente no Lojamix

- [x] Etapa 7: saldo acumulado + geração de cupons (função `sorteio_gerar_cupons_da_nota`, botão no painel, rotina automática)
- [x] Etapa 8: cancelamento de nota acerta o saldo do cliente (`sorteio_recalcular_saldo_participante`)
- [x] Etapa 9: rastreabilidade da origem do valor dos cupons — `sorteio_saldo_fontes` + `sorteio_cupom_contribuicoes`,
      FIFO por sequência, cancelamento pelo cupom que perdeu lastro (sem escolha arbitrária), déficit de cupom
      utilizado registrado, reconstrução dos cupons do banco de desenvolvimento com composição completa
- [x] Etapa 10: o saldo liberado pelo cancelamento gera cupom na mesma transação
      (`sorteio_emitir_cupons_do_pool`, usada tanto pelo processamento da nota quanto pelo recálculo);
      limite de cupons do sorteio respeitado, cupom UTILIZADO nunca cancelado, 10 testes obrigatórios verificados


## API local / Lojamix — estado atual
- [ ] Preencher o `.env` da API local na máquina da loja e confirmar os nomes das colunas de cliente no Lojamix

## Módulo Sorteios — Recuperação de clientes elegíveis (concluída)
- [x] Revisão periódica de clientes elegíveis na API da loja (marcador `ultimo_id_cliente_revisado`, varredura circular)
- [x] Motivos de descarte visíveis no resumo e na tela de status (sem nome, sem CPF, CPF inválido, sem telefone)
- [x] Reconciliação da loja revisando clientes elegíveis
- [x] Ação "Reprocessar clientes": zera apenas `ultimo_id_entidade`, `ultimo_id_nota_cliente` e `ultimo_id_cliente_revisado` (nunca os marcadores de notas) e nunca roda junto com um ciclo de clientes
- [x] Enviar clientes Sistema → Lojamix com criação de cadastro novo (vincular por CPF, criar entidade+pessoa_fisica em transação, modo simulação, marcador ultimo_id_cliente_pendente circular, elegibilidade = PF + CPF válido + telefone + participação em sorteio ATIVO; fluxo de notas intacto) — concluído
- [x] Criação real no Lojamix com padrões confirmados: pessoa física completa (sexo 1, indicador_ie 9, rg/ie/nome_mae/nome_pai vazios), data de nascimento real ou 1900-01-01, e-mail sempre opcional, confirmação determinística da pessoa física (SELECT exato antes do commit, não rowcount), correção do import de ErroBanco em clientes_repo.criar
- [x] Criação da entidade espelhando o cadastro real (obrigatórios sem padrão preenchidos, opcionais observados espelhados, demais opcionais vazios, padrões do Lojamix preservados) — `id_cidade` = 260 conforme cadastro 9942

## Módulo Sorteios — Fechamento do sorteio (ATIVO → ENCERRADO) — concluída
- [x] `sorteio_conferencia` (somente leitura): totais, pendências e inconsistências, com participante/nota/cupom de cada problema
- [x] `sorteio_encerrar`: FOR UPDATE + conferência refeita na transação + retrato em `sorteios.conferencia_encerramento` + auditoria `sorteio.encerrado`; rollback total em qualquer falha
- [x] Congelamento da base após ENCERRADO/SORTEADO/CANCELADO por trigger BEFORE em notas, participantes, cupons, fontes e contribuições (consultas e histórico intactos)
- [x] Transição genérica ATIVO → ENCERRADO recusada: só pela conferência
- [x] Painel: seção "Conferência para encerramento", 12 indicadores, listas por extenso, botão com confirmação e retrato após o encerramento
- [x] 22 testes no banco de desenvolvimento, dados temporários removidos
## Módulo Sorteios — Apuração do cupom vencedor (ENCERRADO → SORTEADO) — implementada
- [x] `sorteio_ganhadores.unidade` + `usuario_id` e índice único (sorteio_id, premio_id, unidade) — vários ganhadores por prêmio, no máximo um por unidade
- [x] `sorteio_apuracao_resumo` (leitura): totais, prêmios com sorteados/disponível, ganhadores e amostra de números
- [x] `sorteio_realizar`: FOR UPDATE + status ENCERRADO + próximo prêmio/unidade na ordem + urna sem participantes já ganhadores + sorteio no banco + ganhador + auditoria `sorteio.realizado` + SORTEADO só na última unidade; rollback total
- [x] Aba "Sortear" (ENCERRADO/SORTEADO): resumo, prêmios, animação da urna (só visual), card do ganhador e histórico
- [x] Ajustar resultado: modal de roleta, remover Cliente e exibir somente os 4 últimos dígitos de CPF/telefone
- [x] Histórico de ganhadores: botão (olho) por linha abre modal com dados completos do participante (CPF, telefone, nascimento, e-mail), buscados no servidor sob demanda com permissão de gestão; listagem segue mascarada
- [ ] Bateria de testes finais da apuração (não executada nesta etapa, conforme solicitado)

## Portal do sorteio — melhorias em andamento
- [x] Mensagem específica "telefone já cadastrado" nos fluxos de entrar/cadastrar (código TELEFONE_EM_USO, auditoria com motivo)
- [x] Campo de data de nascimento com duas formas de preenchimento: calendário (seletor de data) ou texto digitado com máscara DD/MM/AAAA

## Configurações — aba IA
- [x] Aba "IA" em Configurações: escolha do provedor (OpenAI/Gemini, pela Lovable ou com chave própria), modelos, cofre da chave no servidor e botão de teste real.

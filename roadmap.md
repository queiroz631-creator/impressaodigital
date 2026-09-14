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
- [ ] Etapa 2: telas administrativas do módulo
- [ ] Etapa 3: portal público do participante (RLS própria), cupons aleatórios, API local e sincronização

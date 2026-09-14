# Sorteios — Etapa 3 (portal público do participante)

Somente o portal do participante. Nada de API local, sincronização, validação automática de notas, geração de cupons, cron, realização do sorteio ou ganhadores. Nenhum outro módulo é tocado.

## Endereço e visual

Portal em `/sorteios-publico`, com layout próprio (mobile-first, sem o menu lateral administrativo): topo com logo e nome do sorteio, cartões grandes, barra de navegação inferior no celular. O endereço `sorteios.queiroztecno.com.br` poderá apontar para esse caminho quando o domínio for ligado; nada nas telas administrativas muda.

## Fluxo de entrada

1. **CPF** — máscara `000.000.000-00`, guardado só com números, validado matematicamente.
2. **Telefone** — máscara brasileira, comparado pelo telefone normalizado do cadastro.
3. O servidor procura o CPF no cadastro de clientes:
   - **Encontrado com telefone igual** → entra.
   - **Encontrado com telefone diferente** → bloqueia com "Os dados informados não correspondem ao cadastro. Confira o CPF e o telefone." Nenhum dado do cadastro é revelado.
   - **Encontrado com dados faltando** → pede apenas o que está vazio (nome e/ou nascimento); nada preenchido é sobrescrito.
   - **Não encontrado** → pede nome completo (exige nome + sobrenome, mantém acentos e maiúsculas/minúsculas) e data de nascimento (não futura, gravada como data civil, sem ajuste de fuso).
4. Cliente e participação no sorteio ativo são criados/reaproveitados no servidor, sempre uma única participação por cliente em cada sorteio.

CPF, telefone e identificadores nunca aparecem no endereço da página nem em parâmetros.

## Sorteio ativo

O servidor decide qual é o sorteio; o navegador nunca informa. Sem sorteio ativo: "Não há nenhum sorteio disponível no momento." Com mais de um ativo por erro de cadastro: mensagem de configuração indisponível, sem escolher nenhum e sem expor dados. Encerrado, cancelado ou sorteado: informações públicas visíveis, participação e registro de nota bloqueados. Antes da data de início também não aceita participação.

## Termos

Só a versão marcada como atual é exibida (título, versão, regras, como participar, validade, como será realizado, informações adicionais), com caixa de aceite obrigatória. O aceite fica gravado na participação (versão + data/hora), já previstos na estrutura atual. Quem já aceitou a versão atual não aceita de novo; quando o administrador publica uma nova versão atual, o aceite é exigido novamente e o aceite anterior nunca é alterado nem apagado.

## Sessão do participante

Cookie de sessão assinado, HttpOnly, SameSite Lax, Secure em produção, com expiração de 2 horas renovada a cada uso. "Lembrar neste dispositivo" gera um segundo cookie de renovação com validade de 30 dias, revogável, sem CPF, telefone ou senha guardados no dispositivo. "Sair" invalida a sessão no servidor e apaga os cookies. Sessão expirada ou ausente em painel/notas/cupons redireciona para a tela de CPF, sem renderizar dado algum antes da validação.

## Páginas do portal

- **Início** — nome do participante, quantidade de notas, quantidade de cupons, saldo, período e situação do sorteio; botões Registrar nota, Minhas notas, Meus cupons, Informações, Sair.
- **Registrar nota** — número e valor; grava como Pendente, sem validação automática e sem gerar cupom. Número repetido no mesmo sorteio: "Esta nota já foi registrada neste sorteio.", sem dizer de quem é.
- **Minhas notas** — só as do participante, com número, valor, data e situação. Nota inválida pode ter número e valor corrigidos pelo participante, voltando para Pendente; nota cancelada é somente consulta.
- **Meus cupons** — somente consulta, com número e situação (cancelado marcado como tal); vazio mostra "Você ainda não possui cupons neste sorteio."
- **Informações do sorteio** — nome, número, descrição, período, data prevista, valor por cupom, limite quando houver, regras, como participar, prêmios ativos com quantidades, método do sorteio e informações adicionais.

## Segurança

Todas as leituras e gravações passam por funções no servidor que descobrem o participante pela sessão e o sorteio pelo banco, ignorando qualquer identificador enviado pelo navegador. Nenhuma tabela é liberada para acesso anônimo direto. Nunca são retornados CPF ou telefone de terceiros, dados administrativos ou credenciais. Erros aparecem como mensagens curtas e amigáveis, sem detalhes técnicos. Tentativas de CPF/telefone, criação de cadastro e registro de nota têm limite por IP no servidor. Eventos importantes (entrada, criação de participante, aceite, registro e correção de nota, saída) vão para a trilha de auditoria existente, com CPF e telefone mascarados.

## Banco de dados

Uma migração pequena, só do módulo Sorteios: duas tabelas novas de infraestrutura do portal — sessões públicas e contador de tentativas — ambas acessíveis apenas pelo servidor, sem acesso anônimo. O aceite de termos e a correção de nota usam campos que já existem; nenhuma tabela existente é alterada e nenhum cadastro é duplicado.

## Detalhes técnicos

- Migração: `public.sorteio_sessoes` (id, participante_id, cliente_id, sorteio_id, token_hash unique, renovacao_hash, expira_em, renovacao_expira_em, revogado_em, ip, user_agent, criado_em/usado_em) e `public.sorteio_tentativas` (id, chave, acao, ip, criado_em) — `ENABLE ROW LEVEL SECURITY` sem política para anon/authenticated e `GRANT ALL ... TO service_role` apenas; índices em token_hash, renovacao_hash, expira_em, (ip, acao, criado_em). Nenhum `ALTER` em tabelas existentes.
- Rotas TanStack flat: `src/routes/sorteios-publico.index.tsx` (CPF), `.telefone`, `.cadastro`, `.termos`, `.painel`, `.notas`, `.cupons`, `.informacoes`, cada uma com `head()` próprio; páginas privadas com `{ name: "robots", content: "noindex, nofollow" }`, entrada com título "Portal de Sorteios | Queiroz Papelaria". Rotas administrativas `/sorteios*` intactas.
- Layout em `src/modules/sorteios/components/publico/` (`LayoutPublico`, `CampoCpf`, `CampoTelefone`, `CartaoResumo`, `NavInferior`, `StatusNotaBadge`), reutilizando os tokens de `src/styles.css` e os componentes de `src/components/ui/`.
- Server fns em `src/lib/sorteios-publico.functions.ts` (`createServerFn`, sem `requireSupabaseAuth`): `obterSorteioAtivoPublico`, `iniciarAcessoPublico` (CPF), `verificarTelefonePublico`, `concluirCadastroPublico`, `obterContextoParticipante`, `aceitarTermosSorteio`, `obterPainelParticipante`, `registrarNotaParticipante`, `listarMinhasNotas`, `corrigirMinhaNota`, `listarMeusCupons`, `obterInformacoesPublicasSorteio`, `sairPortalParticipante`. Regras e acesso a dados em `src/lib/sorteios-publico.server.ts`, com `supabaseAdmin` carregado dentro do handler (`await import("@/integrations/supabase/client.server")`), após a validação da sessão; nada de cliente anon lendo tabelas.
- Sessão: token aleatório de 32 bytes (`crypto.getRandomValues`), guardado no banco como hash SHA-256; cookies `sp_sessao` e `sp_dispositivo` definidos com `setResponseHeader("set-cookie", ...)`, lidos com `getRequestHeader("cookie")`. Toda função protegida começa por `carregarSessao()` → participante + sorteio; expirada/revogada devolve erro tratado que redireciona para a entrada.
- Rate limit: contagem em `sorteio_tentativas` por (ip, acao) em janela de 10 minutos (20 tentativas de CPF/telefone, 5 cadastros, 30 notas), com mensagem genérica de "tente novamente em alguns minutos".
- Reuso: `validations/cliente.ts` (CPF, nome completo, nascimento, máscaras), `validations/sorteio.ts` (`centavosDeTexto`, `textoDeCentavos`), `services/status.ts`, `types/index.ts`, `src/lib/format.ts` (`brl`, `dataBR`); `EVENTOS_AUDITORIA` ganha os eventos do portal (`portal.entrada`, `participante.criado`, `portal.saida`) e a auditoria usa `origem: "portal"`.
- Transações: criação de cliente + participação numa única função no banco (`SECURITY DEFINER`) chamada pelo servidor, para não sobrar cliente sem participação; registro de nota e aceite em operação única com releitura da situação do sorteio imediatamente antes de gravar.
- Verificação: os 22 testes funcionais e os testes de segurança da lista (manipulação de identificadores, acesso sem sessão, sessão expirada, isolamento entre participantes) com dados temporários removidos ao fim; typecheck, lint e build. Sem commit, sem push, sem deploy.

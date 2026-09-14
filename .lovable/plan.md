# Aceite dos termos + posição do bloco de informações no painel

Correção pontual. Nada da Etapa 3 é refeito e nenhuma tabela, campo ou regra de acesso muda.

## Causa do problema (verificada no código atual)

O aceite já grava nos campos existentes da participação (`aceite_termos_em`,
`aceite_termos_versao`), sempre comparados com a versão marcada como atual dos termos.
O que quebra o fluxo:

1. O servidor exige que a versão enviada pela tela seja igual à atual do banco. Se o
   administrador publicar uma nova versão com a tela aberta, o aceite é recusado com
   "A versão dos termos não confere".
2. O botão de aceitar fica sempre clicável; a caixa de seleção só é conferida depois do clique.
3. Falhas do servidor não são capturadas na tela: o participante fica sem mensagem nenhuma.

## Correção no servidor (função de aceite existente)

- A tela passa a enviar apenas a confirmação de aceite. Qualquer versão vinda do navegador
  é ignorada.
- Sessão válida → participante, cliente e sorteio vêm somente da sessão (já é o caso hoje).
- Releitura imediata da versão atual dos termos no banco, no instante da confirmação; é
  essa versão que fica gravada, junto com a data/hora.
- Sem versão atual publicada: nada é gravado, painel não é liberado, mensagem
  "Não há termos disponíveis para aceite no momento."
- Aceite já existente na versão atual: nada é regravado, nenhum evento duplicado, painel liberado.
- Cada aceite efetivo gera um novo evento de auditoria com participante, sorteio, versão,
  data/hora e origem "portal". Eventos anteriores permanecem — a auditoria é o histórico;
  os campos da participação guardam apenas o aceite vigente.
- Qualquer falha de gravação: painel não liberado e mensagem
  "Não foi possível registrar seu aceite. Tente novamente." sem detalhes técnicos.

## Correção na tela de termos

- Botão de aceitar desabilitado enquanto a caixa "Li e aceito os termos do sorteio" não
  estiver marcada; habilitado ao marcar.
- Erros tratados na própria página, com mensagem amigável e possibilidade de tentar de novo.
- Redireciona ao painel só depois de o servidor confirmar e o contexto ser revalidado
  mostrando o aceite da versão atual gravado.
- Conteúdo exibido dos termos permanece igual.

## Painel do participante

Mover o bloco com número do sorteio, período, data do sorteio e valor por cupom para
**abaixo** do botão "Registrar nota" e dos atalhos Minhas notas, Meus cupons e Informações
do sorteio. Nenhum texto, dado ou regra é alterado.

## Testes

Os 16 cenários solicitados, com um sorteio de teste: sem aceite vai para termos; botão
bloqueado e liberado conforme a caixa; versão e data/hora gravadas; evento de auditoria com
origem "portal"; reabrir não pede aceite; nova versão exige novo aceite e mantém o evento
anterior; tela com versão antiga + nova versão publicada grava a nova sem erro; versão e
participante falsos enviados pelo navegador ignorados; sessão inválida não aceita; falha de
gravação e ausência de termos com mensagem amigável e painel bloqueado.
Depois: typecheck, lint, build e remoção de todos os dados de teste. Sem commit, push ou deploy.

## Fora do escopo

CPF, telefone, cadastro, sessão, lembrar dispositivo, notas, correção de notas, cupons,
informações, limite de tentativas, URL pública e domínio, administração de Sorteios,
WhatsApp, Bot, Z-API, Conexões e demais módulos permanecem intactos.

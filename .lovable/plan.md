# Aceite dos termos + posição das informações no painel

## O que verifiquei no código atual

O aceite dos termos existe e grava nos campos já presentes em `sorteio_participantes`
(`aceite_termos_em`, `aceite_termos_versao`), comparados sempre com a versão marcada
como atual em `sorteio_termos`. Não é preciso criar nenhuma tabela ou campo novo.

Três pontos frágeis encontrados, que explicam o aceite parecendo "não funcionar":

1. O servidor exige que a versão enviada pelo navegador seja igual à versão atual do
   banco. Se o administrador publicar uma nova versão enquanto a tela estiver aberta,
   o aceite é recusado com "A versão dos termos não confere".
2. O botão de aceitar fica sempre clicável; a caixa de seleção só é checada depois do
   clique, com mensagem de erro.
3. Se ocorrer falha no servidor, o erro não é capturado na tela — o participante fica
   sem mensagem alguma e sem saber que pode tentar de novo.

## Correções

**Servidor (`aceitarTermosSorteio`)**
- Passar a ignorar a versão enviada pelo navegador: ler a versão atual direto do banco
  e gravar essa. Continuar exigindo apenas a confirmação de aceite.
- Sessão, participante e sorteio continuam vindo somente da sessão (já é o caso).
- Se não houver termos publicados, retornar mensagem amigável em vez de gravar aceite.
- Falha de gravação retorna "Não foi possível registrar seu aceite. Tente novamente."
  e o painel não é liberado.
- Aceite já feito na versão atual: nada é regravado, segue para o painel.
- Histórico: o aceite anterior continua registrado na auditoria do sorteio (evento de
  termos aceitos com a versão), portanto nada é perdido ao surgir uma nova versão.

**Tela de termos (`/sorteios-publico/termos`)**
- Botão desabilitado enquanto a caixa "Li e aceito os termos do sorteio" não estiver marcada.
- Envolver a confirmação em tratamento de erro, mostrando mensagem amigável e permitindo
  nova tentativa, sem detalhes técnicos.
- Depois do aceite, revalidar a sessão e ir para o painel (comportamento atual mantido).

## Painel do participante

Mover o bloco com número do sorteio, período, data do sorteio e valor por cupom para
**abaixo** do botão "Registrar nota" e dos atalhos (Minhas notas, Meus cupons,
Informações do sorteio). Nenhuma outra mudança de conteúdo.

## Testes

Fluxo verificado no navegador com um sorteio de teste: participante sem aceite é levado
para os termos; botão bloqueado sem marcar; aceite grava versão e data no banco; painel
liberado; reabrir o portal não pede aceite de novo; publicar nova versão exige novo
aceite e a auditoria mantém o registro anterior; envio de versão diferente pelo
navegador é ignorado; sessão inválida não permite aceitar. Ao final: typecheck, lint e
build, e remoção dos dados de teste. Sem commit, push ou deploy.

## Fora do escopo

CPF, telefone, cadastro, sessão, notas, cupons, informações, limite de tentativas, URL
pública, administração de Sorteios, WhatsApp, Bot e Conexões permanecem intactos.

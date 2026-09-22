# Erro intermitente ao importar currículo com a chave Gemini

## O que está acontecendo

A tela mostra sempre a mesma mensagem genérica ("Não foi possível interpretar o currículo agora") para qualquer falha da IA. Hoje o sistema:

- faz **uma única tentativa** na IA: se o Google responder "servidor ocupado" ou "muitas requisições", a importação falha na hora, sem nova tentativa — isso explica o comportamento de falhar às vezes e funcionar em seguida;
- **não guarda nenhum registro** do motivo da recusa (o erro do Google é descartado), então não é possível afirmar hoje qual foi a causa de cada falha;
- trata como "indisponível" também o caso em que a IA responde, mas o conteúdo volta cortado/incompleto (currículos longos), sem limite de tamanho de resposta definido.

A configuração atual usa a chave própria do Google com o modelo `gemini-3.6-flash`. Se esse nome de modelo não for aceito pela conta, a recusa é permanente, e não intermitente — por isso o registro do motivo entra como primeiro passo.

## O que será feito

1. **Registrar o motivo real da falha** (no log do servidor, sem expor a chave): código de resposta do Google e a mensagem devolvida. Assim cada falha passa a ter causa identificada.
2. **Tentar de novo automaticamente** quando a recusa for temporária (ocupado / limite momentâneo): até 3 tentativas com pequena espera crescente, sem o usuário precisar repetir o envio.
3. **Mensagens específicas na tela**, em vez de uma só genérica:
   - serviço ocupado → "O serviço de IA está ocupado. Tente novamente em alguns instantes."
   - limite de uso / cota → mensagem de limite atingido;
   - chave inválida ou sem permissão → "A chave da IA foi recusada. Verifique a configuração na aba IA."
   - modelo inexistente → "O modelo configurado não está disponível para esta chave."
4. **Resposta cortada**: definir um limite de saída folgado e, quando o conteúdo voltar incompleto, tratar como falha temporária (entra na nova tentativa) em vez de erro final.
5. **Verificação**: enviar um currículo real pelo navegador e conferir o log do servidor mostrando a resposta do Google, confirmando qual era a causa.

## Fora do escopo

Nada muda na tela de Configurações → IA, no armazenamento da chave, nos sorteios, nos clientes ou na leitura do arquivo PDF/DOC. Apenas a chamada à IA e as mensagens de erro da importação.

## Detalhes técnicos

- `src/lib/ia-chave.server.ts`: em `textoGeminiDireto` e nos demais caminhos, acrescentar `console.error` com status + corpo do erro (nunca a chave); acrescentar `maxOutputTokens` no `generationConfig`; devolver em `ResultadoIA` também o motivo de parada (`finishReason`) para identificar resposta truncada.
- Nova função de repetição (tentativas para 429/500/503 e falha de rede `status 0`) aplicada em `gerarTextoIA`, com espera de ~0,8s e ~2s.
- `src/lib/curriculo-import.server.ts`: `interpretarTexto` passa a lançar códigos distintos (`IA_OCUPADA`, `IA_CHAVE`, `IA_MODELO`, além dos atuais `IA_LIMITE`, `IA_CREDITOS`, `IA_INDISPONIVEL`).
- `src/lib/curriculo-import.ts` (`mensagemErroImportacao`): novas mensagens para os códigos acima; `ImportarCurriculo.tsx` continua exibindo o texto retornado, sem mudança estrutural.

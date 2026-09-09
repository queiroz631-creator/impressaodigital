# Melhoria 27 — Lembrar da autorização do QZ Tray

Hoje, a cada conexão, o QZ Tray abre a janela perguntando se o site pode acessar as impressoras, porque a conexão é feita sem assinatura digital. A correção oficial é assinar a conexão com um certificado próprio: assim o QZ Tray mostra o pedido de autorização apenas uma vez (com a opção de lembrar), em vez de perguntar toda hora.

## Como vai funcionar

- Será gerado um certificado digital próprio do sistema (par de chaves).
- A parte pública do certificado fica no código do site e é apresentada ao QZ Tray na conexão.
- A parte privada fica guardada como segredo no backend e é usada por uma função de servidor que assina cada conexão.
- Com a conexão assinada, o QZ Tray passa a oferecer "lembrar esta decisão" e não volta a perguntar.
- Se o certificado não estiver configurado, tudo continua funcionando como hoje (pergunta a cada vez), sem quebrar a impressão.
- Nenhuma mudança de layout nem nas telas de impressão — apenas a camada de conexão.

## Detalhes técnicos

1. Gerar par de chaves RSA + certificado autoassinado (openssl, via sandbox):
   - chave privada → salva como segredo `QZ_PRIVATE_KEY` no backend;
   - certificado público (PEM) → gravado em `src/lib/qz-certificado.ts` (constante).
2. Nova server function `assinarQz` em `src/lib/impressora.functions.ts`:
   - `createServerFn` POST sem middleware de auth (assinatura é operação neutra do site; o conteúdo assinado é apenas o hash de handshake do QZ);
   - lê `process.env.QZ_PRIVATE_KEY` dentro do handler e assina com `crypto.sign("sha512", ..., RSA-PSS)` conforme exigido pelo QZ Tray 2.x.
3. `src/lib/impressora.ts` (`carregarQz`):
   - se o certificado existir, chamar `qz.security.setCertificatePromise` (resolve o PEM) e `qz.security.setSignaturePromise` (chama `assinarQz`), antes de qualquer `connect`.
4. Validar com typecheck + build.
5. Marcar a melhoria 27 como executada (`executada = true`, mantendo `status = 'pendente'`).

## Observação

Mesmo com assinatura, na **primeira** conexão de cada computador o QZ Tray pode exibir a janela uma vez com a opção de lembrar a decisão — depois disso, não pergunta mais.

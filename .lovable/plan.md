# Link do currículo aparece como "expirado"

## Diagnóstico (verificado)

O token continua válido no banco (ativo, expira em 24/08). Testando o mesmo link:

- No ambiente de trabalho (preview): abre normalmente na etapa "Identificação".
- No site publicado (`calculadoraimpressao.lovable.app`): mostra "Este link expirou".

Ou seja, o problema não é o link: o site publicado ainda roda a versão antiga do sistema, anterior ao recurso de "link para novo currículo". Nessa versão o servidor não sabe lidar com um link sem currículo atrelado e devolve erro, que a tela traduz como "expirou".

## Correção

1. Publicar a versão atual do sistema. Isso é o que efetivamente faz o link funcionar para o cliente.
2. Melhorar a mensagem de erro da página pública para não dizer sempre "expirou": distinguir
   - link inválido/não encontrado,
   - link já expirado,
   - falha temporária (com botão "Tentar novamente").
   Assim, se algo falhar no futuro, a causa fica clara em vez de sempre parecer expiração.

## Detalhes técnicos

- `carregarPublico`/`lerLink` em `src/lib/curriculo.server.ts` já lançam `LINK_INVALIDO` e `LINK_EXPIRADO`; propagar esses códigos e tratá-los em `src/routes/curriculo.publico.$token.tsx`, hoje com uma única mensagem fixa.
- Sem alteração de banco e sem mudança na lógica de geração de links.

## Teste

Após publicar, abrir o link `abc53a2b…` no domínio publicado e confirmar que a etapa de identificação (nome, CPF, telefone) aparece.

# Corrigir o link de currículo enviado pelo fluxo do bot

## Causa (verificada)

O token gerado está correto (ativo, validade de 24h). O problema é o **endereço** que o bot envia.

Mensagens enviadas hoje (02/09):

```text
https://project--794a07c8-...-lovable.app/curriculo/publico/7200f7b1...
```

Mensagens antigas (31/08), que funcionavam:

```text
https://calculadoraimpressao.lovable.app/curriculo/publico/e0dd4227...
```

O endereço é montado a partir da origem da requisição do webhook do WhatsApp. Como a Z-API passou a chamar o endereço interno do projeto (`project--<id>.lovable.app`), é esse domínio que vai para o cliente — e ele não abre como o site oficial.

## Correção

1. Ao montar links públicos, usar sempre o domínio público oficial do sistema (`SITE_URL`, com `calculadoraimpressao.lovable.app` como padrão), ignorando as origens internas: `localhost`, `127.0.0.1`, `*-dev.lovable.app`, `id-preview--*.lovable.app` e `project--*.lovable.app`.
2. Isso vale para todos os links gerados no servidor (currículo do fluxo do bot, currículo da tela e orçamento), já que compartilham a mesma função.

## Detalhes técnicos

- `urlBase()` em `src/lib/link-dados.server.ts`: além dos hosts locais, descartar hostnames que casem com os padrões internos da plataforma; nesses casos cair direto em `SITE_URL` → domínio publicado.
- Nenhuma alteração de banco. Tokens já emitidos continuam válidos — basta trocar o domínio na URL.

## Teste

Rodar o fluxo "Iniciar currículo" pelo WhatsApp e conferir que o link recebido usa `calculadoraimpressao.lovable.app` e abre na etapa de identificação (nome, CPF, telefone).

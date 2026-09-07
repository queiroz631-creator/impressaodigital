# Mudar domínio publicado para impressadigital.lovable.app

## Objetivo
Alterar o endereço público do sistema de `calculadoraimpressao.lovable.app` para `impressadigital.lovable.app`.

## Risco / limitação importante
O Lovable não mantém redirecionamento automático do slug antigo para o novo. Depois da mudança:
- O endereço antigo (`calculadoraimpressao.lovable.app`) vai parar de responder.
- Links de currículos e orçamentos já enviados para clientes vão quebrar.
- Tokens continuam válidos no banco; basta trocar o domínio na URL para reabrir.

Se você precisa que links antigos continuem funcionando, a alternativa é **conectar um domínio próprio** (ex.: `impressadigital.com`) e mantê-lo como endereço principal, independente do slug Lovable.

## Passos
1. **Publicar com novo slug**
   - Usar `preview_ui--publish` com `slug: "impressadigital"`.
   - Isso torna o site acessível em `https://impressadigital.lovable.app`.

2. **Atualizar SITE_URL no código**
   - Em `src/lib/link-dados.server.ts`, alterar o fallback de `https://calculadoraimpressao.lovable.app` para `https://impressadigital.lovable.app`.
   - Isso garante que links públicos de currículo e orçamento gerados pelo servidor usem o novo domínio.

3. **Verificar outras referências**
   - Buscar ocorrências de `calculadoraimpressao` no código/configuração (webhooks, Z-API callbacks, etc.) e atualizar se necessário.

4. **Testar**
   - Gerar um novo link de currículo/orçamento e confirmar que a URL começa com `https://impressadigital.lovable.app`.
   - Abrir o link e conferir que o formulário de identificação/orçamento carrega.

## Observação
Se você confirmar, posso executar a publicação com o novo slug e atualizar o fallback no código. Caso prefira manter links antigos funcionando, sugiro discutirmos domínio próprio antes.

# Corrigir o link público do currículo

## O que está acontecendo

O link em si é válido: o token `abc53a2b…` existe no banco, está ativo e só expira em 24/08. O problema é o endereço gerado: `http://localhost:8080/...`. Esse endereço aponta para o computador de quem abre o link, não para o sistema — por isso não abre nem para você fora do editor, nem para o cliente.

O endereço é montado no servidor a partir da origem da requisição. Quando a geração acontece no ambiente interno, essa origem vem como `localhost:8080` e é isso que vai para a área de transferência.

## Correção

1. Ao montar o link, ignorar origens locais (`localhost`, `127.0.0.1`) e usar nessa situação o domínio público do sistema (`SITE_URL`, com o domínio publicado como padrão).
2. Como garantia adicional, nas telas que copiam o link (lista de currículos e tela do currículo), reescrever o endereço usando a origem real do navegador quando o servidor devolver um endereço local. Assim o link copiado é sempre o mesmo domínio em que você está navegando.
3. Aplicar o mesmo tratamento aos demais links públicos gerados pelo mesmo utilitário (orçamento), já que compartilham a função de base de URL.

## Detalhes técnicos

- `urlBase()` em `src/lib/link-dados.server.ts`: descartar origem com hostname local; ordem de preferência = origem da requisição (não-local) → `SITE_URL` → domínio publicado.
- Helper no cliente para normalizar a URL recebida (`new URL(url)`; se hostname for local, trocar por `window.location.origin`), usado em `src/routes/curriculos.index.tsx` e `src/routes/curriculos.$id.tsx`.
- Nenhuma mudança de banco; tokens já emitidos continuam válidos (só o domínio muda).

## Teste

Gerar um novo link para novo currículo, conferir que a URL copiada usa o domínio público e abrir o token atual nesse domínio para confirmar que o formulário de identificação aparece.

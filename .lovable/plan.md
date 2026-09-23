# Logo do portal de sorteios pela tela de Sorteios

## O que muda para você

No módulo Marketing → Sorteios, no cartão **Link público do portal**, aparece também a logo que o portal mostra hoje, com um botão **Trocar logo** (ou **Adicionar logo**, quando ainda não houver uma enviada) e, quando houver uma logo enviada, um botão **Voltar à logo padrão**.

- Ao clicar, você escolhe uma imagem do computador ou do celular (PNG, JPG, WEBP ou SVG, até 2 MB).
- A imagem é enviada e passa a aparecer no topo do portal de sorteios imediatamente, para todos os participantes.
- Enquanto nenhuma imagem for enviada, o portal continua com a logo atual da Queiroz Papelaria.
- Só quem tem permissão de gestão de sorteios pode trocar a logo.

## Detalhes técnicos

- **Armazenamento**: novo bucket público `portal-sorteios` (limite de 2 MB), criado pela ferramenta de storage; políticas de leitura pública e de escrita restrita em `storage.objects` via migração datada, gravada também em `supabase/migrations/`.
- **Banco**: nova coluna nulável `sorteio_logo_url TEXT` em `public.configuracoes` (migração aditiva, sem quebrar nada).
- **Servidor** (`src/modules/sorteios/...` / novo `src/lib/sorteio-logo.functions.ts`):
  - `salvarLogoSorteio` — server fn autenticada com a permissão de gestão de sorteios; recebe o arquivo em base64, valida tipo e tamanho, envia ao bucket com nome único (`logo-<timestamp>.<ext>`), grava a URL pública em `configuracoes.sorteio_logo_url` e registra auditoria (`sorteio.logo_alterada`).
  - `limparLogoSorteio` — zera a coluna, voltando à logo padrão.
  - `logoPortalPublica` — server fn pública (sem login, usada pelo portal) que devolve somente a URL da logo.
- **Portal** (`LayoutPublico.tsx`): busca a URL pela função pública e usa a imagem enviada; se estiver vazia ou falhar o carregamento, cai no import atual de `logo-queiroz-sorteios.png.asset.json`. Nenhuma outra mudança visual no portal.
- **Tela de Sorteios** (`src/routes/sorteios.index.tsx`): prévia da logo + input de arquivo oculto, react-query para carregar/invalidar e mensagens com sonner, no padrão das demais telas.
- Para valer no servidor da loja, será necessário o `git pull` + deploy de sempre (a migração já vai na pasta oficial).

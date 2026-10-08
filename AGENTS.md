<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- VPS migrations must use unique 14-digit timestamp filenames in dependency order; the deploy validates names before database access to prevent numbered files from running before table creation.
- VPS Storage provisioning updates existing buckets, creates only after an explicit not-found response, retries creation conflicts as updates, and fails clearly on access/size errors without deleting objects or silently lowering limits.

- O aplicativo Windows unificado vive em `api-local/`: sincronização e backup compartilham janela, bandeja e inicialização, mas mantêm tokens e rotinas independentes para evitar regressões.
- O FOTO EXPRESS vive isolado em `src/modules/foto-express/`; originais, thumbnails e impressões usam buckets privados separados, e itens duplicados reutilizam o mesmo arquivo original para manter a edição não destrutiva.
- No editor FOTO EXPRESS, formato/zoom/posição/rotação/orientação/modo são canônicos e salvos atomicamente; a orientação não altera as dimensões cadastradas, mas gira a proporção exibida na Galeria e no editor; o crop é derivado e normalizado nas coordenadas do original.
- Textos do FOTO EXPRESS pertencem ao item e usam posição, largura e tamanho normalizados sobre a área física completa do formato, independentes da transformação da fotografia.
- A aplicação ou remoção global de um texto no FOTO EXPRESS usa a camada de mesma ordem em uma única operação transacional; cópias aplicadas continuam independentes.
- Exclusões e uploads incompletos do FOTO EXPRESS usam uma fila transacional no banco; objetos do Storage só são removidos no servidor após o banco liberar a limpeza.
- A montagem do FOTO EXPRESS usa um motor puro, determinístico e baseado em milímetros: o papel mantém sempre largura e altura cadastradas, enquanto Retrato/Paisagem/Automática controlam somente a peça completa (formato, foto e textos); plano, folhas e ocorrências são persistidos atomicamente.
- Papéis de montagem do FOTO EXPRESS são catálogos reutilizáveis; cada montagem persiste um snapshot das medidas para preservar histórico e gerações.
- O orçamento do FOTO EXPRESS reutiliza o mesmo motor de montagem; preço e linha do papel são congelados no envio ou na montagem para não mudar com o catálogo.
- Cada lote do FOTO EXPRESS exige um formato com papel padrão; a revisão agrupa e persiste as folhas por papel em uma única montagem atômica.
- Cada formato do FOTO EXPRESS persiste uma cor de identificação usada consistentemente nos cards de cadastro e da Galeria.
- Na revisão do FOTO EXPRESS, o papel pode ser substituído apenas para a nova montagem, de forma geral ou por grupo, sem alterar o papel padrão do formato.
- A visibilidade de formato no portal é independente do status interno; novas escolhas públicas exigem formato ativo e visível, preservando itens antigos.
- Formatos do FOTO EXPRESS podem ter um nome público independente; o portal usa esse nome e recorre ao nome interno quando ele não estiver preenchido.
- A geração final do FOTO EXPRESS usa snapshot imutável, renderização Canvas a 300 DPI e empacotamento PDF interno com as folhas JPEG no navegador; o servidor define destinos, autoriza uploads e valida integralmente os arquivos antes de concluí-los, evitando dependências incompatíveis com o bundle publicado.
- O editor FOTO EXPRESS usa uma lista leve de IDs para navegar; somente a foto aberta recebe URL temporária, evitando limites do Storage em trabalhos grandes.
- O fluxo de status do FOTO EXPRESS distingue criação interna, edição no portal, recebimento, preparação, impressão e finalização para organizar as filas sem misturar responsabilidades.
- The public FOTO EXPRESS portal uses its own HttpOnly customer sessions and server-side ownership checks; customers may edit only before submission, while assembly and printing remain staff-only.
- A staff user may reopen a portal album only before printing begins; reopening invalidates any prepared assembly before restoring customer editing.
- The FOTO EXPRESS portal logo is managed independently from other portals and stored privately; public pages receive only temporary signed image URLs.
- WhatsApp customer tickets use a dedicated dialog and authenticated name-update functions with the user-scoped client; this updates the master customer rather than only print text.
- WhatsApp thermal tickets share their HTML between QZ and isolated browser-frame printing, retaining the per-user, per-browser QZ printer preference; this preserves payment emphasis without changing other printer defaults.
- WhatsApp ticket payment frames use a full-width, collapsed-border single-cell table with page splitting disabled; this keeps the frame within the printable width and avoids displaced block borders in QZ HTML rendering.

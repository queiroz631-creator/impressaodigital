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

- O aplicativo Windows unificado vive em `api-local/`: sincronização e backup compartilham janela, bandeja e inicialização, mas mantêm tokens e rotinas independentes para evitar regressões.
- O FOTO EXPRESS vive isolado em `src/modules/foto-express/`; originais, thumbnails e impressões usam buckets privados separados, e itens duplicados reutilizam o mesmo arquivo original para manter a edição não destrutiva.
- No editor FOTO EXPRESS, formato/zoom/posição/rotação/orientação/modo são canônicos e salvos atomicamente; o crop é derivado e normalizado nas coordenadas do original para futura renderização fiel.
- Textos do FOTO EXPRESS pertencem ao item e usam posição, largura e tamanho normalizados sobre a área física completa do formato, independentes da transformação da fotografia.
- A aplicação de um texto em todas as fotos do FOTO EXPRESS cria cópias independentes por item em uma única operação transacional.
- Exclusões e uploads incompletos do FOTO EXPRESS usam uma fila transacional no banco; objetos do Storage só são removidos no servidor após o banco liberar a limpeza.
- A montagem do FOTO EXPRESS usa um motor puro, determinístico e baseado em milímetros que mantém a folha fixa e gira a peça completa (formato, foto e textos juntos); Retrato/Paisagem forçam essa posição, Automática otimiza ambas e prioriza menos folhas; plano, folhas e ocorrências são persistidos atomicamente.
- Papéis de montagem do FOTO EXPRESS são catálogos reutilizáveis; cada montagem persiste um snapshot das medidas para preservar histórico e gerações.
- Cada lote do FOTO EXPRESS exige um formato com papel padrão; a revisão agrupa e persiste as folhas por papel em uma única montagem atômica.
- Cada formato do FOTO EXPRESS persiste uma cor de identificação usada consistentemente nos cards de cadastro e da Galeria.
- A geração final do FOTO EXPRESS usa snapshot imutável e renderização Canvas a 300 DPI no navegador; o servidor define destinos, autoriza uploads e valida integralmente os arquivos antes de concluí-los.
- O editor FOTO EXPRESS usa uma lista leve de IDs para navegar; somente a foto aberta recebe URL temporária, evitando limites do Storage em trabalhos grandes.
- O status do trabalho FOTO EXPRESS avança no banco conforme edição, confirmação da montagem e conclusão da impressão; finalizar permanece uma ação manual.
- The public FOTO EXPRESS portal uses its own HttpOnly customer sessions and server-side ownership checks; customers may edit only before submission, while assembly and printing remain staff-only.

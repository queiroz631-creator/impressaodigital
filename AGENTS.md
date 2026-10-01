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
- No editor FOTO EXPRESS, zoom/posição/rotação/orientação/modo são canônicos; o crop é derivado e normalizado nas coordenadas do original para futura renderização fiel.
- Exclusões e uploads incompletos do FOTO EXPRESS usam uma fila transacional no banco; objetos do Storage só são removidos no servidor após o banco liberar a limpeza.

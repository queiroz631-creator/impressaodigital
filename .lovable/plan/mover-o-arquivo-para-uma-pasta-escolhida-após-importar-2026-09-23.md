# Mover o arquivo para uma pasta escolhida após importar

Hoje o arquivo do currículo é apenas lido pelo navegador e nada acontece com ele. A ideia é: depois que o rascunho do currículo é criado (ou atualizado), o arquivo sai da pasta onde estava e vai para uma pasta de arquivamento escolhida uma única vez.

## Como vai funcionar

1. Na tela de importar currículo aparece uma linha nova: **Pasta de arquivamento** com o nome da pasta escolhida e o botão "Escolher pasta" / "Trocar pasta". Também um botão "Não arquivar" para desligar.
2. A pasta é escolhida uma vez e fica guardada no navegador daquele computador — nas próximas importações o sistema só pede uma confirmação rápida de acesso (exigência do navegador).
3. O arquivo precisa ser escolhido pelo botão "Selecionar arquivo" ou arrastado para a janela — nos dois casos o sistema consegue mexer no arquivo original.
4. Quando o currículo é criado ou atualizado com sucesso, o arquivo é copiado para a pasta escolhida e apagado do lugar de origem. Se já existir um arquivo com o mesmo nome no destino, é acrescentado um sufixo com data e hora.
5. Ao terminar, o aviso na tela diz: "Currículo importado. Arquivo movido para <pasta>." Se algo impedir a mudança (permissão negada, arquivo aberto no Word, navegador sem suporte), o currículo continua importado normalmente e aparece um aviso em laranja explicando que o arquivo ficou onde estava.

## Limitações a deixar claras na tela

- Funciona no Chrome e no Edge do computador. No celular, no Firefox e no Safari o recurso não existe: a importação segue igual, sem mover nada, e o botão da pasta aparece desativado com a explicação.
- A pasta de destino é por computador e por navegador — cada máquina escolhe a sua.

## Detalhes técnicos

- Novo `src/lib/curriculo-arquivo.ts`: wrapper do File System Access API — `suportaArquivamento()`, `escolherPastaDestino()` (`showDirectoryPicker({ mode: "readwrite" })`), `lerPastaSalva()` / `salvarPasta()` / `limparPasta()` guardando o `FileSystemDirectoryHandle` em IndexedDB (handles não sobrevivem em `localStorage`), `garantirPermissao(handle)` via `queryPermission`/`requestPermission`, e `moverArquivo(fileHandle, dirHandle)` que cria o arquivo no destino (`createWritable` + stream do `File`), depois remove o original com `fileHandle.remove()`; nome único com sufixo `-AAAAMMDD-HHMM` em caso de conflito. Erros normalizados em códigos (`SEM_SUPORTE`, `SEM_PERMISSAO`, `ARQUIVO_EM_USO`, `FALHA_MOVER`) com mensagens em português.
- `ImportarCurriculo.tsx`: seleção passa a usar `showOpenFilePicker` quando disponível (guardando o `FileSystemFileHandle` em estado, ao lado do `File`), mantendo o `<input type="file">` como alternativa quando o navegador não suporta; no arrastar, `item.getAsFileSystemHandle()` quando disponível. O `processar()` não muda. Em `continuar()`, após `onImportado(r.id)` e antes de `limpar()`, chama `moverArquivo` se houver handle de arquivo e de pasta; resultado entra na mensagem de sucesso ou num aviso laranja.
- Nada é enviado para o servidor: sem mudança de banco, de storage, de migração ou de função de servidor.

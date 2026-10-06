# Organização dos álbuns do FOTO EXPRESS

## Resultado
- Exibir os álbuns em abas, nesta ordem: Rascunho, Portal, Em edição, Recebido, Pronto para impressão, Impresso e Finalizado.
- Mostrar a quantidade de álbuns em cada aba e manter busca dentro da aba selecionada.
- Álbuns criados pelo cliente ficam em Portal enquanto editáveis; quando enviados, passam para Recebido; a montagem confirmada leva a Pronto para impressão.
- A equipe continua podendo editar álbuns em Portal e Recebido; reabrir um álbum recebido o devolve para Portal.
- Mostrar no lado esquerdo de cada card uma miniatura circular de uma foto do álbum, com fallback quando não houver foto.
- Remover “Novo Álbum” do menu e abrir a criação em um modal pelo botão da página de álbuns.
- Manter o grupo do menu lateral aberto durante a navegação e usar a navegação interna sem recarregar a página.
- Na revisão, substituir a lista sempre aberta por um botão “Avisos da revisão”, com quantidade e janela para consultar os avisos.

## Dados e compatibilidade
- Ampliar os status permitidos com PORTAL e RECEBIDO.
- Classificar os álbuns antigos do portal: enviados como Recebido; ainda editáveis como Portal, preservando os demais estados já avançados.
- Atualizar as transições automáticas sem alterar montagem, papel, orientação, preços ou geração.
- Registrar a migração oficial em `supabase/migrations/` e aplicá-la no backend com o mesmo SQL.

## Validação
- Conferir abas, contadores, busca, modal, miniaturas e persistência do menu em desktop e celular.
- Conferir as transições Portal → Recebido → Pronto para impressão e Recebido → Portal ao reabrir.
- Conferir o botão e a janela de avisos da revisão.
- Validar compilação e erros da prévia, sem publicar.

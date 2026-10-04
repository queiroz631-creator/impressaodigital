# Corrigir troca de fotos no editor

## Implementação
- Ao navegar para a foto anterior ou próxima, limpar o estado carregado da foto atual antes da troca.
- Manter a tela de carregamento enquanto a próxima foto, seu formato e sua configuração são sincronizados.
- Evitar que o editor avalie a foto nova com o formato antigo e mostre “Escolha um formato” indevidamente.

## Validação
- Testar a navegação entre as fotos do Álbum 8.
- Confirmar que a próxima foto abre com seu formato e sem o aviso incorreto.

# Portal público FOTO EXPRESS

## Objetivo
Criar uma experiência pública da Impressão Digital para o cliente conhecer o serviço, entrar com CPF e telefone, manter seus próprios trabalhos de fotos e enviá-los para produção. Após o envio, o pedido fica bloqueado para o cliente; somente a equipe autorizada poderá montar folhas, gerar arquivos e imprimir.

## Experiência do cliente
1. Criar uma página pública acolhedora, com fotografia realista de momentos familiares, identidade própria da Impressão Digital e chamada “Eternize seus momentos”.
2. O botão principal inicia o acesso em três passos: CPF, confirmação do telefone e complemento de nome/data de nascimento quando necessário.
3. Manter sessão segura no dispositivo, com opção “Lembrar neste dispositivo” e saída da conta.
4. Exibir uma área exclusiva com histórico dos próprios trabalhos, situação de cada pedido e botão para criar novo trabalho.
5. No trabalho em rascunho, permitir os recursos já existentes para o cliente: escolher formato antes do envio, adicionar fotos, definir cópias e orientação, duplicar/excluir, editar enquadramento, zoom, rotação, espelhamento e textos.
6. Substituir a revisão interna por uma conferência simples do pedido e uma ação clara “Enviar para impressão”. Após confirmação, bloquear todas as alterações e mostrar o acompanhamento do status.

## Separação entre cliente e equipe
- O portal público não terá menus, links ou acesso às páginas administrativas.
- O cliente verá e alterará somente trabalhos vinculados ao próprio cadastro e somente enquanto estiverem em rascunho/edição.
- Formatos ativos serão somente leitura no portal.
- Montagem de folhas, papéis, geração de JPG/PDF, downloads de produção, impressão, finalização e configurações permanecerão exclusivas da equipe.
- A tela interna continuará mostrando os pedidos enviados para a equipe montar e imprimir.

## Segurança e dados
- Criar sessões próprias do portal de fotos em cookie seguro, independentes das sessões do sorteio.
- Validar CPF, telefone, limites de tentativas e propriedade do trabalho no servidor em toda leitura ou alteração.
- Usar autorizações temporárias e restritas para originais e miniaturas; nunca expor os arquivos privados diretamente.
- Criar funções específicas do portal para trabalhos, uploads, edição e textos, sem afrouxar as permissões atuais da equipe.
- Adicionar uma situação de envio do cliente que não conflite com o fluxo interno: rascunho/edição → aguardando produção → pronto para impressão → impresso → finalizado.
- Aplicar a mudança em migração incremental, idêntica nas duas pastas oficiais, com permissões explícitas e sem alterar dados existentes.

## Estrutura técnica
- Novas rotas públicas sob `/fotos`: apresentação, CPF, telefone, cadastro, trabalhos, novo trabalho, galeria, editor e acompanhamento.
- Componentes públicos próprios em `src/modules/foto-express/portal/`, reutilizando apenas o motor visual e matemático do editor.
- Funções públicas em módulos `*.functions.ts` com auxiliares exclusivos de servidor em `*.server.ts`.
- Adaptar os componentes de galeria/editor para receber o contexto de acesso, evitando duplicar regras visuais e mantendo as operações administrativas separadas.
- Incluir metadados próprios por rota e impedir indexação das telas com dados do cliente.

## Validação
- Testar criação/retorno de sessão, isolamento entre clientes, bloqueio após envio e rejeição de IDs pertencentes a outro cliente.
- Testar upload, edição, textos, troca de formato, cópias e finalização sem usar dados reais.
- Confirmar que o pedido enviado aparece no fluxo interno e que o portal não consegue montar, gerar ou imprimir.
- Conferir apresentação, cadastro, lista, galeria e editor em celular e computador, além da compilação e dos registros de erro.
- Não publicar; a publicação só ocorrerá mediante pedido explícito.

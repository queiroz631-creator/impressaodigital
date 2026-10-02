# Papéis de montagem do FOTO EXPRESS

## Objetivo
Criar uma tela própria para cadastrar e manter papéis de montagem reutilizáveis. Na Revisão, o bloco “Papel e montagem” deixará de editar medidas e passará a selecionar um papel ativo já configurado.

## Tela Papéis
- Adicionar “Papéis” ao menu do FOTO EXPRESS e criar a página `/foto-express/papeis`.
- Listar os papéis cadastrados com nome, tamanho, orientação, margens, espaçamento, giro permitido e situação ativo/inativo.
- Permitir criar e editar um papel com: nome, largura e altura em milímetros, orientação automática/retrato/paisagem, quatro margens independentes, espaçamento entre fotos e permissão para girar peças.
- Validar medidas positivas e impedir margens que eliminem a área útil.
- Usar ativação/desativação em vez de exclusão, preservando montagens já realizadas.

## Papéis iniciais
- Migrar A4 e A3 para o novo cadastro com os valores atualmente usados: margens de 5 mm, espaçamento de 2 mm, orientação automática e giro permitido.
- Manter esses registros editáveis e ativos, sem alterar trabalhos ou montagens existentes.

## Revisão e montagem
- Substituir os controles atuais por um único seletor de papel ativo.
- Ao selecionar um papel, recalcular imediatamente a prévia, quantidade de folhas, orientação escolhida e aproveitamento usando toda a configuração cadastrada.
- Quando houver montagem já salva, recuperar o papel vinculado; se ele estiver inativo, mantê-lo visível apenas naquele trabalho para não quebrar o histórico.
- Continuar salvando no trabalho um retrato das dimensões, margens, orientação, espaçamento e giro utilizados. Alterações futuras no cadastro não modificarão montagens confirmadas nem gerações existentes.

## Banco e segurança
- Criar tabela própria de papéis com identificador estável, nome, dimensões, configuração completa, ordem, ativo e datas.
- Aplicar acesso autenticado, políticas de leitura do FOTO EXPRESS e escrita somente com a permissão de gerenciamento já usada em Formatos.
- Vincular novas montagens ao papel cadastrado de forma incremental, preservando também os campos atuais como snapshot histórico.
- Atualizar a função atômica de confirmação para validar o papel ativo e confirmar que os valores enviados correspondem ao cadastro selecionado.
- Registrar a migration tanto no fluxo da plataforma quanto na pasta oficial `supabase/migrations/`.

## Validação
- Testar cadastro e edição de A4, A3 e medida personalizada; margens inválidas; ativação/inativação; seletor da Revisão; reconstrução de montagem existente; prévia e geração final.
- Validar permissões, concorrência, desktop e celular sem alterar trabalhos reais, sem publicar e sem adicionar dependências.

## Detalhes técnicos
- O motor de montagem deixará de depender do catálogo fixo `PAPEIS` e receberá largura/altura do papel selecionado.
- A assinatura da montagem incluirá o identificador e a configuração completa do papel.
- O snapshot imutável continuará sendo a fonte da verdade para PDF/JPG, evitando que uma edição posterior do cadastro altere uma geração já confirmada.

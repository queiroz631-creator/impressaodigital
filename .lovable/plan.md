# Ajustes no formulário de Currículo

Quatro correções no assistente de currículo (usado tanto na tela administrativa quanto no link público).

## 1. Escolaridade: repetir nível + curso nas formações extras

Hoje o bloco "Outras formações" pede apenas curso, instituição e ano.

- Cada formação adicional passa a ter um seletor de nível com apenas duas opções: "Ensino Superior" (incompleto/cursando/completo) e "Pós-graduação", além do nome do curso, instituição e ano.
- O nível escolhido é exibido na revisão, no documento e no PDF junto do curso.
- Requer uma coluna nova `nivel` (texto, opcional) na tabela de formações do currículo.

## 2. Experiência profissional: atividades opcionais

- Em cada card de experiência, um par de botões "Informar atividades? Sim / Não".
- Com "Não", o campo de atividades fica oculto e é gravado vazio.
- Padrão para experiências novas: "Não" (campo escondido até o usuário escolher Sim); experiências já existentes com texto abrem em "Sim".

## 3. Habilidades digitadas devem ficar disponíveis para todos

Causa: no link público o formulário não recebe a função de cadastro, então habilidades digitadas por ali ficam apenas naquele currículo e nunca entram no catálogo compartilhado.

- Criar uma função de servidor no fluxo público que grava a habilidade nova no catálogo (validando duplicidade por descrição, sem diferenciar maiúsculas) e devolve o registro para marcar no formulário.
- Na tela administrativa, aplicar a mesma checagem de duplicidade antes de inserir, evitando repetição no catálogo.

## 4. Editar pela revisão deve voltar direto para a revisão

Hoje o botão "Editar" leva à etapa e obriga a percorrer todas as etapas seguintes de novo.

- Ao entrar em uma etapa a partir da revisão, o formulário guarda essa origem e o botão principal vira "Salvar e voltar à revisão", retornando à última etapa após gravar.
- O fluxo normal (primeiro preenchimento, etapa a etapa) continua igual.

## Detalhes técnicos

- Migração: `ALTER TABLE public.curriculo_formacoes ADD COLUMN nivel text` (nulo permitido).
- `src/lib/curriculo.ts`: incluir `nivel` em `FormacaoItem`; constante com os níveis permitidos nas formações extras.
- `src/lib/curriculo.functions.ts`: aceitar `nivel` no schema de formações e adicionar a função de criação de habilidade no fluxo público (com o token do link).
- `src/lib/curriculo.server.ts`: persistir `nivel`; implementar a criação/reuso de habilidade no catálogo.
- `src/components/curriculo/FormularioCurriculo.tsx`: seletor de nível, alternância de atividades, estado `origemRevisao` para o retorno à etapa de revisão.
- `src/routes/curriculos.$id.tsx` e `src/routes/curriculo.publico.$token.tsx`: gravar/ler `nivel` e passar `criarHabilidade` também no público.
- `src/components/curriculo/CurriculoDocumento.tsx` e `src/lib/curriculo-pdf.ts`: mostrar o nível junto da formação, mantendo o layout de página única já ajustado.

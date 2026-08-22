# Ajustes no formulário de Currículo

Quatro correções no assistente de currículo (usado tanto na tela administrativa quanto no link público).

## 1. Escolaridade: repetir nível, instituição e ano nas formações extras

Hoje o bloco "Outras formações" pede apenas curso, instituição e ano.

- Cada formação adicional passa a ter um seletor de nível com apenas duas opções: "Ensino Superior" e "Pós-graduação".
- Ao escolher qualquer uma das duas, aparecem os campos nome do curso, instituição e ano (ano opcional).
- O nível escolhido é exibido na revisão, no documento e no PDF junto do curso.
- Requer uma coluna nova `nivel` (texto, opcional) na tabela de formações do currículo.

## 2. Experiência profissional: atividades opcionais

- Em cada card de experiência, um par de botões "Informar atividades? Sim / Não".
- Com "Não", o campo de atividades fica oculto e é gravado vazio.
- Padrão para experiências novas: "Não" (campo escondido até o usuário escolher Sim); experiências já existentes com texto abrem em "Sim".

## 3. Habilidades digitadas pelo cliente ficam só no currículo dele

- Habilidade digitada no link público é gravada apenas no currículo em questão e nunca entra no catálogo compartilhado (comportamento atual mantido e garantido).
- Somente pela tela administrativa uma habilidade pode ser adicionada ao catálogo que aparece para todos, com checagem de duplicidade por descrição (sem diferenciar maiúsculas).


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

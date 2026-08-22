# Ajustes no formulário de Currículo

Quatro correções no assistente de currículo (usado tanto na tela administrativa quanto no link público).

## 1. Escolaridade: segunda graduação em um novo card

- Quando o cliente escolher qualquer tipo de curso superior (Incompleto, Cursando ou Completo), aparece automaticamente um novo card abaixo, com as mesmas opções de escolaridade (os tipos de Ensino Superior e Pós-graduação), para informar uma segunda graduação.
- Ao selecionar a opção nesse card, aparecem os campos: nome do curso, instituição e ano.
- Preenchendo o segundo card, surge outro card vazio na sequência, permitindo quantas graduações forem necessárias; cards em branco são ignorados ao salvar e cada card tem botão de remover.
- O nível escolhido aparece junto do curso na revisão, no documento e no PDF.
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
- `src/lib/curriculo.functions.ts`: aceitar `nivel` no schema de formações (sem função pública de criação de habilidade).
- `src/lib/curriculo.server.ts`: persistir `nivel`.
- `src/components/curriculo/FormularioCurriculo.tsx`: seletor de nível com instituição/ano, alternância de atividades, estado `origemRevisao` para o retorno à etapa de revisão.
- `src/routes/curriculos.$id.tsx` e `src/routes/curriculo.publico.$token.tsx`: gravar/ler `nivel`; o público continua sem `criarHabilidade`.
- `src/components/curriculo/CurriculoDocumento.tsx` e `src/lib/curriculo-pdf.ts`: mostrar o nível junto da formação, mantendo o layout de página única já ajustado.

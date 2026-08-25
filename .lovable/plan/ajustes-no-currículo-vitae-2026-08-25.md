# Ajustes no Currículo Vitae

Cinco mudanças pontuais, mantendo todo o resto como está.

## 1. Revisão no link do cliente
Hoje o formulário público termina em Habilidades e salva direto. Passa a ter a mesma etapa de Revisão do modo admin (etapa 8), com os blocos e o botão "Editar" de cada seção. A opção "Exibir data da última atualização" continua só no modo admin.

## 2. Cidade e UF pré-preenchidas
Em Dados pessoais, currículos novos já vêm com Cidade "Cariacica" e UF "ES", ambos editáveis normalmente. Currículos já salvos mantêm o que estiver gravado.

## 3. Campo Número
Novo campo "Número" ao lado da rua. Quando preenchido, o endereço aparece como "Rua Exemplo, 123" na visualização, na impressão e no PDF.

## 4. Experiência profissional
Pergunta "Possui experiência profissional?" (Sim/Não):
- Sim: mantém o comportamento atual de adicionar experiências.
- Não: some a lista e aparece um campo com a frase padrão "Em busca da 1ª oportunidade", editável. Essa frase é exibida em destaque dentro da seção Experiência profissional do currículo (visualização, impressão e PDF).

## 5. Observação em Habilidades
Na etapa Habilidades, opção para incluir uma observação. Se marcada, o texto aparece logo abaixo da lista de habilidades, prefixado por "OBS.: ", na visualização, impressão e PDF.

## Detalhes técnicos

Banco (`curriculos`), colunas novas:
- `numero text`
- `experiencia_possui boolean not null default true`
- `experiencia_frase text`
- `habilidades_observacao text`

Arquivos alterados:
- `src/lib/curriculo.ts`: tipos, `CamposCurriculo`, `enderecoLinhas` (rua + número) e helper da frase de experiência.
- `src/lib/curriculo.server.ts`: incluir as novas colunas na lista `CAMPOS`.
- `src/components/curriculo/FormularioCurriculo.tsx`: etapa de revisão também no modo público, defaults Cariacica/ES, campo Número, toggle de experiência com frase, observação de habilidades.
- `src/components/curriculo/CurriculoDocumento.tsx` e `src/lib/curriculo-pdf.ts`: renderizar frase de experiência em destaque e linha "OBS.: ...".

Nenhuma outra tela, fluxo ou configuração é tocada.

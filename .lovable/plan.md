# Importar currículo (Word/PDF) para preenchimento automático

Nova funcionalidade na tela CURRÍCULO VITAE: enviar um currículo pronto (PDF, DOC ou DOCX), o sistema lê o conteúdo, identifica as informações e abre o **formulário de currículo já existente** com tudo preenchido para revisão. Nada é salvo antes do usuário confirmar.

## Botão e janela de importação

Na tela de listagem, ao lado de "+ NOVO CURRÍCULO" e "LINK PARA NOVO CURRÍCULO", entra o botão **📄 IMPORTAR CURRÍCULO**.

A janela mostra a área "Arraste o arquivo para cá — PDF, DOC ou DOCX" com o botão SELECIONAR ARQUIVO. Limite de 10 MB, validação de extensão e tipo do arquivo.

Durante o processamento aparece o passo a passo: enviando arquivo, lendo documento, extraindo informações, identificando dados pessoais, escolaridade, cursos, experiências, habilidades e preenchendo o currículo.

Ao final: "✓ N informações identificadas / ⚠ N precisam ser verificadas" e o botão **CONTINUAR PARA REVISÃO**.

## Leitura do arquivo

- **PDF com texto**: o texto é lido diretamente do arquivo.
- **PDF digitalizado (imagem)**: o sistema detecta a ausência de texto e mostra "Não foi possível ler o conteúdo deste arquivo. Tente enviar um PDF com melhor qualidade ou um arquivo Word."
- **DOCX**: leitura do conteúdo preservando títulos, parágrafos, listas e tabelas (as células viram texto em sequência).
- **DOC (formato antigo)**: é feita uma tentativa de leitura; quando o conteúdo não vier legível, aparece a orientação para salvar como DOCX ou PDF. Isso é uma limitação do formato binário antigo do Word.

O arquivo **não é armazenado**: a leitura acontece no navegador do usuário autenticado e apenas o texto é enviado para interpretação. Não existe link público nem download do arquivo enviado.

## Interpretação das informações

O texto é interpretado por IA (já usada no sistema) com regras rígidas:

- Nunca inventar. Campo sem informação no documento fica vazio.
- Reconhecer variações de escrita: "Celular/Contato/WhatsApp" → telefone; "Formação/Educação" → escolaridade; "Experiência/Histórico profissional" → experiências.
- Funcionar com currículos com ou sem títulos, com tabelas, duas colunas ou ordem diferente.

Campos preenchidos: nome, CPF, telefone principal, telefones adicionais, nascimento, estado civil, e-mail, endereço; documentação completa (Sim/Não); habilitação e categoria (A/B/AB/C/D/E); escolaridade mapeada para a lista do sistema + curso quando for superior; cursos complementares (curso e instituição, instituição vazia quando não informada); todas as experiências (empresa, cargo/função, período, atividades); objetivo; habilidades.

Habilidades são comparadas com o catálogo do sistema — as correspondentes ficam marcadas e as novas entram como habilidade personalizada, editável ou removível.

Cada informação recebe internamente uma confiança (alta/média/baixa).

## Revisão antes de salvar

Abre o formulário de currículo existente, sem nenhuma tela nova de preenchimento, com o aviso "CURRÍCULO IMPORTADO — As informações abaixo foram identificadas no arquivo. Revise antes de salvar."

- Campos preenchidos pela importação recebem a marca "✓ Importado".
- Campos com confiança baixa recebem "⚠ Verifique esta informação".
- Campos esperados e não encontrados recebem "⚠ Não encontrada no currículo importado".
- Tudo continua editável, e o currículo só é gravado ao concluir o formulário normalmente.

## CPF e cadastro existente

O CPF continua sendo o identificador do currículo e nunca aparece no currículo, na impressão nem no PDF.

- **Sem CPF no arquivo**: a janela pede o CPF antes de continuar (com validação).
- **CPF novo**: cria cliente (quando o telefone ainda não existir) e o currículo em rascunho com nome, CPF e telefone, e segue para a revisão.
- **CPF já cadastrado**: mostra "Já existe um cadastro para este CPF" com o nome encontrado e as opções **ATUALIZAR CADASTRO** e **CRIAR NOVO CURRÍCULO**. Como o CPF é único por currículo, "criar novo" fica desabilitado com a explicação de que aquele CPF já possui currículo — a opção disponível é atualizar.
- **Atualizar**: antes de aplicar, exibe a lista "ALTERAÇÕES ENCONTRADAS" com valor atual x valor importado de cada campo divergente, e os botões CANCELAR / APLICAR ALTERAÇÕES. Listas (cursos, experiências, habilidades) são mostradas como acréscimo ou substituição, e o usuário escolhe.

## Erros

Formato não suportado, arquivo corrompido, documento sem texto e falha no reconhecimento têm mensagens próprias, sempre com a opção de voltar e tentar outro arquivo.

## Detalhes técnicos

- Novo serviço `src/lib/curriculo-import.ts` (extração no navegador: PDF via `pdfjs-dist`, DOCX via `fflate` + leitura de `word/document.xml`, tentativa de texto para `.doc`) e `src/lib/curriculo-import.functions.ts` + `curriculo-import.server.ts` (server function autenticada que envia o texto ao gateway de IA e devolve JSON estruturado validado com Zod).
- Estrutura retornada é convertida para os tipos já existentes (`CurriculoCompleto`, `CamposCurriculo`, `CursoItem`, `ExperienciaItem`, `HabilidadeItem`) — sem novas tabelas nem estruturas duplicadas.
- `FormularioCurriculo` ganha props opcionais `importado` (mapa de campos com origem/confiança) e `avisoImportacao`, usadas só para exibir as marcas; nenhuma lógica de preenchimento entra no componente.
- Novo componente `src/components/curriculo/ImportarCurriculo.tsx` (diálogo, drag-and-drop, progresso, conflito de CPF, comparação de alterações), usado em `src/routes/curriculos.index.tsx`.
- Dependência nova: `pdfjs-dist` (worker carregado no cliente). Nenhuma alteração no bot, WhatsApp, orçamentos ou impressão.
- Após implementar: verificação de tipos e teste ponta a ponta com PDF de texto, PDF digitalizado, DOCX e CPF já existente.

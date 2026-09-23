# Importação de currículo: preencher por regras antes da IA

## Objetivo

A leitura do arquivo (PDF/Word) já acontece no navegador, sem IA. O que depende da IA hoje é transformar o texto lido nos campos do currículo. Esta mudança inverte a ordem: o sistema primeiro preenche sozinho o que consegue reconhecer no texto, e só depois chama a IA. Se a IA estiver ocupada, sem chave, sem crédito ou falhar, o preenchimento por regras continua valendo e a pessoa revisa o que faltou com o texto do arquivo na tela.

## Como fica o fluxo

```text
1. Selecionar arquivo        (navegador, sem IA)
2. Extrair o texto           (navegador, sem IA)
3. Preencher pelo padrão do documento   <-- novo, sem IA, sem custo
4. Completar com a IA        (só o que faltar / confirmar incertos)
5. Resumo: o que foi encontrado, o que falta, o que verificar
6. Continuar para revisão no formulário
```

- A IA continua sendo chamada em toda importação (não é pulada): ela entra depois das regras para completar campos vazios e reconhecer textos soltos.
- O resultado da IA é **mesclado** com o das regras: a IA manda quando preencheu algo, as regras seguram o que a IA deixou vazio. Nenhum valor se perde.

## O que o sistema reconhece sem IA

Campos com formato fixo (alta confiabilidade):

- CPF — 11 números com dígitos verificadores válidos, com ou sem máscara;
- telefones — `(00) 00000-0000`, `(00) 0000-0000` e variações sem parênteses, com o primeiro virando o telefone principal;
- e-mail;
- CEP;
- data de nascimento — `DD/MM/AAAA` perto de "nascimento", convertida para o formato do sistema;
- estado civil — solteiro, casado, divorciado, viúvo, união estável;
- escolaridade — "ensino fundamental/médio/superior" + "completo/incompleto/cursando", convertida para uma das opções da lista;
- categoria da CNH — "categoria A/B/C…" ou "CNH … B";
- documentação completa — quando o texto afirma isso.

Campos por rótulo (linha que começa com "Endereço:", "Rua:", "Bairro:", "Cidade:", "UF:", "Nº:", "Objetivo:" e variações):

- endereço, número, bairro, cidade, UF, objetivo.

Demais campos por posição no documento (médio, entram em "precisa verificar"):

- nome completo — primeira linha que parece nome de pessoa (duas ou mais palavras, sem números, sem rótulo);
- experiências, cursos e habilidades — blocos abaixo dos títulos "Experiência profissional / Histórico profissional", "Cursos" e "Habilidades / Competências".

## Quando a IA não estiver disponível

Sem chave configurada, sem crédito, limite atingido, serviço ocupado ou modelo recusado:

- a importação **não falha**: as informações encontradas pelas regras são preenchidas e o currículo segue para revisão normalmente;
- uma mensagem no alto do resumo diz o que houve, com o texto específico já usado hoje ("O serviço de IA está ocupado…", "Os créditos de IA acabaram…", "A chave da IA foi recusada…");
- abaixo do resumo aparece o bloco **"Texto lido do arquivo"**: o conteúdo extraído, com botão "COPIAR TEXTO", para conferir e copiar o que faltou enquanto o formulário está aberto ao lado.

## O que muda na tela

- Lista de etapas passa a mostrar o preenchimento por regras como etapa própria ("Preenchendo pelo padrão do documento…"), e a etapa da IA só aparece quando a IA foi usada.
- O resumo atual ("X informações identificadas", "Y precisam ser verificadas", "não encontrado no arquivo") continua igual; campos preenchidos por regra com pouca certeza entram em "precisam ser verificadas".
- Nenhum botão novo de decisão: "CONTINUAR PARA REVISÃO" segue levando ao formulário, onde tudo pode ser corrigido.

## Detalhes técnicos

- **Novo `src/lib/curriculo-regras.ts`** (seguro para navegador e servidor, sem chamadas de rede): `extrairPorRegras(texto: string): CurriculoImportado`, reutilizando `cpfValido`, `somenteNumeros`, `formatarTelefone`, `capitalizarTexto`, `ESCOLARIDADES`, `ESTADOS_CIVIS` e `CATEGORIAS_HABILITACAO` de `src/lib/curriculo.ts`. Devolve exatamente a mesma estrutura que a IA devolve hoje, então nada em baixo muda de contrato.
- **`src/lib/curriculo-import.server.ts`**: `interpretarTexto` vira `interpretarTexto(texto)` e faz: regras → IA → mesclagem. A IA só é chamada depois das regras; em falha devolve o resultado das regras com o código do erro (`IA_OCUPADA`, `IA_LIMITE`, `IA_CREDITOS`, `IA_CHAVE`, `IA_MODELO`) em vez de lançar. Mesclagem: campo a campo, valor da IA quando não vazio, senão o do regra; listas (telefones, cursos, formações, experiências, habilidades) unidas sem duplicidade; `confianca_baixa` somada das duas fontes.
- **`src/lib/curriculo-import.functions.ts`**: `interpretarCurriculoImportado` passa a devolver `{ dados, existente, iaUsada, erroIA }`. Continua com `requireSupabaseAuth` e o mesmo validador de entrada.
- **`src/components/curriculo/ImportarCurriculo.tsx`**: guarda o texto extraído em estado, mostra o banner de IA indisponível com a mensagem de `mensagemErroImportacao`, o bloco "Texto lido do arquivo" com cópia, e ajusta a lista de etapas. `criarCurriculoImportado` / `atualizarCurriculoImportado` permanecem intactos.
- **Sem banco de dados**: nenhuma tabela, coluna ou migração; nada em `supabase/migrations/`.

## Fora do escopo

- Sorteios, clientes, PIX, orçamento, bot do WhatsApp e transcrição de áudio não são tocados.
- A aba Configurações → IA e o armazenamento da chave continuam iguais.
- A extração de texto do PDF/Word não muda (continua no navegador, arquivo nunca é armazenado).

## Verificação

- Importar um currículo real com IA funcionando: conferir que os campos saem iguais ou melhores que hoje e que a IA não sobrescreve nada válido.
- Importar o mesmo arquivo com a IA indisponível (chave inválida na aba IA): conferir que as regras preenchem CPF, telefone, e-mail, endereço e que o bloco "Texto lido do arquivo" aparece com o texto correto e o botão de copiar funcionando.

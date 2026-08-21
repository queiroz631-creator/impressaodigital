# Ajustes no Currículo Vitae e na Calculadora

## 1. Link público

O endereço `http://localhost:8080/curriculo/publico/` sem token não existe — a rota é `/curriculo/publico/<token>`, gerada pelo botão "Gerar link". Ajustes:

- Mostrar uma página amigável ("Link inválido ou incompleto — solicite um novo ao atendimento") quando o token estiver ausente/expirado, em vez de erro.
- Revisar a base de URL usada na geração do link para que, em ambiente local/preview, o link copiado aponte para o mesmo domínio em que o sistema está aberto.

## 2. Novos campos (banco de dados)

- `curriculos`: `endereco` (rua/nº), `bairro`, `cidade`, `uf`, `cep`, `pos_graduacao_nome`.
- `curriculo_cursos`: `ano` (texto, opcional).
- Nova tabela `curriculo_formacoes` para permitir **mais de um curso superior** (nome do curso, instituição, ano, ordem), mantendo o campo antigo apenas como leitura de currículos já existentes.

## 3. Documento (PDF, impressão e visualização)

Nova ordem das seções:

```text
CURRÍCULO VITAE            <- faixa/cabeçalho destacado
Nome completo
Telefones
E-mail                     <- abaixo do telefone
DADOS PESSOAIS (nascimento, estado civil, endereço completo)
INFORMAÇÕES ADICIONAIS
FORMAÇÃO / CURSO SUPERIOR / PÓS
CURSOS COMPLEMENTARES (com ano)
EXPERIÊNCIA PROFISSIONAL
HABILIDADES
OBJETIVO                   <- por último
```

Outros ajustes visuais:

- Faixa azul cheia como divisor de cada seção (título em branco sobre a faixa), tanto no PDF quanto na impressão.
- Empresa em destaque; cargo/função em linha abaixo da empresa.
- Texto em cor mais escura (quase preto) para melhor leitura e impressão.
- Ajuste automático para caber em **uma única página A4**: o gerador mede o conteúdo e reduz proporcionalmente fonte/espaçamentos quando passar da página; quando o currículo tiver poucas informações, aumenta espaçamento entre seções para ocupar melhor a folha.
- Corrigir a página em branco na impressão (margens/altura do bloco de impressão).
- Corrigir a data de nascimento que aparece com um dia a menos (a data é tratada como data pura, sem fuso).

## 4. Formulário

- Normalizar automaticamente os textos digitados para "Inicial Maiúscula" (nome, empresa, cargo, cursos, cidade, etc.), preservando siglas e não alterando e-mail.
- Endereço adicionado na etapa de dados pessoais.
- Escolaridade: permitir vários cursos superiores (adicionar/remover) e, quando pós-graduação, informar o nome da pós.
- Cursos: novo campo "Ano" (opcional).
- Card de experiência ganha destaque visual quando a empresa está preenchida.
- Na etapa de **Revisão**, cada seção terá um botão "Editar" que abre apenas aquela etapa e retorna direto para a revisão ao salvar.

## 5. Calculadora

- Persistir a **Observação** junto com o rascunho e o pedido (hoje ela se perde ao recarregar/retomar).
- Antes de gerar o orçamento, exigir resposta explícita **Sim/Não** para "Incluir PIX?" e "Precisa de prazo?" — sem resposta, o botão de gerar fica bloqueado com aviso.

## Notas técnicas

- Migração adiciona as colunas acima e a tabela `curriculo_formacoes` com RLS/GRANTs no mesmo padrão das demais tabelas do módulo.
- `src/lib/curriculo-pdf.ts`: refatorar para renderização em duas passagens (medir → escalar) com faixas via `doc.rect`, e formatação de data local sem conversão de fuso.
- `src/components/curriculo/CurriculoDocumento.tsx`: mesma ordem/estilo do PDF e CSS de impressão A4 sem página extra.
- `src/components/curriculo/FormularioCurriculo.tsx`: normalização de texto, novos campos e navegação "editar seção" na revisão.
- `src/routes/index.tsx`: incluir observação no rascunho/pedido e validação obrigatória de PIX/prazo.

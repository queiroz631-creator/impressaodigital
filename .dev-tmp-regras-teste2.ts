import { extrairPorRegras } from "@/lib/curriculo-regras";

// Documento sem rótulos, com coluna dupla e datas soltas (pior caso).
const texto = `ANA PAULA COSTA MENEZES
Brasileira, casada, 2 filhos
Data de nascimento: 03/09/1985
Documento: 345.678.912-00    Orgao emissor: SSP/SP
Rua Coronel Oliveira, 880 - Sala 3
Vila Nova - Belo Horizonte - MG    CEP 30130-010
ana.menezes@hotmail.com
(31) 98877-1122   fixo 31 3221-8890
2º grau completo
Curso técnico em contabilidade - Coltec - 2007
Pós-graduação em Perícia Contábil
Possui documentação completa
Habilitação: sim, categoria AB
Objetivo: vaga na área contábil

HISTÓRICO PROFISSIONAL
Escritório Contábil Andrade
Assistente contábil
janeiro de 2015 a março de 2019
Classificação de notas fiscais e apoio no fechamento.
Conferência de balanços mensais.
Comercial Mendes LTDA
Vendedora
2011 - 2014
Atendimento e controle de estoque.

COMPETÊNCIAS
Excel avançado, ERP Senior, conciliação bancária`;

console.log(JSON.stringify(extrairPorRegras(texto), null, 1));

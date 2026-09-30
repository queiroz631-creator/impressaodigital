# Corrigir o envio de clientes sem perder o horário de Brasília

## Diagnóstico confirmado

O erro da imagem ocorre no envio de clientes da loja para o sistema:

- Depois do ajuste de fuso, uma data de nascimento lida como data e hora passou a ser enviada como `1988-01-22T00:00:00-02:00` ou `...-03:00` (25 caracteres).
- A entrada de clientes aceita `dataNascimento` com no máximo 20 caracteres.
- Por isso o sistema rejeita o lote inteiro com `HTTP 400: Dados inválidos`.
- O arquivo enviado confirma que a versão anterior mandava a data sem acrescentar fuso; o problema apareceu porque nascimento e horário de nota compartilham hoje a mesma conversão.

## Correção — somente `api-local/`

1. Criar uma conversão específica para data de nascimento em `app/utils/normalizacao.py`:
   - `datetime` ou `date` vira sempre `AAAA-MM-DD`;
   - não acrescenta hora nem fuso, pois nascimento é uma data civil, não um horário.
2. Em `app/services/clientes.py`, usar essa conversão apenas em `dataNascimento`.
3. Manter sem alteração o tratamento de Brasília já aplicado:
   - emissão e cancelamento das notas continuam com `-03:00`;
   - início e fim do sorteio continuam convertidos para Brasília;
   - “Último ciclo” e “Último sucesso” continuam exibidos no horário de Brasília.
4. Validar localmente com datas recebidas como `date`, `datetime` sem fuso e `datetime` com fuso, confirmando que nascimento tem 10 caracteres e que horários de notas continuam com o fuso.

## O que não muda

- Nenhum arquivo do site, banco, migração ou rota online será alterado.
- Regras de clientes, CPF, telefone, nomes, notas, lotes e marcadores permanecem iguais.
- Nenhum dado real será enviado e nenhum teste será executado no banco da loja ou de produção.
- O executável não será gerado aqui; depois da correção será necessário gerar um novo com `GERAR_EXE.bat` e instalá-lo na loja.

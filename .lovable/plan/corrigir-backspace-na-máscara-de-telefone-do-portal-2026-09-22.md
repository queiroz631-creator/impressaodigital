# Corrigir backspace na máscara de telefone do portal

## Problema

No campo **Telefone (WhatsApp)** do portal público, ao apertar Backspace com o cursor logo após um separador da máscara (o espaço depois de `)`, o `-`), o apagar "não anda": a máscara recria o separador na hora e o dígito nunca é removido. Na prática, a pessoa não consegue apagar o DDD.

Causa confirmada no código: `CampoTelefone` (`src/modules/sorteios/components/publico/CamposPublico.tsx`) aplica `telefoneBR()` (`src/lib/format.ts`) sobre o valor a cada tecla; quando o Backspace remove só um caractere de formatação, a contagem de dígitos não muda e a máscara devolve o separador imediatamente.

## Correção

Em `CamposPublico.tsx`, no `onChange` do `CampoTelefone`:

- Detectar quando a tecla foi uma **remoção** (valor novo mais curto) mas a **quantidade de dígitos ficou igual** — ou seja, o usuário apagou apenas um separador.
- Nesse caso, remover também o **dígito imediatamente antes do cursor** (calculado com `selectionStart` sobre os dígitos puros) e devolver o valor remascarado.
- Fora desse caso, comportamento atual mantido (`telefoneBR` do valor digitado).

Aplicar o mesmo tratamento no `CampoCpf` (mesmo arquivo, mesma classe de problema com `.` e `-` de `formatarCpf`), sem alterar `telefoneBR` nem `formatarCpf` — a correção fica no componente de campo.

## Onde vale

Telas do portal que usam esses campos: entrada com CPF (`sorteios-publico.index.tsx`) e telefone (`sorteios-publico.telefone.tsx`).

## Fora de escopo

- Não alterar regras de validação (telefone com DDD, CPF válido), máscaras em si, nem nada do sorteio/Lojamix.

## Validação

- Digitar telefone completo e apagar até o fim com Backspace, inclusive cruzando `-`, espaço e `)`: o DDD deve sumir dígito a dígito até o campo ficar vazio.
- Mesmo teste no CPF.
- Teste rápido no navegador (Playwright) na tela de telefone do portal.
- Sem commit, push, deploy ou publicação.

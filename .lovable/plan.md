# Aplicar o mesmo espaçamento "antes da seção" também depois do texto

## Contexto

Hoje cada seção tem espaçamento **antes** (topo) mas não tem espaçamento
explícito **depois** do texto — a folga entre seções vem só do `mt-4` da próxima
seção. O usuário quer o mesmo espaçamento que existe antes de cada seção
aplicado também depois do texto digitado de cada seção.

## Mudanças

1. **`src/components/curriculo/CurriculoDocumento.tsx`** (tela/impressão A4)
   - No componente `Secao`, trocar `<section className="mt-4">` por
     `<section className="mt-4 mb-4">`.
   - Assim cada seção ganha 16px (`mb-4`) depois do texto, igual aos 16px
     (`mt-4`) antes. Entre seções as margens colapsam (continua 16px); a última
     seção passa a ter 16px antes do rodapé "Atualizado em".

2. **`src/lib/curriculo-pdf.ts`** (PDF)
   - Hoje após o conteúdo de cada seção: `y += 4 * escala + espacamentoExtra / 2`
     (igual à folga antes da próxima seção — já simétrico).
   - Para refletir o aumento visual da tela e dar respiro após o texto, dobrar
     esse avanço para `8 * escala + espacamentoExtra / 2` em todos os blocos
     (Dados pessoais, Informações adicionais, Formação, Cursos, Experiência,
     Habilidades, Objetivo).
   - O cálculo de escala (duas passagens) continua válido: o conteúdo total
     cresce um pouco e a escala se reajusta automaticamente se necessário.

## Não incluir

- Sem mudança no banco nem no formulário.
- Sem alterar a ordem das seções.

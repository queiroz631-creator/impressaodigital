# Currículo: rótulo "Cargo/Função"

Na experiência profissional, o cargo passa a ser exibido com o rótulo na frente:

```text
Empresa Exemplo Ltda
Cargo/Função: Auxiliar Administrativo
Período: 2020 - 2023
```

Aplicado nos dois lugares para manter paridade:

- PDF gerado (`src/lib/curriculo-pdf.ts`, linha do `exp.cargo`)
- Visualização/impressão (`src/components/curriculo/CurriculoDocumento.tsx`)

Quando não houver cargo informado, a linha continua não sendo exibida. Nenhuma outra parte do documento muda.

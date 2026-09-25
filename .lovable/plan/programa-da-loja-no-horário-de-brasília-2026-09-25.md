# Programa da loja no horário de Brasília

## O que foi encontrado

1. **Tela do programa (Último ciclo / Último sucesso):** o horário é gravado em UTC (`+00:00`). Por isso aparece 02:31 quando em Brasília eram 23:31.
2. **Data das notas enviadas ao sistema:** o Lojamix guarda a emissão no horário local, mas o programa envia sem indicar o fuso. O sistema pode ler como UTC, deixando a nota 3 horas "adiantada" — uma nota de 22h pode cair no dia seguinte.
3. **Período do sorteio:** quando o sistema manda início/fim com fuso (ex.: `...Z`), o programa só descarta o fuso sem converter, e o corte do período fica deslocado em 3 horas.

## O que muda

- Todo horário mostrado na tela e nos registros passa a ser de Brasília (`-03:00`), no formato `25/09/2026 23:31:33`.
- A data de emissão das notas passa a ser enviada com o fuso de Brasília, sem deslocar o dia.
- O início e o fim do sorteio recebidos do sistema são convertidos para Brasília antes de comparar com as notas do Lojamix.

## O que não muda

Alterações somente no programa da loja (pasta `api-local/`). Site, banco, migrações e rotas do sistema não são tocados. Regras de notas, clientes, cupons, marcadores e lotes continuam iguais. Os identificadores de lote continuam iguais (só servem para evitar duplicidade).

## Detalhes técnicos

- Novo `FUSO = ZoneInfo("America/Sao_Paulo")` em `app/utils/normalizacao.py` (com `tzdata` no `requirements.txt`, necessário no Windows), fallback para `timezone(timedelta(hours=-3))`.
- `app/runtime.py`: `now()` → `datetime.now(FUSO).isoformat()`.
- `data_iso()`: datetime sem fuso recebe `tzinfo=FUSO`; com fuso é convertido com `astimezone(FUSO)`.
- `services/notas.py::_limite_data`: se tiver fuso, `astimezone(FUSO).replace(tzinfo=None)` em vez de apenas remover o fuso.
- `gui/main.py`: exibir `last_cycle`/`last_success` formatados em `dd/mm/aaaa HH:MM:SS`.
- Ao aplicar, gerar o EXE novo com `GERAR_EXE.bat` e reinstalar na loja.

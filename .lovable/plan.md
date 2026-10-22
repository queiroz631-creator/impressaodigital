# Marketing → Nº da Sorte

Nova área dentro de Marketing, sem alterar Sorteios, FOTO EXPRESS ou o restante do sistema. Entrega em 4 etapas; cada uma termina testada antes da próxima.

## Arquitetura identificada (reaproveitada)

- Menu e permissões: catálogo central de módulos (já tem o grupo Marketing com Sorteios) + verificação de permissões por perfil. Nº da Sorte entra como novo item desse grupo.
- Clientes: cadastro mestre `clientes` (nomes em CAIXA ALTA sem acentos, CPF validado no banco), o mesmo usado por Sorteios e FOTO EXPRESS.
- Portal público: o portal de Sorteios já usa sessão em cookie protegido, controle de tentativas e funções de banco seguras — o Nº da Sorte seguirá o mesmo modelo, com tabelas próprias.
- Gráficos já disponíveis (recharts). Faltam leitor de QR pela câmera e gerador de QR Code — serão adicionados.
- Mudanças de banco gravadas também na pasta oficial de migrações da VPS.

## Etapa 1 — Campanhas e prêmios (painel)

- Página Marketing → Nº da Sorte com abas: Dashboard, Campanhas, Prêmios, Participações, Retirada, Estatísticas, Configurações.
- Campanhas: criar, editar, ativar, suspender, encerrar; número sequencial dado pelo banco e nunca reaproveitado; banner, regulamento, limites por cliente, link público e QR Code da página.
- Prêmios: várias por campanha; ao informar a quantidade, o servidor gera um número da sorte exclusivo por unidade (campanha + 5 dígitos aleatórios, ex.: campanha 12 → 1258394), com controle de capacidade (100.000 por campanha).
- Lista dos números gerados visível só para quem tiver permissão.

## Etapa 2 — Página pública

- Endereço `/numero-da-sorte/<campanha>`: banner, descrição, período, regulamento.
- Cadastro com nome, telefone e CPF, reaproveitando o cliente existente sem mostrar dados de outra pessoa; aceite do regulamento separado do aceite de marketing.
- Consulta do número: "Que pena!" ou "Parabéns" com prêmio, condições, prazo e local; o prêmio fica reservado definitivamente para aquele cliente.
- Proteção contra tentativas em massa: limite por aparelho/IP, por cliente e por campanha, bloqueio temporário e registro de atividade suspeita.

## Etapa 3 — Comprovante e retirada

- Comprovante com QR Code e código curto próprios (não é o número da sorte, sem CPF/telefone), baixar como imagem, compartilhar e copiar código; recuperação pelo próprio cliente.
- Tela de retirada: ler QR pela câmera ou digitar o código; mostra dados e situação; botão "Confirmar entrega do prêmio" com confirmação, registrando quem entregou e quando, impedindo entrega dupla.
- Prêmios vencidos marcados automaticamente; exceção só por usuário autorizado, com justificativa.

## Etapa 4 — Dashboard, estatísticas e relatórios

- Indicadores gerais e por campanha (clientes x números consultados separados), gráficos por dia/horário/situação, filtros por campanha, período e situação.
- Relatórios de participantes, premiados, pendentes, entregues, vencidos e validações, com exportação CSV (CPF mascarado).
- Testes automáticos dos cenários do documento (6/7/8 dígitos, sufixo 00001, sem duplicidade, reaproveitamento de cliente, entrega dupla bloqueada etc.).

## Detalhes técnicos

- Tabelas `numero_sorte_*`: campanhas (sequence própria), premios, numeros (único por campanha + código texto), participacoes, premiacoes, comprovantes (só hash SHA-256 dos tokens), retiradas, tentativas, sessoes, auditoria. RLS + GRANT; leitura dos números só via permissão.
- Funções SECURITY DEFINER para gerar números (`gen_random_bytes`, retentativa em colisão, `FOR UPDATE`), consultar/reservar, confirmar entrega e vencer prêmios.
- Server functions `src/lib/numero-sorte.functions.ts` (painel, com `requireSupabaseAuth` + `tem_permissao`) e `numero-sorte-publico.functions.ts` (cookie HttpOnly próprio). Módulo em `src/modules/numero-sorte/` com rotas finas em `src/routes`.
- Permissões: `numero_sorte.visualizar`, `.campanhas.gerenciar`, `.premios.gerenciar`, `.participantes.visualizar`, `.retiradas.validar`, `.relatorios.visualizar`.
- Novas bibliotecas: `qrcode` (gerar) e um leitor de QR pela câmera.
- Imagens de banner/prêmio em bucket próprio, servidas por URL temporária.

## Pontos a confirmar

- Na consulta pública, o prêmio fica reservado direto ao cliente (sem etapa extra de confirmação por SMS/WhatsApp) — assumido nesta proposta.
- Começo pela Etapa 1 e sigo etapa por etapa após sua aprovação.

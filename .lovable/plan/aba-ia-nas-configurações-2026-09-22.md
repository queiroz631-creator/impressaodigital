# Aba "IA" nas Configurações

Nova aba dentro de Configurações onde você escolhe qual IA o sistema usa, sem precisar mexer em arquivos ou no servidor.

## O que a aba mostra

1. **Provedor da IA** (uma escolha):
   - OpenAI pela Lovable (recomendado, já incluso, sem chave)
   - Google Gemini pela Lovable (como funciona hoje)
   - OpenAI com a minha chave
   - Google Gemini com a minha chave
2. **Modelo** — campo de texto com o modelo sugerido já preenchido para o provedor escolhido (pode trocar).
3. **Minha chave** — aparece só quando você escolhe "com a minha chave". A chave é guardada em cofre de segredos do sistema, nunca no banco comum e nunca enviada de volta para a tela; a tela mostra apenas "chave configurada" ou "não configurada", com opção de substituir ou remover.
4. **Testar agora** — botão que faz uma chamada curta de verdade e responde "funcionando" ou explica o erro em português (chave inválida, sem crédito, modelo indisponível, limite de uso).
5. Aviso de que a escolha vale para todos os recursos com IA: leitura de currículos, respostas do bot do WhatsApp e transcrição de áudio.

## Onde fica

- Aba "IA" ao lado de Empresa, PIX e prazo, Impressão e Link do orçamento.
- Mesma permissão da tela de Configurações (`configuracoes.visualizar` para ver; salvar exige a permissão de edição já usada na tela).

## Como a escolha passa a valer

A camada de IA do sistema passa a ler a configuração salva antes de decidir o provedor. Ordem de decisão:

1. Configuração salva na aba IA (provedor + modelo + chave própria, se houver).
2. Se nada estiver configurado, mantém o comportamento atual (chave do servidor se existir, senão a IA da Lovable).

Transcrição de áudio: quando o provedor escolhido não fizer áudio com o modelo informado, o sistema usa automaticamente um modelo de áudio compatível do mesmo provedor e registra isso no resultado do teste.

## Detalhes técnicos

- Novas colunas em `configuracoes`: `ia_provedor` (texto, padrão `lovable_openai`), `ia_modelo` (texto, nulo = padrão do provedor), `ia_modelo_audio` (texto, nulo = padrão), `ia_chave_propria` (booleano, só indica que existe segredo). Migração em `drizzle/migrations/` seguindo o padrão do projeto, com GRANT e RLS iguais às demais colunas da tabela (a tabela já existe, apenas `ALTER TABLE`).
- Chave própria guardada como segredo do projeto (`OPENAI_API_KEY` / `GEMINI_API_KEY`), gravada por server function com permissão verificada no servidor; nunca retornada ao cliente.
- `src/lib/ia-chave.server.ts`: refatorar para resolver provedor/modelo a partir da configuração (leitura no servidor, com cache curto), mantendo as assinaturas `gerarTextoIA` e `transcreverAudioIA` intactas para não afetar currículos, bot e WhatsApp.
- Rota OpenAI: modelo padrão `openai/gpt-6-astra` via gateway Lovable (Responses API, em streaming consumido no servidor) e `openai/gpt-image`-família não entra aqui. Com chave própria, chamada direta à API da OpenAI.
- Novas server functions em `src/lib/ia-config.functions.ts`: `salvarConfiguracaoIA`, `salvarChaveIA`, `removerChaveIA`, `testarIA` — todas validando permissão no servidor.
- Nada de sorteios, notas, cupons, saldo, apuração ou sincronização Lojamix é tocado.

# Currículos no atendimento do WhatsApp

## O que será adicionado
- Botão **Currículo** junto das ações do cliente selecionado, abrindo um modal sem sair da conversa.
- O modal mostra o nome e telefone do destinatário e consulta os currículos associados a ele.
- **Enviar link de novo currículo:** reutiliza a geração e a mensagem configurada no módulo Currículos, permitindo revisar o texto antes de enviar.
- Quando houver currículo: **Enviar link para edição** ou **Enviar PDF**, usando o currículo desse cliente.
- Se houver mais de um currículo associado, permitir escolher explicitamente qual enviar, mostrando nome, status e data de atualização.
- Mostrar carregamento, envio em andamento, confirmação de sucesso e erros; impedir cliques duplicados durante o envio.

## Reaproveitamento e segurança
- Reutilizar as funções existentes de geração dos links e sua validade, normalização de URLs, montagem da mensagem e geração do PDF. Não criar outro modelo de currículo.
- Enviar pela conversa e conexão do WhatsApp selecionadas, registrando a mensagem ou o PDF no histórico do atendimento.
- Buscar primeiro pelo cadastro vinculado à conversa; na ausência desse vínculo, conferir o telefone normalizado. Nunca escolher currículo apenas pela semelhança do nome. Se houver associação ambígua, não disponibilizar edição/PDF até identificar corretamente o cliente.
- Respeitar as permissões existentes do WhatsApp e dos Currículos; validar o acesso também no servidor.
- Não alterar validação de CPF, cadastro público, conteúdo dos currículos ou comportamento das telas atuais.

## Detalhes técnicos
- Criar um modal dedicado às ações de currículo no WhatsApp.
- Compartilhar a consulta dos dados completos do currículo com a tela de Currículos para evitar duas versões da montagem do PDF.
- Reutilizar `gerarLinkNovoCurriculo`, `gerarLinkCurriculo`, `mensagemLinkCurriculo`, `urlPublica`, `curriculoPdfBase64` e `nomeArquivoCurriculo`.
- Usar o envio de texto e arquivos do atendimento para manter o destinatário, a conexão e o histórico da conversa, sem modificar o envio já disponível na tela de Currículos.
- Carregar o gerador do PDF somente ao solicitar o documento. Nenhuma nova dependência prevista.

## Validação
- Testar sem currículo, com um currículo, com múltiplos currículos, associação ambígua, ausência de permissão e falha de envio.
- Conferir geração dos links, conteúdo do PDF e envio à conversa correta com dados fictícios e respostas simuladas, sem mensagens reais.
- Conferir modal no computador e celular e a ausência de regressões nas ações existentes de Currículos.
- Não publicar nem executar testes ou limpeza no banco de produção.
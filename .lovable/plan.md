# Bot não responde na VPS

## O que foi confirmado

As mensagens chegam e são registradas — o problema é só a resposta automática. O motivo está no banco:
o gatilho que acorda a fila do bot e os dois agendamentos (inatividade e status do WhatsApp) têm o
endereço do Lovable **fixo no próprio banco**:

```text
https://project--794a07c8-...lovable.app/api/public/whatsapp/fila
https://project--794a07c8-...lovable.app/api/public/whatsapp/inatividade
https://project--794a07c8-...lovable.app/api/public/whatsapp/status
```

Como o banco foi copiado para a VPS com esses endereços, cada mensagem nova é marcada como pendente e
o aviso é enviado para o sistema antigo (Lovable), não para o da VPS. Ninguém processa a fila lá, então
o bot fica calado — enquanto currículo e transcrição de áudio, que rodam dentro da própria requisição,
funcionam normalmente.

## Correção

1. **Guardar o endereço do sistema no banco**
   - Novo campo em Configurações do WhatsApp: "Endereço do sistema" (ex.: `https://seudominio.com`).
   - O gatilho da fila passa a montar a URL a partir desse campo, em vez do endereço fixo. Sem valor
     preenchido, mantém o endereço atual como padrão — no Lovable nada muda.

2. **Refazer os dois agendamentos do mesmo jeito**
   - Inatividade (cada minuto) e status do WhatsApp (cada 5 minutos) passam a ler o mesmo campo, então
     um único preenchimento resolve as três rotinas.

3. **Preencher e checar pela tela**
   - Em Configurações, ao lado do botão de reconfigurar webhook, o endereço do sistema fica editável e
     mostra se está diferente do endereço em que a página está aberta, com um botão para corrigir com
     um clique.

4. **Instruções de instalação**
   - `deploy/README.md`: em vez de "recrie os agendamentos manualmente", basta preencher o endereço do
     sistema na tela de Configurações depois de restaurar o banco.

5. **Validação**
   - Na VPS: mandar uma mensagem de teste e confirmar que a resposta do bot sai.
   - No Lovable: confirmar que o bot continua respondendo como hoje (sem regressão).

## Detalhes técnicos

- Migração: `whatsapp_config.app_url text not null default ''`; `disparar_fila_bot()` recriada usando
  `coalesce(nullif(app_url,''), 'https://impressaodigital.lovable.app')`; `cron.unschedule` +
  `cron.schedule` de `whatsapp-inatividade` e `publicar-status-whatsapp` chamando uma função
  `disparar_rotina_bot(rota text)` que resolve URL + token pelo config.
- `src/routes/configuracoes.tsx`: campo de endereço do sistema (leitura/gravação em `whatsapp_config`),
  aviso de divergência e botão "Usar este endereço"; nada mais muda no layout.
- `deploy/README.md`: passo 4 simplificado.
- Sem alteração em calculadora, pedidos, currículos, fluxos ou respostas do bot.

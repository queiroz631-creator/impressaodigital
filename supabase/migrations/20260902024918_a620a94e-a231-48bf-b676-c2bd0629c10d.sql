ALTER TABLE public.whatsapp_config
ADD COLUMN IF NOT EXISTS ignorar_agradecimentos jsonb NOT NULL DEFAULT jsonb_build_object(
  'ativo', true,
  'janela_minutos', 30,
  'frases', jsonb_build_array(
    'obrigado','obrigada','obg','muito obrigado','muito obrigada','valeu','vlw','ok','okay','ta bom','tá bom','blz','beleza','agradeço','grato','grata','show','perfeito','otimo','ótimo','maravilha','combinado','certo','deus abençoe','amém','👍','🙏'
  )
);
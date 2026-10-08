import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const obterCertificadoQz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const certificado = process.env.QZ_CERTIFICATE_BASE64;
    const chave = process.env.QZ_PRIVATE_KEY_BASE64;
    if (!certificado && !chave) return { certificado: null };
    if (!certificado || !chave) throw new Error("Configuração do certificado QZ incompleta na VPS.");
    return { certificado: atob(certificado) };
  });

export const assinarPedidoQz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ mensagem: z.string().min(1).max(12_000_000) }))
  .handler(async ({ data, context }) => {
    const { validarPedidoQz, assinarMensagemQz } = await import("./qz-assinatura.server");
    validarPedidoQz(data.mensagem);
    const permissoes = ["whatsapp.visualizar", "orcamentos.visualizar", "curriculos.visualizar", "sorteios.gerenciar", "foto_express.trabalhos.editar"];
    const autorizacoes = await Promise.all(permissoes.map((_chave) => context.supabase.rpc("tem_permissao", { _user_id: context.userId, _chave })));
    if (!autorizacoes.some((r) => !r.error && r.data === true)) throw new Error("Você não tem permissão para imprimir.");
    const chave = process.env.QZ_PRIVATE_KEY_BASE64;
    if (!chave || !process.env.QZ_CERTIFICATE_BASE64) throw new Error("Certificado QZ não configurado na VPS.");
    try { return { assinatura: await assinarMensagemQz(data.mensagem, chave) }; }
    catch { throw new Error("Não foi possível assinar a impressão. Confira o certificado na VPS."); }
  });

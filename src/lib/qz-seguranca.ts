import { obterCertificadoQz, assinarPedidoQz } from "./qz-assinatura.functions";

/** Configured before connecting; preserve QZ's JSON so the server validates the operation. */
export async function configurarSegurancaQz(api: any): Promise<void> {
  const { certificado } = await obterCertificadoQz();
  if (!certificado) return; // Unconfigured installations retain existing prompts.
  const mensagens = new Map<string, string>();
  api.api.setSha256Type(async (mensagem: string) => {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(mensagem));
    const hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
    if (mensagem.startsWith('{"call":')) {
      if (mensagens.size >= 100) mensagens.clear();
      mensagens.set(hash, mensagem);
    }
    return hash;
  });
  api.security.setCertificatePromise((resolve: (value: string) => void) => resolve(certificado), { rejectOnFailure: true });
  api.security.setSignatureAlgorithm("SHA512");
  api.security.setSignaturePromise((hash: string) => async (resolve: (value: string) => void, reject: (error: unknown) => void) => {
    const mensagem = mensagens.get(hash);
    mensagens.delete(hash);
    if (!mensagem) { reject(new Error("Pedido QZ não identificado.")); return; }
    try { const resultado = await assinarPedidoQz({ data: { mensagem } }); resolve(resultado.assinatura); }
    catch (error) { reject(error); }
  });
}

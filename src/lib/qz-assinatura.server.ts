/** Only fresh printer operations may be signed; never QZ filesystem/network APIs. */
export function validarPedidoQz(mensagem: string, agora = Date.now()) {
  if (mensagem.length > 12_000_000) throw new Error("Pedido de impressão muito grande.");
  let pedido: unknown;
  try { pedido = JSON.parse(mensagem); } catch { throw new Error("Pedido QZ inválido."); }
  if (!pedido || typeof pedido !== "object" || Array.isArray(pedido)) throw new Error("Pedido QZ inválido.");
  const p = pedido as Record<string, unknown>;
  if (Object.keys(p).some((k) => !["call", "params", "timestamp"].includes(k))) throw new Error("Pedido QZ inválido.");
  if (!["printers.find", "printers.getDefault", "print"].includes(String(p['call']))) throw new Error("Operação QZ não autorizada.");
  if (typeof p['timestamp'] !== "number" || !Number.isFinite(p['timestamp']) || Math.abs(agora - p['timestamp']) > 120_000) throw new Error("Pedido QZ expirado. Confira o relógio do computador.");
  if (p['call'] === "print") {
    const params = p['params'] as { printer?: unknown; data?: unknown } | undefined;
    if (!params || typeof params !== "object" || !Array.isArray(params.data) || params.data.length === 0) throw new Error("Impressão QZ inválida.");
    const printer = params.printer;
    if (typeof printer !== "object" || printer === null || !("name" in printer) || typeof printer.name !== "string" || !printer.name.trim() || "file" in printer || "host" in printer) throw new Error("Use uma impressora instalada no computador.");
    for (const item of params.data) {
      if (!item || typeof item !== "object" || typeof item.data !== "string") throw new Error("Somente dados locais de impressão são permitidos.");
      const pixel = item.type === "pixel" && ((item.format === "html" && item.flavor === "plain") || (item.format === "pdf" && item.flavor === "base64"));
      const raw = item.type === "raw" && ["plain", "hex", "command"].includes(item.format) && (item.flavor === undefined || ["plain", "hex", "base64"].includes(item.flavor));
      if (!pixel && !raw) throw new Error("Somente dados locais de impressão são permitidos.");
    }
  }
  return p;
}

export async function assinarMensagemQz(mensagem: string, chaveBase64: string) {
  const pem = atob(chaveBase64);
  const corpo = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const bytes = Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", bytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" }, false, ["sign"]);
  // QZ signs the ASCII SHA-256 digest with RSA/SHA-512, not the raw JSON.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(mensagem));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(hex));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

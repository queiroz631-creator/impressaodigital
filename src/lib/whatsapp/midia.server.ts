/**
 * Obtenção dos bytes de uma mídia recebida. Somente servidor.
 *
 * - URL comum (Z-API): `fetch` direto, exatamente como antes.
 * - Referência interna `provedor-midia://<conexao>/<id>` (Evolution): o arquivo é
 *   baixado pela própria conexão, via adaptador do provedor.
 */

import { baixarMidiaPelaConexao } from "./provedor.server";
import { lerUrlMidiaProvedor } from "./providers/evolution-ids";

export type MidiaObtida =
  | { ok: true; bytes: Uint8Array; mime: string | null }
  | { ok: false; erro: string };

export async function obterBytesDaMidia(url: string): Promise<MidiaObtida> {
  const ref = lerUrlMidiaProvedor(url);
  if (ref) {
    const r = await baixarMidiaPelaConexao(ref.conexaoId, ref.idMensagem);
    if (!r.ok) return { ok: false, erro: r.erro.mensagem };
    return { ok: true, bytes: r.dados.bytes, mime: r.dados.mime };
  }

  const resposta = await fetch(url);
  if (!resposta.ok) return { ok: false, erro: `HTTP ${resposta.status}` };
  return {
    ok: true,
    bytes: new Uint8Array(await resposta.arrayBuffer()),
    mime: resposta.headers.get("content-type"),
  };
}

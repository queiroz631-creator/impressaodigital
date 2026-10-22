/**
 * Fachada de envio por conexão. Somente servidor.
 *
 * É o ponto único que o restante do sistema (atendimento, bot, agente,
 * worker) deve usar para falar com o WhatsApp: resolve o provedor da conexão
 * e delega ao adaptador. Os chamadores não conhecem Z-API nem Evolution.
 */

import { obterProvedorDaConexao } from "./providers/registro.server";
import type {
  ApagarMensagem,
  EditarMensagem,
  EnvioMidia,
  EnvioTexto,
  MidiaBaixada,
  ProvedorWhatsApp,
  PublicarStatusEntrada,
  Resultado,
  ResultadoEnvio,
  StatusConexao,
} from "./providers/tipos";

async function com<T>(
  conexaoId: string | null,
  operacao: (provedor: ProvedorWhatsApp) => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  const p = await obterProvedorDaConexao(conexaoId);
  if (!p.ok) return p;
  return operacao(p.dados);
}

export function enviarTextoPelaConexao(conexaoId: string | null, e: EnvioTexto): Promise<Resultado<ResultadoEnvio>> {
  return com(conexaoId, (p) => p.enviarTexto({ conexaoId }, e));
}

export function enviarMidiaPelaConexao(conexaoId: string | null, e: EnvioMidia): Promise<Resultado<ResultadoEnvio>> {
  return com(conexaoId, (p) => p.enviarMidia({ conexaoId }, e));
}

export function enviarPresencaPelaConexao(
  conexaoId: string | null,
  telefone: string,
  duracaoMs: number,
): Promise<Resultado<null>> {
  return com(conexaoId, (p) => p.enviarPresenca({ conexaoId }, telefone, duracaoMs));
}

export function apagarMensagemPelaConexao(conexaoId: string | null, e: ApagarMensagem): Promise<Resultado<null>> {
  return com(conexaoId, (p) => p.apagarMensagem({ conexaoId }, e));
}

export function consultarStatusDaConexao(conexaoId: string | null): Promise<Resultado<StatusConexao>> {
  return com(conexaoId, (p) => p.consultarStatus({ conexaoId }));
}

export function editarMensagemPelaConexao(conexaoId: string | null, e: EditarMensagem): Promise<Resultado<null>> {
  return com(conexaoId, (p) => p.editarMensagem({ conexaoId }, e));
}

/** Publica um status (stories) pelo provedor da conexão. */
export function publicarStatusPelaConexao(
  conexaoId: string | null,
  e: PublicarStatusEntrada,
): Promise<Resultado<null>> {
  return com(conexaoId, (p) => p.publicarStatus({ conexaoId }, e));
}

/** Baixa uma mídia que o provedor não entrega por URL direta (ex.: Evolution). */
export function baixarMidiaPelaConexao(conexaoId: string | null, idMensagem: string): Promise<Resultado<MidiaBaixada>> {
  return com(conexaoId, (p) => p.baixarMidia({ conexaoId }, { idMensagem }));
}

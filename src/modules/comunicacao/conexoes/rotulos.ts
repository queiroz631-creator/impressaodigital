export type ProvedorWhatsapp = "zapi" | "evolution";
export type EstadoConexao = "conectado" | "conectando" | "desconectado" | "erro" | "desconhecido";

export function normalizarProvedor(valor: string | null | undefined): ProvedorWhatsapp {
  return valor === "evolution" ? "evolution" : "zapi";
}

export function rotuloProvedor(valor: string | null | undefined): string {
  return normalizarProvedor(valor) === "evolution" ? "Evolution API" : "Z-API";
}

export function normalizarEstado(valor: string | null | undefined): EstadoConexao {
  switch (valor) {
    case "conectado":
    case "conectando":
    case "desconectado":
    case "erro":
      return valor;
    default:
      return "desconhecido";
  }
}

export function rotuloEstado(valor: string | null | undefined): string {
  switch (normalizarEstado(valor)) {
    case "conectado":
      return "Conectado";
    case "conectando":
      return "Aguardando QR Code";
    case "desconectado":
      return "Desconectado";
    case "erro":
      return "Com erro";
    default:
      return "Sem verificação";
  }
}

/** Ações por QR Code/instância só existem na Evolution. */
export function usaQrCode(provedor: string | null | undefined): boolean {
  return normalizarProvedor(provedor) === "evolution";
}

export function rotuloStatusEvento(status: string): string {
  switch (status) {
    case "processado":
      return "Processado";
    case "ignorado":
      return "Ignorado";
    case "erro":
      return "Erro";
    case "recebido":
      return "Recebido";
    default:
      return status;
  }
}

/** Nome da variável de ambiente aceito pelo servidor (espelha a validação do backend). */
export function segredoRefValido(valor: string): boolean {
  return /^EVOLUTION_API_KEY[A-Z0-9_]{0,40}$/.test(valor.trim());
}

/** Extrai apenas a imagem do QR (aceita base64 puro ou data URL). */
export function srcQrCode(base64: string | null | undefined): string | null {
  const v = (base64 ?? "").trim();
  if (!v) return null;
  return v.startsWith("data:image/") ? v : `data:image/png;base64,${v}`;
}

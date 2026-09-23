/**
 * Arquivamento do arquivo importado: move o documento para uma pasta escolhida
 * pelo usuário no próprio computador (File System Access API — Chrome/Edge).
 * Nada é enviado ao servidor.
 */

const BANCO = "curriculo-arquivamento";
const LOJA = "handles";
const CHAVE = "pasta-destino";

/* eslint-disable @typescript-eslint/no-explicit-any */

export class ErroArquivamento extends Error {}

export function suportaArquivamento(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).showDirectoryPicker === "function" &&
    typeof indexedDB !== "undefined"
  );
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(LOJA)) req.result.createObjectStore(LOJA);
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

async function gravarNoBanco(valor: unknown) {
  const db = await abrirBanco();
  await new Promise<void>((ok, falha) => {
    const tx = db.transaction(LOJA, "readwrite");
    if (valor === null) tx.objectStore(LOJA).delete(CHAVE);
    else tx.objectStore(LOJA).put(valor, CHAVE);
    tx.oncomplete = () => ok();
    tx.onerror = () => falha(tx.error);
  });
  db.close();
}

/** Pasta de destino salva neste navegador (ou null). */
export async function lerPastaSalva(): Promise<any | null> {
  if (!suportaArquivamento()) return null;
  try {
    const db = await abrirBanco();
    const valor = await new Promise<any>((ok, falha) => {
      const tx = db.transaction(LOJA, "readonly");
      const req = tx.objectStore(LOJA).get(CHAVE);
      req.onsuccess = () => ok(req.result ?? null);
      req.onerror = () => falha(req.error);
    });
    db.close();
    return valor ?? null;
  } catch {
    return null;
  }
}

export async function salvarPasta(handle: any) {
  try {
    await gravarNoBanco(handle);
  } catch {
    /* sem persistência: a escolha vale só nesta sessão */
  }
}

export async function limparPasta() {
  try {
    await gravarNoBanco(null);
  } catch {
    /* ignora */
  }
}

/** Abre o seletor de pasta e guarda a escolha. */
export async function escolherPastaDestino(): Promise<any | null> {
  if (!suportaArquivamento()) throw new ErroArquivamento("SEM_SUPORTE");
  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: "readwrite",
      id: "curriculos-arquivados",
    });
    await salvarPasta(handle);
    return handle;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw new ErroArquivamento("SEM_PERMISSAO");
  }
}

export async function garantirPermissao(handle: any): Promise<boolean> {
  try {
    if ((await handle.queryPermission?.({ mode: "readwrite" })) === "granted") return true;
    return (await handle.requestPermission?.({ mode: "readwrite" })) === "granted";
  } catch {
    return false;
  }
}

function nomeComSufixo(nome: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const marca = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  const ponto = nome.lastIndexOf(".");
  if (ponto <= 0) return `${nome}-${marca}`;
  return `${nome.slice(0, ponto)}-${marca}${nome.slice(ponto)}`;
}

async function nomeDisponivel(pasta: any, nome: string) {
  try {
    await pasta.getFileHandle(nome);
    return nomeComSufixo(nome);
  } catch {
    return nome;
  }
}

/** Copia o arquivo para a pasta escolhida e remove o original. */
export async function moverArquivo(arquivoHandle: any, pasta: any): Promise<string> {
  if (!suportaArquivamento()) throw new ErroArquivamento("SEM_SUPORTE");
  if (!(await garantirPermissao(pasta))) throw new ErroArquivamento("SEM_PERMISSAO");

  let file: File;
  try {
    file = await arquivoHandle.getFile();
  } catch {
    throw new ErroArquivamento("ARQUIVO_EM_USO");
  }

  const nome = await nomeDisponivel(pasta, file.name);
  try {
    const destino = await pasta.getFileHandle(nome, { create: true });
    const stream = await destino.createWritable();
    await file.stream().pipeTo(stream);
  } catch {
    throw new ErroArquivamento("FALHA_MOVER");
  }

  try {
    if (typeof arquivoHandle.remove === "function") {
      await arquivoHandle.remove();
    } else {
      throw new Error("sem-remove");
    }
  } catch {
    throw new ErroArquivamento("COPIADO_SEM_APAGAR");
  }

  return nome;
}

export function mensagemErroArquivamento(codigo: string): string {
  switch (codigo) {
    case "SEM_SUPORTE":
      return "Este navegador não permite mover arquivos. Use o Chrome ou o Edge no computador.";
    case "SEM_PERMISSAO":
      return "A permissão de acesso à pasta não foi concedida. O arquivo continua onde estava.";
    case "ARQUIVO_EM_USO":
      return "O arquivo parece estar aberto em outro programa. Feche-o e mova manualmente.";
    case "COPIADO_SEM_APAGAR":
      return "O arquivo foi copiado para a pasta, mas não foi possível apagar o original.";
    default:
      return "Não foi possível mover o arquivo. Ele continua na pasta de origem.";
  }
}

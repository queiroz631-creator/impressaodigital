/** Print the same ticket in an isolated document, without QZ or a popup. */
export async function imprimirComprovanteNavegador(html: string): Promise<void> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.hidden = true;
  document.body.appendChild(frame);
  const limpar = () => frame.remove();
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("Não foi possível preparar a impressão pelo navegador."));
      }, 10000);
      frame.onload = () => { window.clearTimeout(timeout); resolve(); };
      frame.srcdoc = html;
    });
    const janela = frame.contentWindow;
    if (!janela) throw new Error("Não foi possível abrir a impressão pelo navegador.");
    const timeout = window.setTimeout(limpar, 300000);
    janela.addEventListener("afterprint", () => { window.clearTimeout(timeout); limpar(); }, { once: true });
    janela.focus();
    janela.print();
  } catch (erro) {
    limpar();
    throw erro;
  }
}
import { useEffect, useRef, useState } from "react";
import { Dices, PartyPopper } from "lucide-react";

/**
 * Animação da urna.
 *
 * Só apresentação: o vencedor já foi escolhido e gravado pelo servidor antes de
 * a animação começar. Os números que passam são apenas uma amostra visual dos
 * cupons concorrentes; nada aqui decide, altera ou recalcula o resultado.
 */
export function RoletaCupons({
  numeros,
  vencedor,
  onFim,
}: {
  numeros: string[];
  vencedor: string;
  onFim?: () => void;
}) {
  const [atual, setAtual] = useState(vencedor);
  const [parou, setParou] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const urna = numeros.length > 0 ? numeros : [vencedor];
    let intervalo = 45;
    let passos = 0;
    setParou(false);

    const passo = () => {
      passos += 1;
      // Desaceleração progressiva até parar no número do servidor.
      if (passos > 24) intervalo = Math.round(intervalo * 1.22);

      if (intervalo > 420) {
        setAtual(vencedor);
        setParou(true);
        onFim?.();
        return;
      }

      setAtual(urna[Math.floor(Math.random() * urna.length)] ?? vencedor);
      timer.current = setTimeout(passo, intervalo);
    };

    timer.current = setTimeout(passo, intervalo);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vencedor, numeros.join("|")]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-6 text-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {parou ? (
          <>
            <PartyPopper className="h-4 w-4 text-primary" /> Cupom sorteado
          </>
        ) : (
          <>
            <Dices className="h-4 w-4 animate-bounce" /> Sorteando...
          </>
        )}
      </div>

      <div
        aria-live="polite"
        className={[
          "w-full max-w-full overflow-hidden font-mono tabular-nums transition-all duration-300",
          "text-3xl sm:text-5xl md:text-6xl",
          parou ? "scale-105 font-bold text-primary" : "text-foreground/80",
        ].join(" ")}
      >
        <span className={parou ? "" : "blur-[0.4px]"}>{atual}</span>
      </div>
    </div>
  );
}

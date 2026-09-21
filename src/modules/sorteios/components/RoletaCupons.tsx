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
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <div className="flex items-center gap-2 text-base font-medium text-muted-foreground">
        {parou ? (
          <>
            <PartyPopper className="h-5 w-5 text-primary" /> Cupom sorteado
          </>
        ) : (
          <>
            <Dices className="h-5 w-5 animate-bounce text-primary" /> Sorteando...
          </>
        )}
      </div>

      <div
        className={[
          "relative w-full overflow-hidden rounded-2xl border bg-gradient-to-b from-muted/60 to-muted/20 px-4 py-10 shadow-inner transition-all duration-500 sm:py-14",
          parou ? "border-primary/60 shadow-[0_0_60px_-12px] shadow-primary/40" : "border-border",
        ].join(" ")}
      >
        {/* faixas laterais suaves para efeito de visor */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background/70 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background/70 to-transparent" />

        <div
          aria-live="polite"
          className={[
            "flex min-h-28 w-full items-center justify-center font-mono font-bold tabular-nums tracking-wider transition-all duration-300 sm:min-h-36",
            "text-5xl sm:text-7xl md:text-8xl",
            parou ? "scale-105 text-primary" : "text-foreground/70",
          ].join(" ")}
        >
          <span
            key={atual}
            className={parou ? "animate-scale-in drop-shadow-sm" : "animate-fade-in blur-[1px]"}
          >
            {atual}
          </span>
        </div>
      </div>
    </div>
  );
}

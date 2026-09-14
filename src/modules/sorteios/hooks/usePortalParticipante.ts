import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { obterContextoParticipante } from "@/lib/sorteios-publico.functions";

/**
 * Guarda das telas privadas do portal: valida a sessão no servidor a cada
 * carregamento. Sem sessão (ou sorteio indisponível) volta para a entrada;
 * com nova versão de termos pendente, força a tela de aceite.
 */
export function useContextoPortal() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const contextoFn = useServerFn(obterContextoParticipante);
  const consulta = useQuery({
    queryKey: ["portal-contexto"],
    queryFn: () => contextoFn({}),
    retry: false,
    staleTime: 30_000,
  });

  const resultado = consulta.data;
  useEffect(() => {
    if (!resultado) return;
    if (!resultado.ok) {
      if (resultado.codigo === "SESSAO" || resultado.codigo === "SORTEIO_INDISPONIVEL") {
        void navigate({ to: "/sorteios-publico" });
      }
      return;
    }
    if (resultado.dados.precisaAceitarTermos && pathname !== "/sorteios-publico/termos") {
      void navigate({ to: "/sorteios-publico/termos" });
    }
  }, [resultado, pathname, navigate]);

  return consulta;
}

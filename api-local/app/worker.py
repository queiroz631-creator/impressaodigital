"""Motor de sincronização contínua do serviço Windows."""
from __future__ import annotations
import threading
import time
from app.config import config
from app.runtime import now, update
from app.services import clientes, notas
from app.utils.logging import erro_seguro, logger

class SyncWorker:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._force = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive(): return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="LojamixSyncWorker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set(); self._force.set()
        if self._thread: self._thread.join(timeout=15)

    def sync_now(self) -> None:
        self._force.set()

    def _run(self) -> None:
        update(service="running")
        self._cycle()
        while not self._stop.is_set():
            intervalo = max(1, int(config().sync_interval_seconds))
            # Acorda imediatamente quando "Sincronizar agora" for solicitado.
            if self._force.wait(intervalo):
                self._force.clear()
                if self._stop.is_set():
                    break
                self._cycle()
            else:
                self._cycle()
        update(service="stopped")

    def _cycle(self) -> None:
        if self._stop.is_set(): return
        if self._force.is_set(): self._force.clear()
        update(sync_running=True, last_cycle=now(), last_error=None)
        resultado: dict[str, object] = {}
        try:
            # Um único sorteio ativo é consultado por ciclo e reutilizado nas
            # notas e nos clientes elegíveis.
            sorteio = notas.sorteio_ativo()
            resultado["notas"] = notas.enviar_novas(sorteio=sorteio).model_dump()
            resultado["situacoes"] = notas.enviar_situacoes(sorteio=sorteio).model_dump()
            resultado["clientes_loja_sistema"] = clientes.enviar_para_sistema(sorteio=sorteio).model_dump()
            # Passo de recuperação: varre o cadastro em blocos e reenvia quem é
            # elegível, cobrindo eventos perdidos e marcadores adiantados.
            resultado["clientes_revisao"] = clientes.revisar_elegiveis(sorteio=sorteio).model_dump()
            resultado["clientes_sistema_loja"] = clientes.aplicar_alteracoes()
            # Envio pendente: clientes do sistema ainda sem ligação com a loja
            # (pessoa física + CPF válido + telefone + participação em sorteio
            # ATIVO). Vincula por CPF ou cria em transação; não depende de nota.
            resultado["clientes_pendentes_loja"] = clientes.enviar_pendentes_para_loja().model_dump()

            # As funções de sincronização tratam erros por lote para preservar
            # os cursores. Aqui transformamos o erro registrado no resumo em
            # "Último erro" da aplicação, sem interromper os demais ciclos.
            detalhes = []
            for nome, item in resultado.items():
                if isinstance(item, dict) and item.get("erroDetalhe"):
                    detalhes.append(f"{nome}: {item['erroDetalhe']}")
                elif isinstance(item, dict) and item.get("erros"):
                    detalhes.append(f"{nome}: ocorreu {item['erros']} erro(s); consulte os detalhes.")

            erro_ciclo = " | ".join(detalhes)[:1000] if detalhes else None
            update(
                last_success=now(),
                last_result=resultado,
                last_error=erro_ciclo,
            )
            if erro_ciclo:
                logger().error("ciclo com erro por etapa: %s", erro_ciclo)
            else:
                logger().info("ciclo concluido")
        except Exception as exc:  # noqa: BLE001
            safe = erro_seguro(exc)
            update(last_error=safe, last_result=resultado)
            logger().error("ciclo com erro: %s", safe)
        finally:
            update(sync_running=False)

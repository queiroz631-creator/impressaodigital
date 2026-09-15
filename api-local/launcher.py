"""Entrada única do Lojamix Sync para Windows."""
from __future__ import annotations

import threading
import time
import tkinter as tk

import uvicorn

from app.config import config
from app.main import app as fastapi_app
from app.routes.controle import definir_worker
from app.worker import SyncWorker
from app.runtime import update
from gui.main import App
from app.windows import TrayController, startup_enabled, set_startup


def main() -> None:
    cfg = config()

    worker = SyncWorker()
    definir_worker(worker)

    server = uvicorn.Server(
        uvicorn.Config(
            fastapi_app,
            host="127.0.0.1",
            port=cfg.api_local_port,
            log_level="warning",
            access_log=False,
            log_config=None,
            loop="asyncio",
        )
    )

    api_error: list[BaseException] = []

    def run_api() -> None:
        try:
            server.run()
        except BaseException as exc:  # noqa: BLE001
            api_error.append(exc)
            update(api_error=str(exc), service="api_error")

    api_thread = threading.Thread(
        target=run_api,
        name="LojamixSyncAPI",
        daemon=True,
    )
    api_thread.start()

    # Dá tempo para o listener local abrir antes da interface consultar status.
    deadline = time.monotonic() + 8
    while api_thread.is_alive() and time.monotonic() < deadline:
        if api_error:
            break
        time.sleep(0.1)

    worker.start()
    app = App()
    tray = TrayController(app)
    tray.start()

    # Primeira execução do EXE: habilita inicialização automática.
    if getattr(__import__("sys"), "frozen", False) and not startup_enabled():
        set_startup(True)
    if startup_enabled():
        app.after(250, app.withdraw)

    if api_error:
        app.after(
            200,
            lambda: app.show_startup_error(
                "A API local não conseguiu iniciar.\n\n"
                f"Detalhe: {str(api_error[0])[:500]}"
            ),
        )

    original_destroy = app.destroy

    def close() -> None:
        try:
            tray.stop()
            server.should_exit = True
            worker.stop()
        finally:
            original_destroy()

    def real_quit():
        close()
    app.quit_from_tray = real_quit
    app.protocol("WM_DELETE_WINDOW", app.close_app)
    app.mainloop()


if __name__ == "__main__":
    main()

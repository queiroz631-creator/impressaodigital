"""Entrada do serviço Windows: API local + worker de sincronização."""
from __future__ import annotations
import asyncio
import sys
import threading

import uvicorn
from app.config import config
from app.routes.controle import definir_worker
from app.worker import SyncWorker

try:
    import servicemanager
    import win32event
    import win32service
    import win32serviceutil
except ImportError:  # permite importar/testar em ambiente sem pywin32
    servicemanager = win32event = win32service = win32serviceutil = None

class LojamixSyncService(win32serviceutil.ServiceFramework if win32serviceutil else object):
    _svc_name_ = "LojamixSync"
    _svc_display_name_ = "Lojamix Sync"
    _svc_description_ = "Sincroniza o Lojamix SQL Server com o sistema Queiroz Tecnologia."

    def __init__(self, args):
        if win32serviceutil:
            super().__init__(args)
            self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.worker = SyncWorker()
        self.server: uvicorn.Server | None = None
        self.thread: threading.Thread | None = None

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        self.worker.stop()
        if self.server: self.server.should_exit = True
        win32event.SetEvent(self.stop_event)
        self.ReportServiceStatus(win32service.SERVICE_STOPPED)

    def SvcDoRun(self):
        if servicemanager: servicemanager.LogInfoMsg("Lojamix Sync iniciado")
        definir_worker(self.worker)
        self.worker.start()
        cfg = config()
        uv_config = uvicorn.Config("app.main:app", host="127.0.0.1", port=cfg.api_local_port, log_level="warning")
        self.server = uvicorn.Server(uv_config)
        asyncio.run(self.server.serve())

if __name__ == "__main__":
    if not win32serviceutil:
        raise SystemExit("Execute no Windows com pywin32 instalado.")
    win32serviceutil.HandleCommandLine(LojamixSyncService)

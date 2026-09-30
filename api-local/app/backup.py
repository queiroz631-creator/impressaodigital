"""Backup incorporado ao Lojamix Sync, preservando as regras do programa antigo."""
from __future__ import annotations

import json
import os
import queue
import threading
import time
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.settings_store import BASE_DIR, load_config, load_secrets, save_config, save_secrets

DEFAULT_API = "https://backup.queiroztecno.com.br"
LOG_FILE = BASE_DIR / "backup.log"


def log(message: str) -> None:
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(time.strftime("[%Y-%m-%d %H:%M:%S] ") + message + "\n")


def require_token(token: str) -> str:
    value = token.strip()
    if not value:
        raise RuntimeError("Informe o token da API de backup.")
    return value


def api_get(url: str, token: str | None = None, timeout: int = 30) -> bytes:
    headers = {}
    if token is not None:
        headers["Authorization"] = "Bearer " + require_token(token)
    with urlopen(Request(url, headers=headers), timeout=timeout) as response:
        return response.read()


def api_post(url: str, token: str, timeout: int = 60) -> tuple[int, dict]:
    request = Request(url, data=b"{}", headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + require_token(token),
    }, method="POST")
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read()
            status = getattr(response, "status", response.getcode())
    except HTTPError as exc:
        body = exc.read()
        status = exc.code
    try:
        parsed = json.loads(body or b"{}")
    except Exception:
        parsed = {}
    return status, parsed if isinstance(parsed, dict) else {}


class BackupSobDemandaIndisponivel(Exception):
    pass


def solicitar_backup(api: str, token: str) -> tuple[str, str, int]:
    status, data = api_post(api.rstrip("/") + "/api/backups", token)
    if status in (404, 405, 501):
        raise BackupSobDemandaIndisponivel(
            "Este servidor de backup não aceita gerar cópia sob demanda.\n\n"
            "Atualize o servidor para a versão com a rota POST /api/backups."
        )
    if status in (401, 403):
        raise RuntimeError(data.get("error") or "Token recusado pelo servidor de backup.")
    if status in (200, 201, 202, 409):
        job_id = data.get("job_id")
        if not job_id:
            raise RuntimeError(data.get("mensagem") or data.get("error") or "O servidor não informou a operação.")
        return str(job_id), str(data.get("mensagem") or "Backup em andamento."), status
    raise RuntimeError(data.get("error") or data.get("mensagem") or f"O servidor respondeu com o código {status}.")


def status_backup(api: str, token: str, job_id: str) -> dict:
    url = api.rstrip("/") + "/api/backups/status/" + quote(job_id, safe="")
    data = json.loads(api_get(url, token) or b"{}")
    return data if isinstance(data, dict) else {}


def get_backups(api: str, token: str) -> list[dict]:
    data = json.loads(api_get(api.rstrip("/") + "/api/backups", token) or b"{}")
    return data.get("backups", []) if isinstance(data, dict) else []


def backup_filename(item: dict) -> str:
    return str(item.get("arquivo") or item.get("file") or item.get("filename") or "")


def backup_size_text(item: dict) -> str:
    try:
        size = int(item.get("tamanho_bytes", item.get("size", 0)) or 0)
        return f"{size / 1024**3:.2f} GB" if size >= 1024**3 else f"{size / 1024**2:.2f} MB"
    except Exception:
        return "0.00 MB"


def backup_date_text(item: dict) -> str:
    timestamp = item.get("modificado_em")
    if timestamp:
        try:
            return datetime.fromtimestamp(float(timestamp)).strftime("%d/%m/%Y %H:%M")
        except Exception:
            pass
    return str(item.get("modified") or item.get("created") or "").replace("T", " ")[:19]


def backup_sort_key(item: dict):
    try:
        return float(item.get("modificado_em") or 0)
    except Exception:
        return str(item.get("modified") or item.get("created") or "")


class BackupPanel(ttk.Frame):
    """Aba de backup sem janela, bandeja ou inicialização próprias."""

    def __init__(self, parent, owner) -> None:
        super().__init__(parent, padding=18)
        self.owner = owner
        self.running = True
        self.ui_queue: queue.Queue = queue.Queue()
        self.backups: list[dict] = []
        self.gerando = False
        self.progress_mode = "determinate"
        self._schedule_id = None
        cfg, sec = load_config(), load_secrets()
        self.api_var = tk.StringVar(value=cfg.get("backup_api_url", DEFAULT_API))
        self.token_var = tk.StringVar(value=sec.get("backup_token", ""))
        self.folder_var = tk.StringVar(value=cfg.get("backup_folder", str(Path.home() / "Backups" / "ImpressaoDigital")))
        self.interval_var = tk.IntVar(value=int(cfg.get("backup_interval_minutes", 60)))
        self.auto_var = tk.BooleanVar(value=bool(cfg.get("backup_automatico", True)))
        self.status_var = tk.StringVar(value="Aguardando...")
        self.progress_var = tk.DoubleVar(value=0)
        self._build()
        self.after(100, self._process_queue)
        self.after(1200, self.initial_check)

    def _build(self) -> None:
        ttk.Label(self, text="Backup Impressão Digital", font=("Segoe UI", 18, "bold")).pack(anchor="w")
        ttk.Label(self, text="Lista, gera e baixa as cópias do servidor de backup.").pack(anchor="w", pady=(0, 16))
        grid = ttk.Frame(self)
        grid.pack(fill="x")
        grid.columnconfigure(1, weight=1)
        ttk.Label(grid, text="Pasta local:").grid(row=0, column=0, sticky="w", pady=5)
        ttk.Entry(grid, textvariable=self.folder_var).grid(row=0, column=1, sticky="ew", pady=5)
        ttk.Button(grid, text="Escolher", command=self.choose_folder).grid(row=0, column=2, padx=6)
        ttk.Label(grid, text="Verificar a cada (min):").grid(row=1, column=0, sticky="w", pady=5)
        ttk.Spinbox(grid, from_=5, to=1440, textvariable=self.interval_var, width=10).grid(row=1, column=1, sticky="w", pady=5)
        ttk.Checkbutton(self, text="Backup automático", variable=self.auto_var, command=self.save).pack(anchor="w", pady=8)
        buttons = ttk.Frame(self)
        buttons.pack(fill="x", pady=(10, 8))
        ttk.Button(buttons, text="Testar conexão", command=self.test_connection).pack(side="left", padx=(0, 6))
        ttk.Button(buttons, text="Atualizar lista", command=self.update_list).pack(side="left", padx=6)
        self.btn_generate = ttk.Button(buttons, text="Gerar backup agora", command=self.generate_backup)
        self.btn_generate.pack(side="left", padx=6)
        self.btn_selected = ttk.Button(buttons, text="Baixar selecionado", command=self.download_selected)
        self.btn_selected.pack(side="left", padx=6)
        self.btn_latest = ttk.Button(buttons, text="Baixar último backup", command=self.download_latest)
        self.btn_latest.pack(side="left", padx=6)
        ttk.Button(buttons, text="Abrir pasta", command=self.open_folder).pack(side="left", padx=6)
        ttk.Label(self, text="Backups disponíveis — selecione um para baixar:", font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=(8, 5))
        table = ttk.Frame(self)
        table.pack(fill="both", expand=True)
        self.tree = ttk.Treeview(table, columns=("file", "size", "modified"), show="headings", height=9)
        for key, text, width, anchor in (("file", "Backup", 390, "w"), ("size", "Tamanho", 110, "e"), ("modified", "Data", 170, "center")):
            self.tree.heading(key, text=text)
            self.tree.column(key, width=width, anchor=anchor)
        scrollbar = ttk.Scrollbar(table, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        self.tree.bind("<Double-1>", lambda _event: self.download_selected())
        self.progress = ttk.Progressbar(self, variable=self.progress_var, maximum=100)
        self.progress.pack(fill="x", pady=10)
        ttk.Label(self, textvariable=self.status_var).pack(anchor="w")

    def _credentials(self) -> tuple[str, str]:
        return self.api_var.get().strip().rstrip("/"), require_token(self.token_var.get())

    def save(self) -> None:
        cfg = load_config()
        cfg.update({"backup_api_url": self.api_var.get().strip().rstrip("/"), "backup_folder": self.folder_var.get().strip(), "backup_interval_minutes": max(5, int(self.interval_var.get())), "backup_automatico": self.auto_var.get(), "backup_legacy_imported": True})
        sec = load_secrets()
        sec["backup_token"] = self.token_var.get().strip()
        save_config(cfg)
        save_secrets(sec)

    def choose_folder(self) -> None:
        selected = filedialog.askdirectory(parent=self.owner, initialdir=self.folder_var.get())
        if selected:
            self.folder_var.set(selected)
            self.save()

    def open_folder(self) -> None:
        folder = Path(self.folder_var.get()).expanduser()
        folder.mkdir(parents=True, exist_ok=True)
        os.startfile(str(folder))

    def test_connection(self) -> None:
        self.save()
        def work() -> None:
            try:
                api, _token = self._credentials()
                api_get(api + "/health", timeout=15)
                self.ui_queue.put(("info", "Conexão", "API de backup funcionando corretamente."))
                self.ui_queue.put(("status", "API de backup conectada."))
            except Exception as exc:
                log(f"Erro conexão: {exc}")
                self.ui_queue.put(("error", "Conexão", str(exc)))
        threading.Thread(target=work, name="BackupTest", daemon=True).start()

    def update_list(self, quiet: bool = False) -> None:
        try:
            self.save()
        except Exception as exc:
            if not quiet:
                messagebox.showerror("Backup", str(exc), parent=self.owner)
            return
        def work() -> None:
            try:
                api, token = self._credentials()
                items = get_backups(api, token)
                items.sort(key=backup_sort_key, reverse=True)
                self.ui_queue.put(("list", items, quiet))
            except Exception as exc:
                log(f"Erro lista: {exc}")
                self.ui_queue.put(("status", f"Erro na verificação automática: {exc}")) if quiet else self.ui_queue.put(("error", "Backup", str(exc)))
        threading.Thread(target=work, name="BackupList", daemon=True).start()

    def _populate(self, items: list[dict], quiet: bool) -> None:
        self.backups = items
        for item in self.tree.get_children():
            self.tree.delete(item)
        for index, backup in enumerate(items):
            self.tree.insert("", "end", iid=str(index), values=(backup_filename(backup), backup_size_text(backup), backup_date_text(backup)))
        self.status_var.set(f"{len(items)} backup(s) disponível(is)")
        if quiet and self.auto_var.get() and items:
            filename = backup_filename(items[0])
            if filename and not (Path(self.folder_var.get()).expanduser() / filename).exists():
                self.start_download(filename, automatic=True)

    def download_selected(self) -> None:
        selection = self.tree.selection()
        if not selection:
            messagebox.showinfo("Backup", "Selecione um backup na lista.", parent=self.owner)
            return
        try:
            filename = backup_filename(self.backups[int(selection[0])])
        except Exception:
            filename = ""
        if filename:
            self.start_download(filename)
        else:
            messagebox.showerror("Backup", "Não foi possível identificar o backup selecionado.", parent=self.owner)

    def download_latest(self) -> None:
        try:
            self.save()
        except Exception as exc:
            messagebox.showerror("Backup", str(exc), parent=self.owner)
            return
        self._set_progress_mode("indeterminate")
        self.status_var.set("Consultando o último backup...")
        def work() -> None:
            try:
                api, token = self._credentials()
                items = get_backups(api, token)
                items.sort(key=backup_sort_key, reverse=True)
                if not items:
                    self.ui_queue.put(("info", "Backup", "Nenhum backup disponível no servidor."))
                    return
                filename = backup_filename(items[0])
                if not filename:
                    raise RuntimeError("O último backup não possui nome de arquivo.")
                self.ui_queue.put(("download", filename, False))
            except Exception as exc:
                self.ui_queue.put(("error", "Backup", str(exc)))
        threading.Thread(target=work, name="BackupLatest", daemon=True).start()

    def _set_buttons(self, enabled: bool) -> None:
        state = "normal" if enabled else "disabled"
        for button in (self.btn_generate, self.btn_selected, self.btn_latest):
            button.configure(state=state)

    def generate_backup(self) -> None:
        if self.gerando:
            messagebox.showinfo("Backup", "Já existe um backup sendo gerado por este programa.", parent=self.owner)
            return
        try:
            self.save()
            self._credentials()
        except Exception as exc:
            messagebox.showerror("Backup", str(exc), parent=self.owner)
            return
        if not messagebox.askyesno("Gerar backup", "Gerar uma nova cópia do banco no servidor agora?\n\nAo terminar, o arquivo será baixado automaticamente.", parent=self.owner):
            return
        self.gerando = True
        self._set_buttons(False)
        self._set_progress_mode("indeterminate")
        threading.Thread(target=self._generate_worker, name="BackupGenerate", daemon=True).start()

    def _generate_worker(self) -> None:
        try:
            api, token = self._credentials()
            job_id, message, status = solicitar_backup(api, token)
            self.ui_queue.put(("status", "Já existe um backup em andamento. Acompanhando..." if status == 409 else message))
            deadline, filename = time.time() + 3600, ""
            while time.time() < deadline:
                time.sleep(5)
                data = status_backup(api, token, job_id)
                situation = str(data.get("status") or "").upper()
                message = str(data.get("mensagem") or "Gerando backup no servidor...")
                if situation in ("AGUARDANDO", "EXECUTANDO"):
                    self.ui_queue.put(("status", message))
                    continue
                if situation == "CONCLUIDO":
                    filename = str(data.get("filename") or "")
                    break
                if situation == "ERRO":
                    raise RuntimeError(message)
            if not filename:
                raise RuntimeError("O tempo de espera do backup esgotou. Use Atualizar lista mais tarde.")
            self.ui_queue.put(("generate_done",))
            self.ui_queue.put(("download", filename, False))
        except Exception as exc:
            log(f"Erro ao gerar backup: {type(exc).__name__}: {exc}")
            self.ui_queue.put(("generate_done",))
            self.ui_queue.put(("error", "Erro ao gerar backup", str(exc)))

    def start_download(self, filename: str, automatic: bool = False) -> None:
        try:
            self.save()
            folder = Path(self.folder_var.get()).expanduser()
            folder.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            messagebox.showerror("Backup", f"Não foi possível acessar a pasta:\n\n{exc}", parent=self.owner)
            return
        destination = folder / filename
        if destination.exists() and (automatic or not messagebox.askyesno("Arquivo existente", f"O arquivo {destination.name} já existe. Deseja substituir?", parent=self.owner)):
            return
        self._set_progress_mode("indeterminate")
        self.status_var.set(f"Preparando download: {filename}")
        threading.Thread(target=self._download_worker, args=(filename, destination, automatic), name="BackupDownload", daemon=True).start()

    def _download_worker(self, filename: str, destination: Path, automatic: bool) -> None:
        temporary = Path(str(destination) + ".part")
        try:
            api, token = self._credentials()
            url = api + "/api/backups/" + quote(filename, safe="") + "/download"
            request = Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/octet-stream, application/gzip, */*"})
            with urlopen(request, timeout=3600) as response, temporary.open("wb") as handle:
                if "application/json" in response.headers.get("Content-Type", "").lower():
                    raise RuntimeError("O servidor respondeu uma mensagem em vez do arquivo de backup.")
                try:
                    total = int(response.headers.get("Content-Length", "0") or 0)
                except (TypeError, ValueError):
                    total = 0
                self.ui_queue.put(("mode", "determinate" if total else "indeterminate"))
                done = 0
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    handle.write(chunk)
                    done += len(chunk)
                    percent = min(100.0, done * 100.0 / total) if total else 0
                    text = f"Baixando: {done / 1024**2:.1f}" + (f" / {total / 1024**2:.1f} MB" if total else " MB")
                    self.ui_queue.put(("progress", percent, text))
            if done == 0 or (total and done != total):
                raise RuntimeError("O download do backup ficou incompleto.")
            os.replace(temporary, destination)
            self.ui_queue.put(("done", str(destination), automatic))
        except Exception as exc:
            try:
                temporary.unlink(missing_ok=True)
            except Exception:
                pass
            log(f"Erro download {filename}: {type(exc).__name__}: {exc}")
            self.ui_queue.put(("error", "Erro no download", str(exc)))

    def _set_progress_mode(self, mode: str) -> None:
        if mode == self.progress_mode:
            return
        self.progress_mode = mode
        self.progress.stop()
        self.progress.configure(mode=mode)
        if mode == "indeterminate":
            self.progress.start(12)
        else:
            self.progress_var.set(0)

    def _process_queue(self) -> None:
        try:
            while True:
                item = self.ui_queue.get_nowait()
                kind = item[0]
                if kind == "status": self.status_var.set(item[1])
                elif kind == "mode": self._set_progress_mode(item[1])
                elif kind == "progress":
                    self._set_progress_mode("determinate"); self.progress_var.set(item[1]); self.status_var.set(item[2])
                elif kind == "list": self._populate(item[1], item[2])
                elif kind == "download": self.start_download(item[1], item[2])
                elif kind == "generate_done": self.gerando = False; self._set_buttons(True)
                elif kind == "done":
                    self._set_progress_mode("determinate"); self.progress_var.set(100); self.status_var.set("Backup automático concluído." if item[2] else "Download concluído.")
                    if not item[2]: messagebox.showinfo("Download concluído", f"Backup salvo em:\n\n{item[1]}", parent=self.owner)
                elif kind == "info": messagebox.showinfo(item[1], item[2], parent=self.owner)
                elif kind == "error": self._set_progress_mode("determinate"); self.status_var.set("Erro."); messagebox.showerror(item[1], item[2], parent=self.owner)
        except queue.Empty:
            pass
        if self.running:
            self.after(100, self._process_queue)

    def initial_check(self) -> None:
        if self.running:
            self.update_list(quiet=True)
            self._schedule_id = self.after(max(5, int(self.interval_var.get())) * 60 * 1000, self.initial_check)

    def shutdown(self) -> None:
        self.running = False
        if self._schedule_id is not None:
            try:
                self.after_cancel(self._schedule_id)
            except Exception:
                pass
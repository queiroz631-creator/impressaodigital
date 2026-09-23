import json
import os
import sys
import threading
import time
import queue
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from datetime import datetime

APP_NAME = "BackupImpressaoDigital"
APP_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / APP_NAME
CONFIG_FILE = APP_DIR / "config.json"
LOG_FILE = APP_DIR / "backup.log"
DEFAULT_API = "https://backup.queiroztecno.com.br"
DEFAULT_FOLDER = Path.home() / "Backups" / "ImpressaoDigital"

APP_DIR.mkdir(parents=True, exist_ok=True)

def log(msg):
    APP_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(time.strftime("[%Y-%m-%d %H:%M:%S] ") + msg + "\n")

def load_config():
    try:
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {
            "api_url": DEFAULT_API,
            "token": "",
            "folder": str(DEFAULT_FOLDER),
            "interval": 60,
            "auto": True,
            "startup": True,
        }

def save_config(cfg):
    APP_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")

def startup_cmd_path():
    startup = Path(os.environ["APPDATA"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
    return startup / f"{APP_NAME}.cmd"

def install_startup(exe_path):
    p = startup_cmd_path()
    p.write_text(f'@echo off\r\nstart "" /min "{exe_path}" --background\r\n', encoding="utf-8")
    return p

def remove_startup():
    p = startup_cmd_path()
    if p.exists():
        p.unlink()

def require_token(token):
    token = token.strip()
    if not token:
        raise RuntimeError("Informe o token da API.")
    return token

def api_get(url, token=None, timeout=30):
    headers = {}
    if token is not None:
        headers["Authorization"] = "Bearer " + require_token(token)
    req = Request(url, headers=headers)
    with urlopen(req, timeout=timeout) as r:
        return r.read()

def get_backups(api, token):
    # Mantém o mesmo formato da V4: /api/backups -> { "backups": [...] }
    data = json.loads(api_get(api.rstrip("/") + "/api/backups", token))
    return data.get("backups", []) if isinstance(data, dict) else []

def backup_filename(item):
    return item.get("arquivo") or item.get("file") or item.get("filename") or ""

def backup_size_text(item):
    raw = item.get("tamanho_bytes")
    if raw is None:
        raw = item.get("size", 0)
    try:
        n = int(raw or 0)
        return f"{n/1024**3:.2f} GB" if n >= 1024**3 else f"{n/1024**2:.2f} MB"
    except Exception:
        return "0.00 MB"

def backup_date_text(item):
    ts = item.get("modificado_em")
    if ts:
        try:
            return datetime.fromtimestamp(float(ts)).strftime("%d/%m/%Y %H:%M")
        except Exception:
            pass
    value = item.get("modified") or item.get("created") or ""
    return str(value).replace("T", " ")[:19]

def backup_sort_key(item):
    ts = item.get("modificado_em")
    if ts:
        try:
            return float(ts)
        except Exception:
            pass
    return str(item.get("modified") or item.get("created") or "")

def download_backup(api, token, filename, target, progress_callback=None):
    url = api.rstrip("/") + "/api/backups/" + quote(filename, safe="") + "/download"
    req = Request(url, headers={"Authorization": "Bearer " + require_token(token)})
    with urlopen(req, timeout=3600) as r, open(target, "wb") as f:
        total = int(r.headers.get("Content-Length", "0") or 0)
        done = 0
        while True:
            chunk = r.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if progress_callback:
                progress_callback(done, total)
    return done, total

class App:
    def __init__(self, background=False):
        self.cfg = load_config()
        self.root = tk.Tk()
        self.root.title(APP_NAME)
        self.root.geometry("760x520")
        self.root.minsize(650, 450)
        self.root.protocol("WM_DELETE_WINDOW", self.hide)
        self.running = True
        self.tray = None

        self.api_var = tk.StringVar(value=self.cfg.get("api_url", DEFAULT_API))
        self.token_var = tk.StringVar(value=self.cfg.get("token", ""))
        self.folder_var = tk.StringVar(value=self.cfg.get("folder", str(DEFAULT_FOLDER)))
        self.interval_var = tk.IntVar(value=int(self.cfg.get("interval", 60)))
        self.auto_var = tk.BooleanVar(value=bool(self.cfg.get("auto", True)))
        self.startup_var = tk.BooleanVar(value=bool(self.cfg.get("startup", True)))
        self.status_var = tk.StringVar(value="Aguardando...")
        self.progress_var = tk.DoubleVar(value=0)
        self.progress_mode = "determinate"
        self.backups = []
        self.selected_backup = None
        self.ui_queue = queue.Queue()

        self.build_ui()
        self.root.after(700, self.setup_tray)
        self.root.after(100, self.process_ui_queue)

        if self.startup_var.get():
            self.ensure_startup()

        self.root.after(1200, self.initial_check)

        if background:
            self.root.withdraw()

    def build_ui(self):
        frm = ttk.Frame(self.root, padding=18)
        frm.pack(fill="both", expand=True)

        ttk.Label(frm, text="Backup Impressão Digital", font=("Segoe UI", 18, "bold")).pack(anchor="w")
        ttk.Label(frm, text="Executando em segundo plano com ícone na área de notificação.").pack(anchor="w", pady=(0, 16))

        grid = ttk.Frame(frm)
        grid.pack(fill="x")

        ttk.Label(grid, text="API:").grid(row=0, column=0, sticky="w", pady=5)
        ttk.Entry(grid, textvariable=self.api_var).grid(row=0, column=1, sticky="ew", pady=5)

        ttk.Label(grid, text="Token:").grid(row=1, column=0, sticky="w", pady=5)
        ttk.Entry(grid, textvariable=self.token_var, show="*").grid(row=1, column=1, sticky="ew", pady=5)

        ttk.Label(grid, text="Pasta local:").grid(row=2, column=0, sticky="w", pady=5)
        ttk.Entry(grid, textvariable=self.folder_var).grid(row=2, column=1, sticky="ew", pady=5)
        ttk.Button(grid, text="Escolher", command=self.choose_folder).grid(row=2, column=2, padx=6)

        ttk.Label(grid, text="Verificar a cada (min):").grid(row=3, column=0, sticky="w", pady=5)
        ttk.Spinbox(grid, from_=5, to=1440, textvariable=self.interval_var, width=10).grid(row=3, column=1, sticky="w", pady=5)

        grid.columnconfigure(1, weight=1)

        ttk.Checkbutton(frm, text="Backup automático", variable=self.auto_var, command=self.save).pack(anchor="w", pady=8)
        ttk.Checkbutton(frm, text="Iniciar com o Windows", variable=self.startup_var, command=self.save).pack(anchor="w", pady=2)

        btns = ttk.Frame(frm)
        btns.pack(fill="x", pady=(14, 8))
        ttk.Button(btns, text="Testar conexão", command=self.test_connection).pack(side="left", padx=(0, 8))
        ttk.Button(btns, text="Atualizar lista", command=self.update_list).pack(side="left", padx=8)
        ttk.Button(btns, text="Baixar selecionado", command=self.download_selected).pack(side="left", padx=8)
        ttk.Button(btns, text="Baixar último backup", command=self.download_latest).pack(side="left", padx=8)
        ttk.Button(btns, text="Abrir pasta", command=self.open_folder).pack(side="left", padx=8)

        ttk.Label(frm, text="Backups disponíveis — selecione um para baixar:",
                  font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=(8, 5))

        table_frame = ttk.Frame(frm)
        table_frame.pack(fill="both", expand=True)

        columns = ("file", "size", "modified")
        self.backup_tree = ttk.Treeview(table_frame, columns=columns, show="headings", height=9)
        self.backup_tree.heading("file", text="Backup")
        self.backup_tree.heading("size", text="Tamanho")
        self.backup_tree.heading("modified", text="Data")
        self.backup_tree.column("file", width=390, anchor="w")
        self.backup_tree.column("size", width=110, anchor="e")
        self.backup_tree.column("modified", width=170, anchor="center")

        scrollbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.backup_tree.yview)
        self.backup_tree.configure(yscrollcommand=scrollbar.set)
        self.backup_tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        self.backup_tree.bind("<<TreeviewSelect>>", self.on_backup_select)
        self.backup_tree.bind("<Double-1>", lambda e: self.download_selected())

        self.progress_bar = ttk.Progressbar(frm, variable=self.progress_var, maximum=100, mode="determinate")
        self.progress_bar.pack(fill="x", pady=10)
        ttk.Label(frm, textvariable=self.status_var).pack(anchor="w")

        ttk.Label(frm, text="O botão X apenas oculta o painel. O programa continua ativo na área de notificação.",
                  foreground="#555").pack(anchor="w", pady=(18, 0))

    def save(self):
        self.cfg.update({
            "api_url": self.api_var.get().strip(),
            "token": self.token_var.get().strip(),
            "folder": self.folder_var.get().strip(),
            "interval": int(self.interval_var.get()),
            "auto": self.auto_var.get(),
            "startup": self.startup_var.get(),
        })
        save_config(self.cfg)
        if self.startup_var.get():
            self.ensure_startup()
        else:
            remove_startup()

    def ensure_startup(self):
        exe = Path(sys.executable).resolve()
        # Só cria inicialização automática quando estiver rodando como EXE.
        if exe.suffix.lower() == ".exe":
            install_startup(exe)

    def choose_folder(self):
        p = filedialog.askdirectory(initialdir=self.folder_var.get())
        if p:
            self.folder_var.set(p)
            self.save()

    def open_folder(self):
        p = Path(self.folder_var.get())
        p.mkdir(parents=True, exist_ok=True)
        os.startfile(str(p))

    def test_connection(self):
        self.save()
        def work():
            try:
                api_get(self.api_var.get().rstrip("/") + "/health", timeout=15)
                self.root.after(0, lambda: messagebox.showinfo(
                    "Conexão", "API funcionando corretamente."
                ))
                self.ui_status("API funcionando corretamente.")
            except Exception as e:
                log(f"Erro conexão: {e}")
                self.root.after(0, lambda e=e: self.show_error(e))
        threading.Thread(target=work, daemon=True).start()

    def show_error(self, e):
        self.status_var.set("Erro.")
        messagebox.showerror("Erro", str(e))

    def update_list(self):
        self.save()
        def work():
            try:
                backups = get_backups(self.api_var.get(), self.token_var.get())
                backups.sort(key=backup_sort_key, reverse=True)
                self.backups = backups
                self.root.after(0, self.populate_backup_list)
                self.ui_status(f"{len(backups)} backup(s) disponível(is)")
            except Exception as e:
                log(f"Erro lista: {e}")
                self.root.after(0, lambda e=e: self.show_error(e))
        threading.Thread(target=work, daemon=True).start()

    def populate_backup_list(self):
        for item in self.backup_tree.get_children():
            self.backup_tree.delete(item)

        for idx, b in enumerate(self.backups):
            self.backup_tree.insert(
                "", "end", iid=str(idx),
                values=(
                    backup_filename(b),
                    backup_size_text(b),
                    backup_date_text(b),
                )
            )

    def on_backup_select(self, event=None):
        selected = self.backup_tree.selection()
        if not selected:
            self.selected_backup = None
            return
        idx = int(selected[0])
        if 0 <= idx < len(self.backups):
            self.selected_backup = self.backups[idx]

    def set_progress_mode(self, mode):
        if mode == self.progress_mode:
            return
        self.progress_mode = mode
        if mode == "indeterminate":
            self.progress_bar.stop()
            self.progress_bar.configure(mode="indeterminate")
            self.progress_bar.start(12)
        else:
            self.progress_bar.stop()
            self.progress_bar.configure(mode="determinate")
            self.progress_var.set(0)

    def set_download_progress(self, percent, text):
        if self.progress_mode != "determinate":
            self.set_progress_mode("determinate")
        self.progress_var.set(percent)
        self.status_var.set(text)

    def download_selected(self):
        self.save()
        selected = self.backup_tree.selection()
        if not selected:
            messagebox.showinfo("Backup", "Selecione um backup na lista.")
            return

        try:
            idx = int(selected[0])
            filename = backup_filename(self.backups[idx])
        except Exception:
            messagebox.showerror("Backup", "Não foi possível identificar o backup selecionado.")
            return

        if not filename:
            messagebox.showerror("Backup", "O backup selecionado não possui nome de arquivo.")
            return

        self.start_download(filename, automatic=False)

    def download_latest(self):
        self.save()
        self.set_progress_mode("indeterminate")
        self.status_var.set("Consultando o último backup...")
        threading.Thread(target=self._latest_worker, daemon=True).start()

    def _latest_worker(self):
        try:
            backups = get_backups(self.api_var.get(), self.token_var.get())
            backups.sort(key=backup_sort_key, reverse=True)

            if not backups:
                self.ui_queue.put(("info", "Backup", "Nenhum backup disponível no servidor."))
                return

            filename = backup_filename(backups[0])
            if not filename:
                raise RuntimeError("O último backup não possui nome de arquivo.")

            self.ui_queue.put(("start_download", filename, False))

        except Exception as e:
            log(f"Erro ao obter último backup: {type(e).__name__}: {e}")
            self.ui_queue.put(("error", "Erro", str(e)))

    def start_download(self, filename, automatic=False):
        try:
            folder = Path(self.folder_var.get()).expanduser()
            folder.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            messagebox.showerror("Erro", f"Não foi possível acessar a pasta:\n\n{e}")
            return

        dest = folder / filename

        if dest.exists():
            if automatic:
                return

            if not messagebox.askyesno(
                "Arquivo existente",
                f"O arquivo já existe:\n\n{dest.name}\n\nDeseja substituir?"
            ):
                return

        self.set_progress_mode("indeterminate")
        self.status_var.set(
            ("Automático: " if automatic else "") +
            f"Preparando download: {filename}"
        )

        threading.Thread(
            target=self._download_worker,
            args=(filename, dest, automatic),
            daemon=True
        ).start()

    def _download_worker(self, filename, dest, automatic):
        temp = Path(str(dest) + ".part")

        try:
            api = self.api_var.get().strip().rstrip("/")
            token = require_token(self.token_var.get())

            url = api + "/api/backups/" + quote(filename, safe="") + "/download"

            req = Request(
                url,
                headers={
                    "Authorization": "Bearer " + token,
                    "Accept": "application/octet-stream, application/gzip, */*",
                },
            )

            log(f"Iniciando download: {filename}")

            with urlopen(req, timeout=3600) as response:
                status = getattr(response, "status", 200)
                content_type = response.headers.get("Content-Type", "")
                total_header = response.headers.get("Content-Length", "0")

                try:
                    total = int(total_header or 0)
                except (TypeError, ValueError):
                    total = 0

                self.ui_queue.put(
                    ("status", f"Conexão estabelecida — HTTP {status}")
                )
                if total:
                    self.ui_queue.put(("mode", "determinate"))
                else:
                    self.ui_queue.put(("mode", "indeterminate"))

                # Se o endpoint responder erro em JSON, exibir o conteúdo.
                if "application/json" in content_type.lower():
                    body = response.read(2 * 1024 * 1024)
                    try:
                        data = json.loads(
                            body.decode("utf-8", errors="replace")
                        )
                        detail = (
                            data.get("error")
                            or data.get("message")
                            or data
                        )
                    except Exception:
                        detail = body.decode(
                            "utf-8", errors="replace"
                        )[:2000]

                    raise RuntimeError(
                        f"O servidor respondeu JSON em vez do arquivo: {detail}"
                    )

                done = 0
                last_update = 0.0

                with open(temp, "wb") as f:
                    while True:
                        chunk = response.read(1024 * 1024)

                        if not chunk:
                            break

                        f.write(chunk)
                        done += len(chunk)

                        now = time.monotonic()

                        if now - last_update >= 0.1 or (
                            total and done >= total
                        ):
                            last_update = now

                            if total:
                                percent = min(
                                    100.0,
                                    done * 100.0 / total
                                )
                                status_text = (
                                    f"Baixando: "
                                    f"{done / 1024**2:.1f} / "
                                    f"{total / 1024**2:.1f} MB"
                                )
                            else:
                                percent = 0
                                status_text = (
                                    f"Baixando: "
                                    f"{done / 1024**2:.1f} MB"
                                )

                            self.ui_queue.put(
                                ("progress", percent, status_text)
                            )

                if done == 0:
                    raise RuntimeError(
                        "O servidor retornou um arquivo vazio."
                    )

                if total and done != total:
                    raise RuntimeError(
                        f"Download incompleto: recebido "
                        f"{done} de {total} bytes."
                    )

            # Só cria o arquivo final depois que tudo foi recebido.
            os.replace(temp, dest)

            log(
                f"Download concluído: {filename} "
                f"({done} bytes)"
            )

            self.ui_queue.put(
                ("done", str(dest), automatic)
            )

        except Exception as e:
            try:
                if temp.exists():
                    temp.unlink()
            except Exception:
                pass

            log(
                f"ERRO download {filename}: "
                f"{type(e).__name__}: {e}"
            )

            self.ui_queue.put(
                ("error", "Erro no download", str(e))
            )

    def process_ui_queue(self):
        try:
            while True:
                item = self.ui_queue.get_nowait()
                kind = item[0]

                if kind == "status":
                    self.status_var.set(item[1])

                elif kind == "mode":
                    self.set_progress_mode(item[1])

                elif kind == "progress":
                    self.set_download_progress(item[1], item[2])

                elif kind == "start_download":
                    self.start_download(
                        item[1],
                        automatic=item[2]
                    )

                elif kind == "done":
                    self.set_progress_mode("determinate")
                    self.progress_var.set(100)

                    if item[2]:
                        self.status_var.set(
                            "Backup automático concluído."
                        )
                        try:
                            if self.tray:
                                self.tray.notify(
                                    "Backup concluído",
                                    Path(item[1]).name
                                )
                        except Exception:
                            pass
                    else:
                        self.status_var.set(
                            "Download concluído."
                        )
                        messagebox.showinfo(
                            "Download concluído",
                            f"Backup salvo em:\n\n{item[1]}"
                        )

                elif kind == "info":
                    messagebox.showinfo(item[1], item[2])

                elif kind == "error":
                    self.set_progress_mode("determinate")
                    self.progress_var.set(0)
                    self.status_var.set("Erro.")
                    messagebox.showerror(
                        item[1],
                        item[2]
                    )

        except queue.Empty:
            pass

        if self.running:
            self.root.after(100, self.process_ui_queue)

    def initial_check(self):
        self.update_list()
        if self.auto_var.get():
            self.auto_check()
        self.schedule_next()

    def schedule_next(self):
        if self.running:
            minutes = max(5, int(self.interval_var.get()))
            self.root.after(minutes * 60 * 1000, self.initial_check)

    def auto_check(self):
        threading.Thread(target=self._auto_check, daemon=True).start()

    def _auto_check(self):
        try:
            backups = get_backups(self.api_var.get(), self.token_var.get())
            if not backups:
                return
            backups.sort(key=backup_sort_key, reverse=True)
            filename = backup_filename(backups[0])
            folder = Path(self.folder_var.get())
            folder.mkdir(parents=True, exist_ok=True)
            target = folder / filename
            if not target.exists():
                self.ui_status(f"Novo backup encontrado: {filename}")
                self.root.after(0, lambda n=filename: self.start_download(n, automatic=True))
            else:
                self.ui_status("Backup atualizado: nenhum arquivo novo.")
        except Exception as e:
            log(f"Erro verificação automática: {e}")
            self.ui_status(f"Erro na verificação automática: {e}")

    def ui_status(self, text):
        self.root.after(0, lambda: self.status_var.set(text))

    def setup_tray(self):
        try:
            import pystray
            from PIL import Image, ImageDraw

            img = Image.new("RGB", (64, 64), (30, 90, 180))
            d = ImageDraw.Draw(img)
            d.rectangle((15, 27, 49, 51), fill="white")
            d.polygon([(11, 28), (32, 9), (53, 28)], fill="white")
            d.rectangle((27, 36, 37, 51), fill=(30, 90, 180))

            menu = pystray.Menu(
                pystray.MenuItem("Abrir painel", lambda icon, item: self.show()),
                pystray.MenuItem("Baixar último backup", lambda icon, item: self.download_latest()),
                pystray.MenuItem("Atualizar lista", lambda icon, item: self.update_list()),
                pystray.MenuItem("Abrir pasta", lambda icon, item: self.open_folder()),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Sair", lambda icon, item: self.quit()),
            )
            self.tray = pystray.Icon(APP_NAME, img, APP_NAME, menu)
            threading.Thread(target=self.tray.run, daemon=True).start()
        except Exception as e:
            log(f"Erro ao iniciar ícone da bandeja: {e}")

    def show(self):
        self.root.after(0, lambda: (self.root.deiconify(), self.root.lift(), self.root.focus_force()))

    def hide(self):
        self.root.withdraw()

    def quit(self):
        self.running = False
        try:
            if self.tray:
                self.tray.stop()
        except Exception:
            pass
        self.root.after(0, self.root.destroy)

    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    background = "--background" in sys.argv
    App(background=background).run()

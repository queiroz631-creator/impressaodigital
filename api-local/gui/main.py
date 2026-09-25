"""Interface gráfica principal do Lojamix Sync."""
from __future__ import annotations

import threading
import tkinter as tk
from tkinter import ttk, messagebox

import httpx

from app.config import recarregar
from app.database import disponivel
from app.settings_store import load_config, load_secrets, save_config, save_secrets
from app import sql_store
from app.utils.estado import ler as ler_estado
from app.windows import startup_enabled, set_startup


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Lojamix Sync")
        self.geometry("900x700")
        self.minsize(820, 620)

        self.cfg = load_config()
        self.sec = load_secrets()

        self.status_var = tk.StringVar(value="Iniciando...")
        self.sql_var = tk.StringVar(value="● Verificando...")
        self.sistema_var = tk.StringVar(value="● Verificando...")
        self.sync_var = tk.StringVar(value="Aguardando")
        self.last_var = tk.StringVar(value="—")
        self.result_var = tk.StringVar(value="—")

        self._build()
        self.after(800, self.refresh_status)

    def _build(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("vista")
        except tk.TclError:
            pass

        root = ttk.Frame(self, padding=18)
        root.pack(fill="both", expand=True)

        header = ttk.Frame(root)
        header.pack(fill="x", pady=(0, 14))
        ttk.Label(
            header, text="Lojamix Sync",
            font=("Segoe UI", 22, "bold")
        ).pack(side="left")
        ttk.Label(
            header, textvariable=self.status_var,
            font=("Segoe UI", 11, "bold")
        ).pack(side="right", pady=6)

        cards = ttk.Frame(root)
        cards.pack(fill="x", pady=(0, 14))
        cards.columnconfigure((0, 1), weight=1)

        self._card(cards, 0, "SQL SERVER", self.sql_var)
        self._card(cards, 1, "SISTEMA", self.sistema_var)

        action = ttk.LabelFrame(root, text="Ações", padding=14)
        action.pack(fill="x", pady=(0, 14))

        btns = ttk.Frame(action)
        btns.pack(fill="x")
        for i in range(4):
            btns.columnconfigure(i, weight=1)

        ttk.Button(
            btns, text="🔌  Testar SQL Server",
            command=self.test_sql
        ).grid(row=0, column=0, padx=5, sticky="ew", ipady=10)

        ttk.Button(
            btns, text="🌐  Testar Sistema",
            command=self.test_sistema
        ).grid(row=0, column=1, padx=5, sticky="ew", ipady=10)

        ttk.Button(
            btns, text="🔄  Sincronizar Agora",
            command=self.sync_now
        ).grid(row=0, column=2, padx=5, sticky="ew", ipady=10)

        ttk.Button(
            btns, text="⚙  Configurações",
            command=self.open_config
        ).grid(row=0, column=3, padx=5, sticky="ew", ipady=10)

        info = ttk.LabelFrame(root, text="Status da sincronização", padding=14)
        info.pack(fill="x", pady=(0, 14))
        info.columnconfigure(1, weight=1)

        rows = [
            ("Sincronização", self.sync_var),
            ("Último ciclo", self.last_var),
            ("Último resultado", self.result_var),
        ]
        for row, (label, var) in enumerate(rows):
            ttk.Label(info, text=label + ":",
                      font=("Segoe UI", 10, "bold")).grid(
                row=row, column=0, sticky="nw", padx=(0, 12), pady=5
            )
            ttk.Label(info, textvariable=var, wraplength=650).grid(
                row=row, column=1, sticky="w", pady=5
            )

        log_frame = ttk.LabelFrame(root, text="Informações", padding=10)
        log_frame.pack(fill="both", expand=True)
        self.log_text = tk.Text(
            log_frame, height=10, state="disabled",
            font=("Consolas", 9), wrap="word"
        )
        self.log_text.pack(fill="both", expand=True)

        bottom = ttk.Frame(root)
        bottom.pack(fill="x", pady=(12, 0))
        ttk.Button(bottom, text="📋 Atualizar status",
                    command=self.refresh_status).pack(side="left")
        ttk.Button(bottom, text="⚠ Detalhes do erro",
                    command=self.show_error_details).pack(side="left", padx=8)
        ttk.Button(bottom, text="♻ Reprocessar clientes",
                    command=self.reprocessar_clientes).pack(side="left")
        ttk.Button(bottom, text="✕ Fechar",
                    command=self.close_app).pack(side="right")

    def _card(self, parent: ttk.Frame, column: int, title: str, variable: tk.StringVar) -> None:
        frame = ttk.LabelFrame(parent, text=title, padding=14)
        frame.grid(row=0, column=column, padx=5, sticky="ew")
        ttk.Label(frame, textvariable=variable,
                  font=("Segoe UI", 12, "bold")).pack(anchor="w")

    def _set_log(self, text: str) -> None:
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.insert("1.0", text)
        self.log_text.configure(state="disabled")

    def _api(self, method: str, path: str):
        cfg = load_config()
        sec = load_secrets()
        token = sec.get("api_local_token", "")
        return httpx.request(
            method,
            f"http://127.0.0.1:{cfg.get('api_local_port', 8100)}{path}",
            headers={"X-API-Token": token},
            timeout=8,
        )

    def refresh_status(self) -> None:
        def work() -> None:
            try:
                r = self._api("GET", "/api/local/status")
                r.raise_for_status()
                data = r.json()
                self.after(0, lambda: self._apply_status(data))
            except Exception as exc:
                self.after(0, lambda: self._offline(str(exc)))

        threading.Thread(target=work, daemon=True).start()
        self.after(5000, self.refresh_status)

    def _apply_status(self, data: dict) -> None:
        service = str(data.get("service", "unknown"))
        running = bool(data.get("sync_running"))
        self.status_var.set("● Serviço online")
        self.sql_var.set("● " + str(data.get("sqlserver", "desconhecido")).upper())
        self.sistema_var.set("● Configuração será verificada ao testar")
        self.sync_var.set("Em andamento" if running else "Aguardando")
        self.last_var.set(data_hora_br(data.get("last_cycle")))
        result = data.get("last_result") or {}
        self.result_var.set(str(result)[:700] if result else "—")
        ultimo_erro = data.get("last_error") or "nenhum"
        self._set_log(
            f"Serviço: {service}\n"
            f"SQL Server: {data.get('sqlserver', 'desconhecido')}\n"
            f"Sincronização em andamento: {running}\n"
            f"Último sucesso: {data_hora_br(data.get('last_success'))}\n"
            f"Último erro: {ultimo_erro}\n"
            + self._resumo_clientes(result)
        )

    def _resumo_clientes(self, result: dict) -> str:
        """Mostra quantos clientes foram enviados e por que outros ficaram fora."""
        linhas = []
        for chave, titulo in (
            ("clientes_loja_sistema", "Clientes (loja → sistema)"),
            ("clientes_revisao", "Revisão de clientes"),
        ):
            item = result.get(chave)
            if not isinstance(item, dict):
                continue
            linhas.append(
                f"\n{titulo}: lidos {item.get('lidos', 0)}, enviados {item.get('enviados', 0)}, "
                f"criados {item.get('criados', 0)}, atualizados {item.get('atualizados', 0)}\n"
                f"  Fora do envio: sem nome {item.get('semNome', 0)}, sem CPF {item.get('semCpf', 0)}, "
                f"CPF inválido {item.get('cpfInvalido', 0)}, sem telefone {item.get('semTelefone', 0)}"
            )

        simulacao = False

        alteracoes = result.get("clientes_sistema_loja")
        if isinstance(alteracoes, dict) and alteracoes.get("desligado"):
            linhas.append("\nClientes (sistema → loja): desligada")
        elif isinstance(alteracoes, dict):
            simulacao = simulacao or bool(alteracoes.get("bloqueadoSimulacao"))
            linhas.append(
                "\nClientes (sistema → loja): aplicados "
                f"{alteracoes.get('aplicados', 0)}, criados {alteracoes.get('criados', 0)}, "
                f"vinculados {alteracoes.get('vinculados', 0)}, "
                f"atualizados {alteracoes.get('atualizados', 0)}, "
                f"simulados {alteracoes.get('simulados', 0)}, erros {alteracoes.get('erros', 0)}"
            )

        pendentes = result.get("clientes_pendentes_loja")
        if isinstance(pendentes, dict) and pendentes.get("desligado"):
            linhas.append("\nClientes pendentes (sistema → loja): desligada")
        elif isinstance(pendentes, dict):
            simulacao = simulacao or bool(pendentes.get("bloqueadoSimulacao"))
            linhas.append(
                "\nClientes pendentes (sistema → loja): recebidos "
                f"{pendentes.get('recebidos', 0)}, criados {pendentes.get('criados', 0)}, "
                f"vinculados {pendentes.get('vinculados', 0)}, "
                f"atualizados {pendentes.get('atualizados', 0)}, "
                f"simulados {pendentes.get('simulados', 0)}, erros {pendentes.get('erros', 0)}\n"
                f"  Fora do envio: sem participação ativa "
                f"{pendentes.get('semParticipacaoAtiva', 0)}"
                + ("\n  Varredura reiniciada do começo." if pendentes.get("voltouAoInicio") else "")
            )

        if not bool(self.cfg.get("gravar_clientes_no_lojamix", False)):
            linhas.append(
                "\n\n*** GRAVAÇÃO DE CLIENTES NO LOJAMIX DESLIGADA: as etapas "
                "sistema → loja não rodam. Ligue em Configurações quando quiser "
                "retomar. ***"
            )
        elif simulacao or bool(self.cfg.get("simulacao_criacao_cliente", True)):
            linhas.append(
                "\n\n*** MODO SIMULAÇÃO LIGADO: nenhum cliente novo é criado no "
                "Lojamix. Desligue em Configurações para gravar de verdade. ***"
            )

        return "".join(linhas)

    def reprocessar_clientes(self) -> None:
        if not messagebox.askyesno(
            "Reprocessar clientes",
            "Refazer o envio de todos os clientes elegíveis para o sistema?\n\n"
            "Os clientes já enviados serão apenas atualizados. As notas fiscais não são afetadas.",
        ):
            return

        def work() -> None:
            try:
                r = self._api("POST", "/api/local/clientes-reprocessar")
                r.raise_for_status()
                data = r.json()
                self.after(0, lambda: self._reprocessar_result(data))
            except Exception as exc:
                detalhe = str(exc)[:250]
                self.after(0, lambda: messagebox.showerror(
                    "Reprocessar clientes",
                    f"Não foi possível iniciar o reprocessamento.\n\nDetalhe: {detalhe}",
                ))

        threading.Thread(target=work, daemon=True).start()

    def _reprocessar_result(self, data: dict) -> None:
        if data.get("reiniciado"):
            messagebox.showinfo(
                "Reprocessar clientes",
                "Reprocessamento iniciado. O envio dos clientes elegíveis começa agora.",
            )
            self.refresh_status()
        else:
            messagebox.showwarning(
                "Reprocessar clientes",
                str(data.get("motivo") or "Não foi possível reprocessar agora."),
            )

    def _offline(self, detail: str) -> None:
        self.status_var.set("● Serviço/API offline")
        self.sql_var.set("● Indisponível")
        self.sistema_var.set("● Indisponível")
        self.sync_var.set("Não disponível")
        self._set_log(
            "Não foi possível consultar a API local.\n\n"
            "Se acabou de abrir o programa, aguarde alguns segundos.\n"
            f"Detalhe técnico: {detail[:250]}"
        )

    def test_sql(self) -> None:
        def work() -> None:
            try:
                from app.database import consultar
                consultar("SELECT 1 AS ok")
                self.after(0, lambda: self._sql_result(True, None))
            except Exception as exc:
                self.after(0, lambda: self._sql_result(False, str(exc)))
        threading.Thread(target=work, daemon=True).start()

    def _sql_result(self, ok: bool, detalhe: str | None) -> None:
        self.sql_var.set("● CONECTADO" if ok else "● OFFLINE")
        if ok:
            messagebox.showinfo("SQL Server", "Conexão com o SQL Server realizada com sucesso.")
        else:
            texto = "Não foi possível consultar o SQL Server.\n\n" + (detalhe or "Sem detalhes disponíveis.")
            self._set_log(texto)
            messagebox.showerror("SQL Server", texto[:1800])

    def show_error_details(self) -> None:
        erro = ler_estado().get("last_error")
        if not erro:
            erro = self.result_var.get() if self.result_var.get() != "—" else "Nenhum erro registrado no momento."
        win = tk.Toplevel(self)
        win.title("Lojamix Sync — Detalhes do erro")
        win.geometry("760x430")
        txt = tk.Text(win, wrap="word", font=("Consolas", 9))
        txt.pack(fill="both", expand=True, padx=12, pady=12)
        txt.insert("1.0", str(erro))
        txt.configure(state="disabled")
        ttk.Button(win, text="Fechar", command=win.destroy).pack(pady=(0, 12))

    def test_sistema(self) -> None:
        def work() -> None:
            try:
                from app.services.sistema import chamar, SORTEIO_ATIVO
                data = chamar(SORTEIO_ATIVO)
                self.after(0, lambda: self._system_result(True, data))
            except Exception as exc:
                self.after(0, lambda: self._system_result(False, str(exc)))

        threading.Thread(target=work, daemon=True).start()

    def _system_result(self, ok: bool, detail) -> None:
        self.sistema_var.set("● CONECTADO" if ok else "● OFFLINE")
        if ok:
            msg = "Sistema conectado e token aceito."
            if isinstance(detail, dict) and detail.get("id"):
                msg += f"\nSorteio ativo: {detail.get('numero', detail.get('id'))}"
            messagebox.showinfo("Sistema", msg)
        else:
            messagebox.showerror("Sistema", f"Não foi possível conectar ao sistema.\n\n{str(detail)[:300]}")

    def sync_now(self) -> None:
        def work() -> None:
            try:
                r = self._api("POST", "/api/local/sync-now")
                r.raise_for_status()
                self.after(0, lambda: messagebox.showinfo(
                    "Lojamix Sync",
                    "Sincronização solicitada. O worker iniciará o próximo ciclo."
                ))
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror(
                    "Lojamix Sync",
                    "Não foi possível solicitar a sincronização.\n\n"
                    "Verifique se a API local está em execução."
                ))

        threading.Thread(target=work, daemon=True).start()

    def open_config(self) -> None:
        ConfigWindow(self)

    def show_startup_error(self, detail: str) -> None:
        messagebox.showerror("Lojamix Sync", detail)

    def close_app(self) -> None:
        self.withdraw()

    def show_startup_result(self, ok: bool) -> None:
        if ok:
            messagebox.showinfo("Lojamix Sync","Inicialização com o Windows atualizada com sucesso.")
        else:
            messagebox.showerror("Lojamix Sync","Não foi possível alterar a inicialização com o Windows.")

    def quit_from_tray(self) -> None:
        self.destroy()


class ConfigWindow(tk.Toplevel):
    def __init__(self, parent: App) -> None:
        super().__init__(parent)
        self.parent = parent
        self.title("Lojamix Sync — Configurações")
        self.geometry("950x760")
        self.minsize(850, 650)
        self.transient(parent)
        self.grab_set()

        self.cfg = load_config()
        self.sec = load_secrets()

        root = ttk.Frame(self, padding=15)
        root.pack(fill="both", expand=True)

        ttk.Label(root, text="Configurações",
                  font=("Segoe UI", 18, "bold")).pack(anchor="w", pady=(0, 10))

        notebook = ttk.Notebook(root)
        notebook.pack(fill="both", expand=True)

        conexao_tab = ttk.Frame(notebook, padding=15)
        sql_tab = ttk.Frame(notebook, padding=10)
        notebook.add(conexao_tab, text="Conexão")
        notebook.add(sql_tab, text="Consultas SQL")

        conexao_tab.columnconfigure(1, weight=1)
        self.vars: dict[str, tk.StringVar] = {}

        fields = [
            ("sqlserver_host", "Servidor SQL Server"),
            ("sqlserver_port", "Porta"),
            ("sqlserver_database", "Banco"),
            ("sqlserver_driver", "Driver ODBC"),
            ("sistema_url", "URL do sistema"),
            ("api_local_port", "Porta da API local"),
            ("sync_interval_seconds", "Intervalo (segundos)"),
            ("lote_tamanho", "Tamanho do lote"),
            ("revisao_bloco", "Bloco de revisão"),
            ("pendentes_bloco", "Bloco de clientes pendentes"),
        ]
        for row, (key, label) in enumerate(fields):
            self._field(conexao_tab, row, label, key, str(self.cfg.get(key, "")))

        row = len(fields)
        for key, label in [
            ("sqlserver_user", "Usuário SQL Server"),
            ("sqlserver_password", "Senha SQL Server"),
            ("sistema_token", "Token do sistema"),
        ]:
            self._field(conexao_tab, row, label, key, self.sec.get(key, ""), secret=True)
            row += 1

        self.startup_var = tk.BooleanVar(value=startup_enabled())
        ttk.Checkbutton(
            conexao_tab,
            text="Iniciar automaticamente com o Windows",
            variable=self.startup_var
        ).grid(row=row, column=0, columnspan=2, sticky="w", pady=(8,4))
        row += 1

        self.write_var = tk.BooleanVar(
            value=bool(self.cfg.get("escrita_sqlserver_habilitada", False))
        )
        ttk.Checkbutton(
            conexao_tab,
            text="Permitir escrita no SQL Server (necessário para Sistema → Loja)",
            variable=self.write_var
        ).grid(row=row, column=0, columnspan=2, sticky="w", pady=(10,0))
        row += 1

        self.gravar_var = tk.BooleanVar(
            value=bool(self.cfg.get("gravar_clientes_no_lojamix", False))
        )
        ttk.Checkbutton(
            conexao_tab,
            text="Gravar clientes no Lojamix (sistema → loja). Desligado: nenhum cliente é criado, atualizado ou vinculado na loja",
            variable=self.gravar_var
        ).grid(row=row, column=0, columnspan=2, sticky="w", pady=(4,0))
        row += 1

        self.criar_var = tk.BooleanVar(
            value=bool(self.cfg.get("criar_cliente_no_lojamix", True))
        )
        ttk.Checkbutton(
            conexao_tab,
            text="Criar clientes novos no Lojamix (quando não existir por CPF)",
            variable=self.criar_var
        ).grid(row=row, column=0, columnspan=2, sticky="w", pady=(4,0))
        row += 1

        self.simulacao_var = tk.BooleanVar(
            value=bool(self.cfg.get("simulacao_criacao_cliente", True))
        )
        ttk.Checkbutton(
            conexao_tab,
            text="Modo simulação: apenas mostrar quem seria criado, sem gravar no Lojamix",
            variable=self.simulacao_var
        ).grid(row=row, column=0, columnspan=2, sticky="w", pady=(4,10))
        row += 1

        ttk.Label(
            conexao_tab,
            text="Senhas e tokens são armazenados separadamente e protegidos pelo Windows.",
            wraplength=700
        ).grid(row=row + 1, column=0, columnspan=2, sticky="w", pady=5)

        sql_tab.columnconfigure(0, weight=1)
        sql_tab.columnconfigure(1, weight=0)
        sql_tab.rowconfigure(2, weight=1)
        self.sql_key_var = tk.StringVar(value="notas_novas")

        selector = ttk.Frame(sql_tab)
        selector.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 8))
        ttk.Label(selector, text="Consulta oficial:").pack(side="left", padx=(0, 8))
        self.sql_combo = ttk.Combobox(
            selector, textvariable=self.sql_key_var,
            state="readonly", width=34,
            values=["notas_novas", "notas_situacoes", "clientes_loja_sistema", "clientes_por_nota", "clientes_revisao", "maior_id_nota", "cliente_aplicar_alteracao", "cliente_por_cpf", "cliente_criar_entidade", "cliente_criar_pessoa_fisica"]
        )
        self.sql_combo.pack(side="left")
        self.sql_combo.current(0)
        self.sql_combo.bind("<<ComboboxSelected>>", lambda _e: self._load_sql_editor())

        ttk.Label(sql_tab, text="SQL editável:",
                  font=("Segoe UI", 10, "bold")).grid(row=1, column=0, columnspan=2, sticky="nw")

        editor_frame = ttk.Frame(sql_tab)
        editor_frame.grid(row=2, column=0, columnspan=2, sticky="nsew")
        editor_frame.columnconfigure(0, weight=1)
        editor_frame.rowconfigure(0, weight=1)
        self.sql_text = tk.Text(
            editor_frame, wrap="none", undo=True,
            font=("Consolas", 10), relief="solid", borderwidth=1
        )
        self.sql_text.grid(row=0, column=0, sticky="nsew")
        yscroll = ttk.Scrollbar(editor_frame, orient="vertical", command=self.sql_text.yview)
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll = ttk.Scrollbar(editor_frame, orient="horizontal", command=self.sql_text.xview)
        xscroll.grid(row=1, column=0, sticky="ew")
        self.sql_text.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)

        self.sql_info = tk.StringVar()
        ttk.Label(sql_tab, textvariable=self.sql_info, wraplength=850).grid(
            row=3, column=0, columnspan=2, sticky="w", pady=8
        )

        sql_buttons = ttk.Frame(sql_tab)
        sql_buttons.grid(row=4, column=0, columnspan=2, sticky="ew")
        ttk.Button(sql_buttons, text="✓ Validar SQL",
                   command=self.validate_sql).pack(side="left", padx=(0, 6))
        ttk.Button(sql_buttons, text="💾 Salvar consulta",
                   command=self.save_sql).pack(side="left", padx=6)
        ttk.Button(sql_buttons, text="↩ Restaurar padrão",
                   command=self.reset_sql).pack(side="left", padx=6)

        # Buttons for connection tab
        buttons = ttk.Frame(root)
        buttons.pack(fill="x", pady=(10, 0))
        ttk.Button(buttons, text="Testar SQL",
                   command=self.parent.test_sql).pack(side="left", padx=4)
        ttk.Button(buttons, text="Testar Sistema",
                   command=self.parent.test_sistema).pack(side="left", padx=4)
        ttk.Button(buttons, text="Salvar configurações",
                   command=self.save).pack(side="right", padx=4)
        ttk.Button(buttons, text="Cancelar",
                   command=self.destroy).pack(side="right", padx=4)

        self._load_sql_editor()

    def _field(self, parent, row, label, key, value, secret=False) -> None:
        ttk.Label(parent, text=label).grid(
            row=row, column=0, sticky="w", padx=(0, 12), pady=5
        )
        var = tk.StringVar(value=value)
        self.vars[key] = var
        ttk.Entry(
            parent, textvariable=var, width=58,
            show="*" if secret else ""
        ).grid(row=row, column=1, sticky="ew", pady=5)

    def _load_sql_editor(self) -> None:
        key = self.sql_key_var.get()
        try:
            item = sql_store.get(key)
            sql = item["sql"]
            estado = "PERSONALIZADA" if item.get("personalizado") else "PADRÃO"
            ph = ", ".join("{{"+x+"}}" for x in item["placeholders"])
            info = (
                f"{item['nome']} — {estado}\n"
                f"{item['descricao']}\n"
                f"Marcadores obrigatórios: {ph}\n"
                f"Importante: os marcadores viram parâmetros ODBC; não coloque valores diretamente no SQL."
            )
        except Exception as exc:
            sql = ""
            info = f"Não foi possível carregar esta consulta.\nErro: {exc}"
        self.sql_text.delete("1.0", "end")
        self.sql_text.insert("1.0", sql)
        self.sql_info.set(info)

    def validate_sql(self) -> None:
        key = self.sql_key_var.get()
        sql = self.sql_text.get("1.0", "end-1c")
        try:
            sql_store.validate(key, sql)
            messagebox.showinfo("SQL", "Consulta válida. Os marcadores obrigatórios foram encontrados.")
        except Exception as exc:
            messagebox.showerror("SQL inválido", str(exc))

    def save_sql(self) -> None:
        key = self.sql_key_var.get()
        sql = self.sql_text.get("1.0", "end-1c")
        try:
            sql_store.save(key, sql)
            self._load_sql_editor()
            messagebox.showinfo(
                "SQL",
                "Consulta salva.\n\nA próxima sincronização usará esta consulta."
            )
        except Exception as exc:
            messagebox.showerror("SQL inválido", str(exc))

    def reset_sql(self) -> None:
        key = self.sql_key_var.get()
        if not messagebox.askyesno(
            "Restaurar padrão",
            "Deseja substituir a consulta personalizada pela consulta oficial padrão?"
        ):
            return
        try:
            sql_store.reset(key)
            self._load_sql_editor()
            messagebox.showinfo("SQL", "Consulta padrão restaurada.")
        except Exception as exc:
            messagebox.showerror("SQL", str(exc))

    def save(self) -> None:
        try:
            numeric = {
                "sqlserver_port", "api_local_port", "sync_interval_seconds",
                "lote_tamanho", "revisao_bloco", "pendentes_bloco"
            }
            data = dict(self.cfg)
            for key, var in self.vars.items():
                value = var.get().strip()
                data[key] = int(value) if key in numeric else value
            data["escrita_sqlserver_habilitada"] = self.write_var.get()
            data["gravar_clientes_no_lojamix"] = self.gravar_var.get()
            data["criar_cliente_no_lojamix"] = self.criar_var.get()
            data["simulacao_criacao_cliente"] = self.simulacao_var.get()

            secrets_data = dict(self.sec)
            for key in ["sqlserver_user", "sqlserver_password", "sistema_token"]:
                secrets_data[key] = self.vars[key].get()

            save_config(data)
            save_secrets(secrets_data)
            if not set_startup(self.startup_var.get()):
                raise RuntimeError('Não foi possível configurar a inicialização com o Windows.')
            recarregar()
            self.parent.cfg = load_config()
            self.parent.sec = load_secrets()

            messagebox.showinfo("Lojamix Sync", "Configuração salva com sucesso.")
            self.destroy()
        except ValueError:
            messagebox.showerror(
                "Configuração",
                "Porta, intervalo, lote e revisão devem ser números."
            )
        except Exception as exc:
            messagebox.showerror(
                "Configuração",
                f"Não foi possível salvar.\n\n{str(exc)[:300]}"
            )


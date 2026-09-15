"""Configuração central do Lojamix Sync."""
from functools import lru_cache
from pydantic import BaseModel
from app.settings_store import load_config, load_secrets

class Config(BaseModel):
    sqlserver_host: str = ""
    sqlserver_port: int = 1433
    sqlserver_database: str = "Lojamix"
    sqlserver_user: str = ""
    sqlserver_password: str = ""
    sqlserver_driver: str = "ODBC Driver 18 for SQL Server"
    sqlserver_timeout: int = 15
    sqlserver_encrypt: str = "yes"
    sqlserver_trust_server_certificate: str = "yes"
    sistema_url: str = ""
    sistema_token: str = ""
    sistema_timeout: int = 30
    api_local_token: str = ""
    api_local_port: int = 8100
    lote_tamanho: int = 100
    lote_maximo_ciclos: int = 10
    revisao_bloco: int = 500
    consumidor_clientes: str = "api-local-loja"
    estado_arquivo: str = ""
    log_nivel: str = "INFO"
    escrita_sqlserver_habilitada: bool = False
    sync_interval_seconds: int = 60

    def connection_string(self) -> str:
        return (
            f"DRIVER={{{self.sqlserver_driver}}};SERVER={self.sqlserver_host},{self.sqlserver_port};"
            f"DATABASE={self.sqlserver_database};UID={self.sqlserver_user};PWD={self.sqlserver_password};"
            f"Encrypt={self.sqlserver_encrypt};TrustServerCertificate={self.sqlserver_trust_server_certificate};"
            f"Connection Timeout={self.sqlserver_timeout};"
        )

@lru_cache
def config() -> Config:
    data = load_config()
    data.update(load_secrets())
    data["estado_arquivo"] = str(__import__("pathlib").Path(__import__("app.settings_store", fromlist=["BASE_DIR"]).BASE_DIR) / "state" / "estado.json")
    return Config(**data)

def recarregar() -> Config:
    config.cache_clear()
    return config()

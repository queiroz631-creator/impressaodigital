"""Configuração via variáveis de ambiente.

Nenhuma credencial é escrita em código. Nada aqui é exposto em resposta HTTP.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQL Server (Lojamix)
    sqlserver_host: str = ""
    sqlserver_port: int = 1433
    sqlserver_database: str = "Lojamix"
    sqlserver_user: str = ""
    sqlserver_password: str = ""
    sqlserver_driver: str = "ODBC Driver 18 for SQL Server"
    sqlserver_timeout: int = 15
    sqlserver_encrypt: str = "yes"
    sqlserver_trust_server_certificate: str = "yes"

    # Sistema (nuvem)
    sistema_url: str = ""
    sistema_token: str = ""
    sistema_timeout: int = 30

    # API local
    api_local_token: str = ""
    lote_tamanho: int = 100
    lote_maximo_ciclos: int = 10
    revisao_bloco: int = 500
    consumidor_clientes: str = "api-local-loja"
    estado_arquivo: str = "./estado/estado.json"
    log_nivel: str = "INFO"
    escrita_sqlserver_habilitada: bool = False

    def connection_string(self) -> str:
        """String de conexão. Nunca registrar em log nem devolver em resposta."""
        return (
            f"DRIVER={{{self.sqlserver_driver}}};"
            f"SERVER={self.sqlserver_host},{self.sqlserver_port};"
            f"DATABASE={self.sqlserver_database};"
            f"UID={self.sqlserver_user};"
            f"PWD={self.sqlserver_password};"
            f"Encrypt={self.sqlserver_encrypt};"
            f"TrustServerCertificate={self.sqlserver_trust_server_certificate};"
            f"Connection Timeout={self.sqlserver_timeout};"
        )


@lru_cache
def config() -> Config:
    return Config()

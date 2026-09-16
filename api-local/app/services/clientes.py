"""Sincronização de clientes nos dois sentidos.

LOJA -> SISTEMA: normaliza os dados textuais (CAIXA ALTA, sem acentos, sem
caracteres especiais), trata os campos estruturados com regra própria e envia
somente o essencial (nome, CPF, telefone, data de nascimento, e-mail).
`id_entidade` vai como identificador permanente da origem (`origemId`).

SISTEMA -> LOJA: lê apenas as alterações após o cursor oficial, aplica no SQL
Server e só então confirma. Nada é excluído em nenhum dos sentidos.
"""

import threading
from typing import Any

from app.config import config
from app.repositories import clientes_repo
from app.schemas.sync import ResumoClientes, ResumoPendentesClientes, ResumoRevisaoClientes, SorteioAtivo
from app.services.notas import _periodo, sorteio_ativo
from app.services import sistema
from app.services.lotes import lote_deterministico
from app.utils import estado, normalizacao
from app.utils.logging import erro_seguro, logger


# Serializa TODO o fluxo de clientes LOJA -> SISTEMA (ciclo normal, revisão de
# recuperação e reprocessamento nunca rodam ao mesmo tempo).
_TRAVA_CLIENTES = threading.Lock()


def em_execucao() -> bool:
    return _TRAVA_CLIENTES.locked()


def _cliente_para_envio(linha: dict[str, Any]) -> dict[str, Any]:
    return {
        "origemId": str(linha["id_entidade"]),
        "nome": normalizacao.texto(linha.get("nome")) or "",
        "cpf": normalizacao.cpf(linha.get("cpf")),
        "telefone": normalizacao.digitos(linha.get("telefone")),
        "email": normalizacao.email(linha.get("email")),
        "dataNascimento": normalizacao.data_iso(linha.get("data_nascimento")),
    }


def _enviar_lote(clientes: list[dict[str, Any]], lote_id: str, resumo: ResumoClientes) -> bool:
    """Envia um lote de clientes. Só retorna True após aceitação do sistema."""
    try:
        r = sistema.chamar(
            sistema.CLIENTES_RECEBER,
            {"loteId": lote_id, "clientes": clientes},
        )
        resumo.enviados += len(clientes)
        resumo.criados += int(r.get("criados") or 0)
        resumo.atualizados += int(r.get("atualizados") or 0)
        resumo.ignorados += int(r.get("ignorados") or 0)
        return True
    except sistema.ErroSistema as e:
        resumo.erros += 1
        resumo.erroDetalhe = erro_seguro(e)
        logger().error("clientes nao enviados: %s", resumo.erroDetalhe)
        return False


def _filtrar_clientes(linhas: list[dict[str, Any]], resumo: Any = None) -> list[dict[str, Any]]:
    """Aplica os critérios de envio e registra o motivo de cada descarte."""
    clientes = []
    for linha in linhas:
        cliente = _cliente_para_envio(linha)
        if not cliente["nome"]:
            if resumo is not None:
                resumo.semNome += 1
            continue
        bruto = normalizacao.digitos(linha.get("cpf"))
        if not cliente["cpf"]:
            if resumo is not None:
                if bruto and len(bruto) == 11:
                    # 11 dígitos, mas dígitos verificadores incorretos.
                    resumo.cpfInvalido += 1
                else:
                    resumo.semCpf += 1
            continue
        if len(cliente["cpf"]) != 11:
            if resumo is not None:
                resumo.cpfInvalido += 1
            continue
        if not cliente["telefone"] or len(cliente["telefone"]) < 10:
            if resumo is not None:
                resumo.semTelefone += 1
            continue
        clientes.append(cliente)
    return clientes


def enviar_para_sistema(lote: int | None = None, sorteio: SorteioAtivo | None = None) -> ResumoClientes:
    """Entrada pública: serializa o fluxo LOJA -> SISTEMA de clientes."""
    with _TRAVA_CLIENTES:
        return _enviar_para_sistema(lote=lote, sorteio=sorteio)


def _enviar_para_sistema(lote: int | None = None, sorteio: SorteioAtivo | None = None) -> ResumoClientes:
    """LOJA -> SISTEMA com dois cursores independentes.

    Passo A: entidades novas elegíveis.
    Passo B: entidades antigas que apareceram em novas notas do período.

    O limite superior das notas é capturado uma única vez no início do ciclo,
    evitando que o segundo passo avance sobre notas que chegaram no meio do
    processamento.
    """
    cfg = config()
    tamanho = min(lote or cfg.lote_tamanho, 500)
    resumo = ResumoClientes()

    sorteio = sorteio or sorteio_ativo()
    inicio, fim = _periodo(sorteio)
    dados = estado.ler()

    # A) Clientes novos por id_entidade.
    marcador_entidade = int(dados.get("ultimo_id_entidade", 0) or 0)
    linhas = clientes_repo.alterados(tamanho, marcador_entidade, inicio, fim)
    resumo.lidos += len(linhas)

    if linhas:
        maior_entidade = max(int(l["id_entidade"]) for l in linhas)
        clientes = _filtrar_clientes(linhas, resumo)
        if clientes:
            lote_id = lote_deterministico("clientes-entidade", marcador_entidade + 1, maior_entidade)
            if _enviar_lote(clientes, lote_id, resumo):
                estado.avancar("ultimo_id_entidade", maior_entidade)
                resumo.ultimoIdEntidade = maior_entidade
            else:
                resumo.ultimoIdEntidade = marcador_entidade
        else:
            # Todos os registros do lote foram avaliados e não são elegíveis.
            estado.avancar("ultimo_id_entidade", maior_entidade)
            resumo.ultimoIdEntidade = maior_entidade
            resumo.ignorados += len(linhas)

    # Fotografia única do limite superior do segundo cursor.
    ate_id_nota = clientes_repo.maior_id_nota()
    marcador_nota_cliente = int(dados.get("ultimo_id_nota_cliente", 0) or 0)

    # B) Clientes antigos que tiveram novas notas no intervalo.
    while marcador_nota_cliente < ate_id_nota:
        linhas_nota = clientes_repo.elegiveis_por_nota(
            tamanho,
            marcador_nota_cliente,
            ate_id_nota,
            inicio,
            fim,
        )
        if not linhas_nota:
            # Ainda precisamos considerar que a faixa foi consumida.
            estado.avancar("ultimo_id_nota_cliente", ate_id_nota)
            resumo.ultimoIdNotaCliente = ate_id_nota
            break

        resumo.lidos += len(linhas_nota)
        maior_nota = max(int(l["id_nota_fiscal"]) for l in linhas_nota)
        clientes_nota = _filtrar_clientes(linhas_nota, resumo)

        if clientes_nota:
            lote_id = lote_deterministico("clientes-nota", marcador_nota_cliente + 1, maior_nota)
            if not _enviar_lote(clientes_nota, lote_id, resumo):
                resumo.ultimoIdNotaCliente = marcador_nota_cliente
                break
        estado.avancar("ultimo_id_nota_cliente", maior_nota)
        marcador_nota_cliente = maior_nota
        resumo.ultimoIdNotaCliente = maior_nota

        if len(linhas_nota) < tamanho:
            # Não há mais entidades elegíveis nesta faixa.
            break

    if resumo.ultimoIdEntidade == 0:
        resumo.ultimoIdEntidade = int(estado.ler().get("ultimo_id_entidade", 0) or 0)
    if resumo.ultimoIdNotaCliente == 0:
        resumo.ultimoIdNotaCliente = int(estado.ler().get("ultimo_id_nota_cliente", 0) or 0)
    return resumo


def revisar_elegiveis(bloco: int | None = None, sorteio: SorteioAtivo | None = None) -> ResumoRevisaoClientes:
    """Rede de segurança: varre o cadastro em blocos e reenvia quem é elegível.

    O envio é idempotente (identificado por `origemId`), então repetir um
    cliente já sincronizado apenas o atualiza. Ao terminar a varredura, o
    marcador volta ao início para recomeçar no próximo ciclo.
    """
    with _TRAVA_CLIENTES:
        return _revisar_elegiveis(bloco=bloco, sorteio=sorteio)


def _revisar_elegiveis(bloco: int | None = None, sorteio: SorteioAtivo | None = None) -> ResumoRevisaoClientes:
    cfg = config()
    tamanho = min(bloco or cfg.revisao_bloco, 500)
    resumo = ResumoRevisaoClientes()

    sorteio = sorteio or sorteio_ativo()
    inicio, fim = _periodo(sorteio)

    marcador = int(estado.ler().get("ultimo_id_cliente_revisado", 0) or 0)
    linhas = clientes_repo.revisar_elegiveis(tamanho, marcador, inicio, fim)

    if not linhas:
        # Fim da varredura: recomeça do início no próximo ciclo.
        if marcador:
            estado.definir("ultimo_id_cliente_revisado", 0)
            resumo.voltouAoInicio = True
        resumo.ultimoIdClienteRevisado = 0
        return resumo

    resumo.lidos = len(linhas)
    maior_id = max(int(l["id_entidade"]) for l in linhas)
    clientes = _filtrar_clientes(linhas, resumo)

    if clientes:
        lote_id = lote_deterministico("clientes-revisao", marcador + 1, maior_id)
        enviado = _enviar_lote(clientes, lote_id, resumo)  # type: ignore[arg-type]
        if not enviado:
            resumo.ultimoIdClienteRevisado = marcador
            return resumo

    estado.definir("ultimo_id_cliente_revisado", maior_id)
    resumo.ultimoIdClienteRevisado = maior_id
    return resumo


def reprocessar() -> dict[str, Any]:
    """Zera SOMENTE os marcadores do fluxo de clientes LOJA -> SISTEMA.

    Nunca toca em `ultimo_id_nota` nem em `ultimo_id_revisado` (sincronismo de
    notas). Não roda junto com um ciclo normal de clientes.
    """
    if _TRAVA_CLIENTES.locked():
        return {
            "reiniciado": False,
            "motivo": "Há uma sincronização de clientes em andamento. Tente novamente em instantes.",
        }
    with _TRAVA_CLIENTES:
        dados = estado.zerar_clientes()
        logger().info("marcadores de clientes reiniciados por solicitação do operador")
        return {
            "reiniciado": True,
            "marcadores": {campo: int(dados.get(campo, 0) or 0) for campo in estado.MARCADORES_CLIENTES},
        }


def ler_alteracoes(limite: int | None = None) -> dict[str, Any]:
    """Alterações do sistema a partir do cursor oficial. O cursor não avança aqui."""
    cfg = config()
    return sistema.chamar(
        sistema.CLIENTES_ALTERACOES,
        {"consumidor": cfg.consumidor_clientes, "limite": min(limite or cfg.lote_tamanho, 500)},
    )


def confirmar(sequencia: int, erro: str | None = None) -> dict[str, Any]:
    """Confirma o cursor oficial — só depois de aplicado no SQL Server."""
    cfg = config()
    corpo: dict[str, Any] = {"consumidor": cfg.consumidor_clientes, "sequencia": sequencia}
    if erro:
        corpo["erro"] = erro[:500]
    return sistema.chamar(sistema.CLIENTES_CONFIRMAR, corpo)


def _vincular_no_sistema(cliente_id: str, origem_id: str) -> None:
    """Grava a ligação permanente no sistema (anti-eco: origem LOJA)."""
    sistema.chamar(
        sistema.CLIENTES_VINCULAR,
        {"clienteId": cliente_id, "origemId": str(origem_id)},
    )


def _resolver_cliente(cliente: dict[str, Any], resumo: Any) -> str | None:
    """Resolve a ligação do cliente com o Lojamix.

    Retorna o id_entidade quando o cliente ficou pronto (atualizado/vinculado/
    criado) e None quando ficou simulado ou indisponível neste ciclo. Lança
    exceção em falha real de gravação.
    """
    cfg = config()
    cliente_id = str(cliente.get("id") or "")
    origem_id = cliente.get("origem_id") or cliente.get("origemId")
    nome = normalizacao.texto(cliente.get("nome"))
    email = normalizacao.email(cliente.get("email"))
    telefone = normalizacao.digitos(cliente.get("telefone"))
    cpf = normalizacao.cpf(cliente.get("cpf"))
    nascimento = cliente.get("data_nascimento") or cliente.get("dataNascimento")

    # A) Já tem ligação: apenas atualiza os campos de contato.
    if origem_id:
        clientes_repo.aplicar_alteracao(str(origem_id), nome, email, telefone)
        resumo.atualizados += 1
        return str(origem_id)

    # B) Procura pelo CPF no Lojamix: encontra → vincula e atualiza contato.
    if cpf:
        existente = clientes_repo.por_cpf(cpf)
        if existente and existente.get("id_entidade"):
            id_entidade = str(existente["id_entidade"])
            clientes_repo.aplicar_alteracao(id_entidade, nome, email, telefone)
            _vincular_no_sistema(cliente_id, id_entidade)
            resumo.vinculados += 1
            return id_entidade

    # C) Não existe na loja: simulação não grava nada e mantém disponível.
    if cfg.simulacao_criacao_cliente or not cfg.criar_cliente_no_lojamix:
        resumo.simulados += 1
        return None

    # D) Criação real em transação única + vinculação. Só conta após sucesso.
    id_criado = clientes_repo.criar(nome or "", cpf or "", telefone, email, nascimento)
    _vincular_no_sistema(cliente_id, str(id_criado))
    resumo.criados += 1
    return str(id_criado)


def aplicar_alteracoes(limite: int | None = None) -> dict[str, Any]:
    """Ciclo SISTEMA -> LOJA: ler, resolver ligação, aplicar, confirmar.

    A alteração vem marcada com origem SUPABASE no sistema, portanto aplicar
    aqui não gera um novo evento de volta (sem loop).
    """
    dados = ler_alteracoes(limite)
    itens = dados.get("itens") or []
    if not itens:
        return {"aplicados": 0, "cursor": dados.get("cursor", 0), "erros": 0}

    resumo = ResumoPendentesClientes()
    aplicados = 0
    ultima_ok = int(dados.get("cursor") or 0)
    falha: str | None = None
    bloqueado_simulacao = False

    for item in itens:
        cliente = item.get("cliente") or {}
        try:
            ligacao = _resolver_cliente(cliente, resumo)
            if ligacao is None:
                # Simulação ligada: nada foi gravado no Lojamix. O item NÃO pode
                # ser confirmado como aplicado — o cursor para aqui e o mesmo
                # cliente é processado de verdade quando a simulação for
                # desligada.
                bloqueado_simulacao = True
                logger().info(
                    "modo simulacao ligado: nenhum cliente novo foi criado no Lojamix"
                )
                break
            aplicados += 1
            ultima_ok = int(item.get("sequencia") or ultima_ok)
        except Exception as e:  # noqa: BLE001 - erro já sanitizado no confirmar
            falha = erro_seguro(e)
            logger().error("falha ao aplicar cliente no Lojamix: %s", falha)
            break

    resultado = confirmar(ultima_ok, falha)
    return {
        "aplicados": aplicados,
        "criados": resumo.criados,
        "vinculados": resumo.vinculados,
        "atualizados": resumo.atualizados,
        "simulados": resumo.simulados,
        "bloqueadoSimulacao": bloqueado_simulacao,
        "cursor": resultado.get("cursor", ultima_ok),
        "erros": 1 if falha else 0,
        "erroDetalhe": falha,
    }



def enviar_pendentes_para_loja(bloco: int | None = None) -> ResumoPendentesClientes:
    """Envio pendente SISTEMA -> LOJA em blocos, com paginação circular.

    O marcador `ultimo_id_cliente_pendente` é APENAS de paginação da varredura
    atual (o id do cliente é aleatório, não temporal): ao esgotar a lista, ele
    volta ao início. Avança somente após o bloco ser processado sem erro.
    """
    with _TRAVA_CLIENTES:
        return _enviar_pendentes_para_loja(bloco)


def _enviar_pendentes_para_loja(bloco: int | None = None) -> ResumoPendentesClientes:
    cfg = config()
    tamanho = min(bloco or cfg.pendentes_bloco, 500)
    resumo = ResumoPendentesClientes()

    marcador = str(estado.ler().get("ultimo_id_cliente_pendente") or "") or None
    try:
        dados = sistema.chamar(
            sistema.CLIENTES_PENDENTES,
            {"desdeId": marcador, "limite": tamanho},
        )
    except sistema.ErroSistema as e:
        resumo.erros += 1
        resumo.erroDetalhe = erro_seguro(e)
        return resumo

    itens = dados.get("itens") or []
    resumo.semParticipacaoAtiva += int(dados.get("descartadosSemParticipacao") or 0)

    if not itens and not dados.get("marcador"):
        # Fim da lista: recomeça do início no próximo ciclo.
        if marcador:
            estado.definir("ultimo_id_cliente_pendente", "")
            resumo.voltouAoInicio = True
        return resumo

    novo_marcador = dados.get("marcador") or marcador
    resumo.recebidos = len(itens)
    falhou = False

    for cliente in itens:
        try:
            _resolver_cliente(cliente, resumo)
        except Exception as e:  # noqa: BLE001
            falhou = True
            resumo.erros += 1
            resumo.erroDetalhe = erro_seguro(e)
            logger().error("falha ao processar cliente pendente: %s", resumo.erroDetalhe)
            break

    # Simulação ligada: nada foi gravado no Lojamix neste bloco.
    if resumo.simulados:
        resumo.bloqueadoSimulacao = True

    # Marcador avança só com o bloco concluído; erro mantém para nova tentativa.
    if not falhou and novo_marcador and novo_marcador != marcador:
        estado.definir("ultimo_id_cliente_pendente", novo_marcador)
    resumo.ultimoIdClientePendente = str(
        estado.ler().get("ultimo_id_cliente_pendente") or ""
    )
    return resumo

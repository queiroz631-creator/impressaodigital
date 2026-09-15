"""Estado operacional em memória para interface e serviço."""
from __future__ import annotations
from datetime import datetime, timezone
from threading import Lock
from typing import Any

_lock = Lock()
_state: dict[str, Any] = {
    "service": "starting",
    "last_cycle": None,
    "last_success": None,
    "last_error": None,
    "last_result": {},
    "sync_running": False,
}

def snapshot() -> dict[str, Any]:
    with _lock:
        return dict(_state)

def update(**kwargs: Any) -> None:
    with _lock:
        _state.update(kwargs)

def now() -> str:
    return datetime.now(timezone.utc).isoformat()

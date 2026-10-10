"""熱闘！ポケットベースボール のゲームサーバー (FastAPI)。

ゲーム本体 (static/ 以下の HTML・JavaScript) を配信し、セーブデータを
サーバー側に保存する小さな API を提供する。同じ Wi-Fi のスマホから
PC のアドレスにアクセスすれば、そのまま遊べる。

起動例::

    uvicorn pocket_baseball.server:app --host 0.0.0.0 --port 8000
"""

import hashlib
import json
import os
import re
import threading
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

STATIC_DIR = Path(__file__).resolve().parent / "static"
DEFAULT_SAVE_DIR = Path(__file__).resolve().parent / "saves"
# 1 スロットあたりのセーブデータ上限 (JSON の文字数)
MAX_SAVE_CHARS = 2_000_000
# スロット名: 英数字・日本語・ハイフン・アンダースコアのみ (パスとしては使わない)
SLOT_RE = re.compile(r"[\w\-]{1,32}")


class SavePayload(BaseModel):
    data: dict[str, Any]


class SaveInfo(BaseModel):
    slot: str
    updated: float
    data: dict[str, Any]


class SaveResult(BaseModel):
    ok: bool
    slot: str
    updated: float


def _check_slot(slot: str) -> str:
    if not SLOT_RE.fullmatch(slot):
        raise HTTPException(
            status_code=400,
            detail="セーブ名は1〜32文字の英数字・日本語・ハイフン・アンダースコアで指定してください",
        )
    return slot


def _slot_path(save_dir: Path, slot: str) -> Path:
    # スロット名をそのままファイル名にせず、ハッシュにして安全なファイル名にする
    digest = hashlib.sha256(slot.encode("utf-8")).hexdigest()[:40]
    return save_dir / f"{digest}.json"


def create_app(save_dir: Path | None = None) -> FastAPI:
    """ゲームサーバーのアプリを作る。テストでは save_dir に一時ディレクトリを渡す。"""
    directory = Path(
        save_dir or os.environ.get("POCKET_BASEBALL_SAVE_DIR") or DEFAULT_SAVE_DIR
    )
    lock = threading.Lock()

    app = FastAPI(
        title="熱闘！ポケットベースボール",
        summary="スマホで遊べる野球ゲームのサーバー",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )

    @app.get("/api/ping")
    def ping() -> dict[str, Any]:
        """クライアントがサーバー保存を使えるか確認するためのエンドポイント。"""
        return {"app": "pocket-baseball", "version": 1}

    @app.get("/api/saves/{slot}")
    def load_save(slot: str) -> SaveInfo:
        """セーブデータを読み込む。"""
        path = _slot_path(directory, _check_slot(slot))
        if not path.is_file():
            raise HTTPException(status_code=404, detail="セーブデータがありません")
        stored = json.loads(path.read_text(encoding="utf-8"))
        return SaveInfo(slot=slot, updated=stored["updated"], data=stored["data"])

    @app.put("/api/saves/{slot}")
    def store_save(slot: str, payload: SavePayload) -> SaveResult:
        """セーブデータを保存する (同じスロットは上書き)。"""
        path = _slot_path(directory, _check_slot(slot))
        body = json.dumps(
            {"slot": slot, "updated": time.time(), "data": payload.data},
            ensure_ascii=False,
        )
        if len(body) > MAX_SAVE_CHARS:
            raise HTTPException(status_code=413, detail="セーブデータが大きすぎます")
        with lock:
            directory.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(body, encoding="utf-8")
            tmp.replace(path)
        updated = json.loads(body)["updated"]
        return SaveResult(ok=True, slot=slot, updated=updated)

    @app.delete("/api/saves/{slot}")
    def delete_save(slot: str) -> SaveResult:
        """セーブデータを削除する。"""
        path = _slot_path(directory, _check_slot(slot))
        with lock:
            if not path.is_file():
                raise HTTPException(status_code=404, detail="セーブデータがありません")
            path.unlink()
        return SaveResult(ok=True, slot=slot, updated=time.time())

    # ゲーム本体 (index.html を / で返す)
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="game")
    return app


app = create_app()

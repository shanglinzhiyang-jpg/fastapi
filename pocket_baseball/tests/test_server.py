import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from pocket_baseball.server import create_app

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    return TestClient(create_app(save_dir=tmp_path))


def test_ping(client: TestClient) -> None:
    res = client.get("/api/ping")
    assert res.status_code == 200
    assert res.json() == {"app": "pocket-baseball", "version": 1}


def test_serves_game(client: TestClient) -> None:
    res = client.get("/")
    assert res.status_code == 200
    assert "ポケットベースボール" in res.text
    for path in ["/js/main.js", "/js/play.js", "/css/style.css", "/sw.js"]:
        assert client.get(path).status_code == 200, path


def test_save_roundtrip(client: TestClient) -> None:
    data = {"version": 1, "records": {"wins": 3}, "name": "剛田"}
    res = client.put("/api/saves/my-slot", json={"data": data})
    assert res.status_code == 200
    assert res.json()["ok"] is True
    res = client.get("/api/saves/my-slot")
    assert res.status_code == 200
    body = res.json()
    assert body["slot"] == "my-slot"
    assert body["data"] == data
    assert body["updated"] > 0


def test_japanese_slot_name(client: TestClient) -> None:
    res = client.put("/api/saves/ぼくのセーブ", json={"data": {"a": 1}})
    assert res.status_code == 200
    assert client.get("/api/saves/ぼくのセーブ").json()["data"] == {"a": 1}


def test_missing_save(client: TestClient) -> None:
    assert client.get("/api/saves/nothing").status_code == 404


@pytest.mark.parametrize("slot", ["..", "a.b", "x" * 33, "a b"])
def test_invalid_slot(client: TestClient, tmp_path: Path, slot: str) -> None:
    res = client.put(f"/api/saves/{slot}", json={"data": {}})
    # ".." はクライアント側で正規化されて別のパスになるので 405 になる
    assert res.status_code in (400, 404, 405)
    assert list(tmp_path.iterdir()) == []


def test_overwrite_and_delete(client: TestClient, tmp_path: Path) -> None:
    client.put("/api/saves/s1", json={"data": {"n": 1}})
    client.put("/api/saves/s1", json={"data": {"n": 2}})
    assert client.get("/api/saves/s1").json()["data"] == {"n": 2}
    assert len(list(tmp_path.glob("*.json"))) == 1
    assert client.delete("/api/saves/s1").status_code == 200
    assert client.get("/api/saves/s1").status_code == 404
    assert client.delete("/api/saves/s1").status_code == 404


def test_too_large(client: TestClient) -> None:
    res = client.put("/api/saves/big", json={"data": {"x": "a" * 2_100_000}})
    assert res.status_code == 413


def test_invalid_body(client: TestClient) -> None:
    assert client.put("/api/saves/s", json={"nope": 1}).status_code == 422


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js が必要")
def test_engine_simulation() -> None:
    # CPU 同士の試合を回して、エンジンが破綻せず野球らしい成績になるか確認する
    proc = subprocess.run(
        ["node", str(ROOT / "tools" / "engine_check.js"), "24"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js が必要")
@pytest.mark.parametrize(
    "args",
    [
        ["hr_flags_check.js"],
        ["pennant_check.js", "t", "10"],
        ["pennant_check.js", "h", "10"],
    ],
)
def test_pennant_news(args: list[str]) -> None:
    # セ・パ両リーグのペナントで、本塁打の記録 (号数・タグ) と「今日のホームラン」のニュースが
    # ボックススコアと食い違わないか確認する
    proc = subprocess.run(
        ["node", str(ROOT / "tools" / args[0]), *args[1:]],
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert proc.stdout.strip().endswith("OK"), proc.stdout

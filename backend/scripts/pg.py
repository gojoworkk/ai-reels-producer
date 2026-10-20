"""Локальный PostgreSQL из папки проекта (.tools/pgsql), без установки в систему.

python backend/scripts/pg.py start   — создать кластер при первом запуске и запустить
python backend/scripts/pg.py stop    — остановить
python backend/scripts/pg.py status  — статус
python backend/scripts/pg.py psql    — консоль базы

Если PG_BIN не задан, бинарники ищутся в .tools/pgsql/bin, а затем в PATH.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / ".tools" / "pgdata"
LOG_FILE = ROOT / ".tools" / "postgres.log"
PORT = os.environ.get("PG_PORT", "5433")
USER = "reels"
DB = "reels"


def bin_path(name: str) -> str:
    exe = f"{name}.exe" if os.name == "nt" else name
    for base in (os.environ.get("PG_BIN"), ROOT / ".tools" / "pgsql" / "bin"):
        if base and (Path(base) / exe).exists():
            return str(Path(base) / exe)
    found = shutil.which(name)
    if not found:
        sys.exit(f"Не найден {name}. Распакуйте PostgreSQL в .tools/pgsql или задайте PG_BIN.")
    return found


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=check, capture_output=True, text=True)


def is_running() -> bool:
    return run(bin_path("pg_ctl"), "status", "-D", str(DATA_DIR), check=False).returncode == 0


def init() -> None:
    if (DATA_DIR / "PG_VERSION").exists():
        return
    print("Создаём кластер PostgreSQL в", DATA_DIR)
    DATA_DIR.parent.mkdir(parents=True, exist_ok=True)
    # trust-доступ только с localhost: база слушает 127.0.0.1 и нужна для локальной разработки
    run(bin_path("initdb"), "-D", str(DATA_DIR), "-U", USER, "-E", "UTF8", "--locale=C", "-A", "trust")


def start() -> None:
    init()
    if not is_running():
        # Без перехвата вывода: postgres наследует потоки, и capture_output ждал бы их закрытия вечно
        subprocess.run(
            [
                bin_path("pg_ctl"), "start", "-D", str(DATA_DIR), "-l", str(LOG_FILE), "-w",
                "-o", f"-p {PORT} -c listen_addresses=127.0.0.1",
            ],
            check=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    exists = run(
        bin_path("psql"), "-h", "127.0.0.1", "-p", PORT, "-U", USER, "-d", "postgres", "-tAc",
        f"SELECT 1 FROM pg_database WHERE datname='{DB}'",
    ).stdout.strip()
    if exists != "1":
        run(bin_path("psql"), "-h", "127.0.0.1", "-p", PORT, "-U", USER, "-d", "postgres", "-c", f"CREATE DATABASE {DB}")
        print(f"Создана база {DB}")
    print(f"PostgreSQL запущен: postgresql://{USER}@127.0.0.1:{PORT}/{DB}")


def stop() -> None:
    if is_running():
        run(bin_path("pg_ctl"), "stop", "-D", str(DATA_DIR), "-m", "fast", "-w")
    print("PostgreSQL остановлен")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "start":
        start()
    elif cmd == "stop":
        stop()
    elif cmd == "status":
        print("работает" if is_running() else "остановлен")
    elif cmd == "psql":
        os.execv(bin_path("psql"), [bin_path("psql"), "-h", "127.0.0.1", "-p", PORT, "-U", USER, "-d", DB])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()

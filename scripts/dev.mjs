// Одна команда `npm run dev`: готовит Python при первом запуске и поднимает сервер и сайт
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const win = process.platform === "win32";
const py = win ? ".venv\\Scripts\\python.exe" : ".venv/bin/python";

if (!existsSync(py)) {
  console.log("Первый запуск: ставлю Python-зависимости...");
  spawnSync(win ? "py" : "python3", ["-m", "venv", ".venv"], { stdio: "inherit" });
  spawnSync(py, ["-m", "pip", "install", "-q", "-r", "backend/requirements.txt"], { stdio: "inherit" });
}

const api = spawn(resolve(py), ["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], {
  stdio: "inherit",
  cwd: "backend",
});
const web = spawn(win ? "npx.cmd" : "npx", ["next", "dev", "--port", "3000"], { stdio: "inherit", shell: win });

const stop = () => { api.kill(); web.kill(); process.exit(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", stop);
web.on("exit", stop);

// Запускает Python из backend/.venv с любыми аргументами — одинаково на Windows, macOS и Linux.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const win = process.platform === "win32";
const python = path.join(root, "backend", ".venv", win ? "Scripts/python.exe" : "bin/python");

export function spawnPython(args, options = {}) {
  return spawn(python, args, {
    cwd: root,
    env: { ...process.env, PYTHONPATH: path.join(root, "backend"), PYTHONIOENCODING: "utf-8" },
    // uvicorn --reload на Windows перезапускается через Ctrl+C всей консоли.
    // Своя группа консоли не даёт этому сигналу убить нас вместе с сервером.
    detached: win,
    windowsHide: true,
    ...options,
  });
}

export function killTree(child) {
  if (win) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill();
}

// Запущен напрямую (node scripts/py.mjs ...), а не импортирован из dev.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const child = spawnPython(process.argv.slice(2), { stdio: "inherit" });
  const stop = () => killTree(child);
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", (code) => process.exit(code ?? 1));
}

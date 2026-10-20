// Запускает Python из backend/.venv с любыми аргументами — одинаково на Windows, macOS и Linux.
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const python = path.join(root, "backend", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const res = spawnSync(python, process.argv.slice(2), {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PYTHONPATH: path.join(root, "backend"), PYTHONIOENCODING: "utf-8" },
});
process.exit(res.status ?? 1);

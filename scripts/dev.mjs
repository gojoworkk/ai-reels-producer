// npm run dev — поднимает PostgreSQL, API (FastAPI) и front-end (Next.js) одной командой.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { killTree, spawnPython } from "./py.mjs";

const root = path.resolve(import.meta.dirname, "..");
const python = path.join(root, "backend", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

if (!existsSync(python)) {
  console.error("Бэкенд не установлен. Выполните: npm run setup");
  process.exit(1);
}

const db = spawnSync(python, [path.join(root, "backend/scripts/pg.py"), "start"], { stdio: "inherit" });
if (db.status !== 0) process.exit(db.status ?? 1);

const procs = [
  ["api", spawnPython(["-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--port", "8000", "--reload", "--reload-dir", "backend/app"])],
  ["web", spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev"], { cwd: root })],
].map(([name, child]) => {
  const prefix = (line) => `[${name}] ${line}`;
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (buf) => process.stdout.write(buf.toString().split(/\r?\n/).filter(Boolean).map(prefix).join("\n") + "\n"));
  }
  child.on("exit", (code) => {
    console.log(prefix(`остановлен (код ${code})`));
    shutdown();
  });
  return child;
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  // uvicorn --reload и next dev запускают свои дочерние процессы — гасим всё дерево
  for (const p of procs) killTree(p);
  // PostgreSQL оставляем работать: следующий запуск будет быстрее. Остановить: npm run db:stop
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("\n  Сайт:  http://localhost:3000\n  API:   http://localhost:8000/docs\n");

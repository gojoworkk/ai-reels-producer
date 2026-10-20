// npm run setup — первая установка: Python-окружение бэкенда, PostgreSQL (на Windows — в папку проекта), файлы .env.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const win = process.platform === "win32";
const venv = path.join(root, "backend", ".venv");
const python = path.join(venv, win ? "Scripts/python.exe" : "bin/python");
const PG_ZIP = "https://get.enterprisedb.com/postgresql/postgresql-17.11-1-windows-x64-binaries.zip";

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });
  if (res.status !== 0) {
    console.error(`Команда завершилась с ошибкой (${res.status})`);
    process.exit(res.status ?? 1);
  }
}

// 1. Python-окружение
if (!existsSync(python)) run(win ? "python" : "python3", ["-m", "venv", venv]);
run(python, ["-m", "pip", "install", "-q", "--upgrade", "pip"]);
run(python, ["-m", "pip", "install", "-q", "-r", "backend/requirements.txt"]);

// 2. PostgreSQL
const pgBin = path.join(root, ".tools", "pgsql", "bin");
const hasSystemPg = spawnSync(win ? "where" : "which", ["pg_ctl"]).status === 0;
if (!existsSync(pgBin) && !hasSystemPg && !process.env.PG_BIN) {
  if (!win) {
    console.error("Установите PostgreSQL 15+ (brew install postgresql@17 / apt install postgresql) и запустите setup снова.");
    process.exit(1);
  }
  console.log("Скачиваем PostgreSQL 17 (~340 МБ) в .tools/ …");
  const dl = path.join(root, ".tools", "download");
  mkdirSync(dl, { recursive: true });
  run("curl", ["-L", "--fail", "-o", path.join(dl, "pg.zip"), PG_ZIP]);
  run("tar", ["-xf", path.join(dl, "pg.zip"), "-C", path.join(root, ".tools")]);
  rmSync(dl, { recursive: true, force: true });
}

// 3. Файлы окружения с общим токеном между front-end и API
const backendEnv = path.join(root, "backend", ".env");
if (!existsSync(backendEnv)) {
  const token = randomBytes(24).toString("base64url");
  writeFileSync(backendEnv, readFileSync(path.join(root, "backend", ".env.example"), "utf8").replace(/^API_TOKEN=.*$/m, `API_TOKEN=${token}`));
  if (!existsSync(path.join(root, ".env.local"))) {
    writeFileSync(path.join(root, ".env.local"), readFileSync(path.join(root, ".env.example"), "utf8").replace(/^API_TOKEN=.*$/m, `API_TOKEN=${token}`));
  }
  console.log("Созданы backend/.env и .env.local");
} else if (!existsSync(path.join(root, ".env.local"))) {
  copyFileSync(path.join(root, ".env.example"), path.join(root, ".env.local"));
  console.log("Создан .env.local — впишите в него API_TOKEN из backend/.env");
}

// 4. База
run(python, ["backend/scripts/pg.py", "start"]);
console.log("\nГотово. Впишите APIFY_TOKEN и ANTHROPIC_API_KEY в backend/.env и запустите: npm run dev");

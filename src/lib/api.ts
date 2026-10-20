import "server-only";

// HTTP-клиент к бэкенду. Вызывается только на сервере Next.js, поэтому API_TOKEN не попадает в браузер.
const API_URL = process.env.API_URL ?? "http://localhost:8000";
const API_TOKEN = process.env.API_TOKEN ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function detail(body: unknown): string | undefined {
  const d = (body as { detail?: unknown })?.detail;
  if (typeof d === "string") return d;
  // Ошибки валидации FastAPI приходят списком
  if (Array.isArray(d)) return d.map((e) => (e as { msg?: string }).msg).filter(Boolean).join("; ");
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(`Бэкенд недоступен по адресу ${API_URL}. Запустите его: npm run dev`, 503);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(detail(body) ?? `API вернул ${res.status}`, res.status);
  }
  return res;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const json = (body: unknown) => JSON.stringify(body);

import { ServerCrash } from "lucide-react";
import { Card } from "./ui";

export function ApiUnavailable({ error }: { error: unknown }) {
  return (
    <Card className="flex gap-3 px-5 py-4 text-[13px]">
      <ServerCrash size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">Не удалось получить данные с бэкенда</p>
        <p className="mt-1 text-muted">{error instanceof Error ? error.message : String(error)}</p>
        <p className="mt-1 text-muted">
          Запустите всё одной командой: <code className="rounded bg-hover px-1 text-xs">npm run dev</code>
        </p>
      </div>
    </Card>
  );
}
